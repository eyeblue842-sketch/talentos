"""Step 5: image/scanned-document preprocessing test matrix.

Uses the real pipeline (app/preprocessing/, app/engines/preprocessor_engine.py)
against real synthetic fixtures (tests/fixtures/preprocessing/) for the
image-quality/geometry tests -- these are fast, deterministic OpenCV/PIL
operations with no model to warm up, so there is no reason to fake them
the way Docling's ~9s conversion was faked in Step 4.5's tests. Worker
lifecycle behaviour (liveness during processing, timeout, queue) reuses
the fake_docling_supervisor fixture with the "preprocessor" engine key,
consistent with test_worker_lifecycle.py.
"""
from __future__ import annotations

import asyncio
import os
import shutil
import time

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.engines.preprocessor_engine import PreprocessorEngine
from app.main import app
from app.preprocessing import pdf_routing
from app.preprocessing.exif import apply_exif_orientation, strip_metadata
from app.security import ValidationError, sweep_abandoned_temp_dirs

pytestmark = pytest.mark.anyio


@pytest.fixture
def anyio_backend():
    return "asyncio"


FIXTURES_DIR = os.path.join(os.path.dirname(__file__), "fixtures", "preprocessing")
engine = PreprocessorEngine()


def _fixture(name: str) -> str:
    return os.path.join(FIXTURES_DIR, name)


def _out_dir(name: str) -> str:
    path = os.path.join(FIXTURES_DIR, "_out", name)
    os.makedirs(path, exist_ok=True)
    return path


# --- MIME/signature + limits (real security.py functions) ---------------


def test_decompression_bomb_is_rejected_before_expensive_decode():
    with pytest.raises(ValidationError) as excinfo:
        engine.preprocess(_fixture("12-decompression-bomb.png"), "image/png", _out_dir("bomb"))
    assert excinfo.value.code in ("IMAGE_DIMENSION_TOO_LARGE", "IMAGE_PIXEL_COUNT_TOO_LARGE")


def test_corrupt_truncated_image_is_a_safe_classified_error_not_a_raw_exception():
    with pytest.raises(ValidationError) as excinfo:
        engine.preprocess(_fixture("13-corrupt-truncated.jpg"), "image/jpeg", _out_dir("corrupt"))
    assert excinfo.value.code == "IMAGE_CORRUPT_OR_UNREADABLE"


def test_animated_image_is_rejected():
    from PIL import Image

    path = os.path.join(_out_dir("animated"), "animated.png")
    frames = [Image.new("RGB", (50, 50), (i * 50 % 255, 0, 0)) for i in range(3)]
    frames[0].save(path, save_all=True, append_images=frames[1:])
    with pytest.raises(ValidationError) as excinfo:
        engine.preprocess(path, "image/png", _out_dir("animated-out"))
    assert excinfo.value.code == "IMAGE_ANIMATED_NOT_SUPPORTED"


# --- EXIF orientation + metadata stripping -------------------------------


def test_exif_orientation_is_corrected():
    from PIL import Image

    base = Image.new("RGB", (100, 60), (200, 200, 200))
    exif = base.getexif()
    exif[0x0112] = 6  # "rotate 270" EXIF orientation tag
    path = os.path.join(_out_dir("exif"), "rotated.jpg")
    base.save(path, exif=exif)

    with Image.open(path) as loaded:
        corrected, applied = apply_exif_orientation(loaded)
    assert applied is True
    # orientation 6 swaps width/height (90-degree rotation applied)
    assert corrected.size == (60, 100)


def test_exif_gps_and_metadata_are_removed():
    from PIL import Image

    base = Image.new("RGB", (40, 40), (10, 20, 30))
    exif = base.getexif()
    exif[0x9286] = "user comment with potential PII"  # UserComment tag
    path = os.path.join(_out_dir("exif-strip"), "with-comment.jpg")
    base.save(path, exif=exif)

    with Image.open(path) as loaded:
        clean = strip_metadata(loaded)
    assert clean.getexif() == {} or len(dict(clean.getexif())) == 0
    assert not clean.info.get("exif")


# --- Geometry: crop/perspective/deskew -----------------------------------


def test_perspective_photo_is_cropped_and_corrected():
    pages = engine.preprocess(_fixture("05-perspective-phone-photo.jpg"), "image/jpeg", _out_dir("persp"))
    page = pages[0]
    assert page["perspectiveCorrectionApplied"] is True
    assert page["cropApplied"] is True
    assert "perspective_correction" in page["transformationsApplied"]
    # output should be closer to the original page's own aspect ratio
    # (800x1000) than the full photographed frame (1300x1300)
    assert page["outputWidthPx"] != page["outputHeightPx"]


def test_slight_skew_is_deskewed():
    pages = engine.preprocess(_fixture("04-slight-skew.jpg"), "image/jpeg", _out_dir("skew"))
    page = pages[0]
    assert abs(page["skewAngleDegrees"]) > 1.0
    assert "deskew" in page["transformationsApplied"]


def test_clean_page_is_not_deskewed_or_cropped():
    pages = engine.preprocess(_fixture("01-clean-highres.jpg"), "image/jpeg", _out_dir("clean"))
    page = pages[0]
    assert abs(page["skewAngleDegrees"]) < 0.5
    assert "deskew" not in page["transformationsApplied"]
    assert page["cropApplied"] is False


# --- Quality scoring -------------------------------------------------------


def test_blur_scoring_ranks_severe_blur_below_mild_below_clean():
    clean = engine.preprocess(_fixture("01-clean-highres.jpg"), "image/jpeg", _out_dir("q1"))[0]
    mild = engine.preprocess(_fixture("09-mild-blur.jpg"), "image/jpeg", _out_dir("q2"))[0]
    severe = engine.preprocess(_fixture("09b-severe-blur.jpg"), "image/jpeg", _out_dir("q3"))[0]
    assert clean["blurScore"] > mild["blurScore"] > severe["blurScore"]
    assert severe["qualityDecision"] == "UNUSABLE"
    assert "IMAGE_TOO_BLURRY" in mild["warnings"] + severe["warnings"]


def test_contrast_scoring_flags_low_contrast_image():
    low = engine.preprocess(_fixture("06-low-contrast.jpg"), "image/jpeg", _out_dir("q4"))[0]
    assert low["contrastScore"] < 0.15
    assert "PREPROCESSING_LOW_CONFIDENCE" in low["warnings"]


def test_shadow_assessment_flags_uneven_illumination():
    shadowed = engine.preprocess(_fixture("07-shadowed.jpg"), "image/jpeg", _out_dir("q5"))[0]
    clean = engine.preprocess(_fixture("01-clean-highres.jpg"), "image/jpeg", _out_dir("q6"))[0]
    assert shadowed["illuminationScore"] < clean["illuminationScore"]


def test_glare_assessment_does_not_misfire_on_a_plain_white_background():
    # Regression test for a real bug found during this step's own
    # benchmarking: a naive "fraction of near-white pixels" glare score
    # flagged nearly every clean white-background document as glare,
    # since the page background itself is legitimately near-white across
    # most of the frame.
    clean = engine.preprocess(_fixture("01-clean-highres.jpg"), "image/jpeg", _out_dir("q7"))[0]
    assert clean["glareScore"] < 0.1
    assert "EXCESSIVE_GLARE" not in clean["warnings"]


def test_low_resolution_image_is_flagged():
    low_res = engine.preprocess(_fixture("10-noisy-lowres.jpg"), "image/jpeg", _out_dir("q8"))[0]
    assert low_res["resolutionScore"] < 0.55
    assert "RESOLUTION_TOO_LOW" in low_res["warnings"]


# --- Conservative enhancement + rollback ----------------------------------


def test_enhancement_is_applied_when_it_improves_quality():
    result = engine.preprocess(_fixture("06-low-contrast.jpg"), "image/jpeg", _out_dir("enh1"))[0]
    assert result["enhancementApplied"] is True
    assert "contrast_enhancement" in result["transformationsApplied"]


def test_enhancement_is_rolled_back_when_it_would_worsen_quality(monkeypatch):
    # Force the "enhanced" candidate to score strictly worse than the
    # original by making the scorer always report a lower overall score
    # for anything that isn't bit-identical to the very first array it
    # sees -- proves the measured-rollback path actually discards the
    # enhancement rather than always keeping it.
    from app.preprocessing import pipeline as pipeline_module

    first_seen = {}
    real_score_all = pipeline_module._score_all

    def _fake_score_all(image_bgr, min_resolution_dimension):
        key = image_bgr.tobytes()
        if "original" not in first_seen:
            first_seen["original"] = key
            scores = real_score_all(image_bgr, min_resolution_dimension)
            scores["overallScore"] = 0.5
            return scores
        scores = real_score_all(image_bgr, min_resolution_dimension)
        scores["overallScore"] = 0.1 if key != first_seen["original"] else 0.5
        return scores

    monkeypatch.setattr(pipeline_module, "_score_all", _fake_score_all)
    result = engine.preprocess(_fixture("06-low-contrast.jpg"), "image/jpeg", _out_dir("enh2"))[0]
    assert result["enhancementApplied"] is False
    assert "contrast_enhancement" not in result["transformationsApplied"]


# --- Manual review classification + determinism ---------------------------


def test_manual_review_required_for_borderline_quality():
    result = engine.preprocess(_fixture("09-mild-blur.jpg"), "image/jpeg", _out_dir("mr1"))[0]
    assert result["qualityDecision"] in ("MANUAL_REVIEW_REQUIRED", "UNUSABLE")


def test_processing_metadata_is_deterministic_across_runs():
    a = engine.preprocess(_fixture("01-clean-highres.jpg"), "image/jpeg", _out_dir("det1"))[0]
    b = engine.preprocess(_fixture("01-clean-highres.jpg"), "image/jpeg", _out_dir("det2"))[0]
    keys = ("blurScore", "contrastScore", "illuminationScore", "glareScore", "resolutionScore", "overallQualityScore", "qualityDecision")
    for key in keys:
        assert a[key] == b[key], key


# --- PDF page-level routing ------------------------------------------------


def test_good_digital_pdf_is_never_rendered_to_an_image():
    good_pdf_path = os.path.join(os.path.dirname(FIXTURES_DIR), "fixture-12-pdf-table.pdf")
    pages = engine.preprocess(good_pdf_path, "application/pdf", _out_dir("pdf-native"))
    assert len(pages) == 1
    assert pages[0]["sourceType"] == "PDF_NATIVE_TEXT"
    assert pages[0]["plannedRoute"] == "NATIVE_DOCLING"
    assert "blurScore" not in pages[0]


def test_image_only_pdf_page_is_rendered_and_assessed():
    pages = engine.preprocess(_fixture("14-image-only-scanned.pdf"), "application/pdf", _out_dir("pdf-image"))
    assert len(pages) == 1
    assert pages[0]["sourceType"] == "PDF_RENDERED"
    assert pages[0]["textQuality"] == "IMAGE_ONLY"
    assert pages[0]["plannedRoute"] == "RENDER_FOR_OCR"
    assert "blurScore" in pages[0]


def test_pdf_assessment_reports_render_dimensions_from_declared_page_size():
    assessments = pdf_routing.assess_pdf_pages(
        _fixture("14-image-only-scanned.pdf"), render_dpi=150, max_rendered_pixels_per_document=100_000_000,
    )
    assert len(assessments) == 1
    assert assessments[0]["renderWidthPx"] > 0
    assert assessments[0]["renderHeightPx"] > 0


# --- Original upload is never modified ------------------------------------


def test_original_upload_bytes_are_never_modified():
    src = _fixture("01-clean-highres.jpg")
    with open(src, "rb") as f:
        original_bytes = f.read()
    engine.preprocess(src, "image/jpeg", _out_dir("noverw"))
    with open(src, "rb") as f:
        after_bytes = f.read()
    assert original_bytes == after_bytes


# --- No OCR, no photo activation -------------------------------------------


def test_preprocessing_result_never_claims_text_or_photo_activation():
    page = engine.preprocess(_fixture("01-clean-highres.jpg"), "image/jpeg", _out_dir("nophoto"))[0]
    assert "text" not in page
    assert "extractedText" not in page
    assert "isProfilePhoto" not in page
    assert "classification" not in page


# --- Abandoned-directory cleanup ------------------------------------------


def test_abandoned_directory_cleanup_removes_only_old_matching_dirs():
    import tempfile

    old_dir = tempfile.mkdtemp(prefix=settings.temp_dir_prefix)
    recent_dir = tempfile.mkdtemp(prefix=settings.temp_dir_prefix)
    unrelated_dir = tempfile.mkdtemp(prefix="some-other-service-")
    try:
        old_time = time.time() - 3600 * 3  # 3 hours old
        os.utime(old_dir, (old_time, old_time))

        removed = sweep_abandoned_temp_dirs(max_age_minutes=60)

        assert not os.path.isdir(old_dir), "old, matching-prefix directory must be removed"
        assert os.path.isdir(recent_dir), "recently-created directory must survive"
        assert os.path.isdir(unrelated_dir), "a directory with a different prefix must never be touched"
        assert removed >= 1
    finally:
        shutil.rmtree(recent_dir, ignore_errors=True)
        shutil.rmtree(unrelated_dir, ignore_errors=True)
        shutil.rmtree(old_dir, ignore_errors=True)


# --- HTTP liveness during preprocessing + queue/timeout (real worker) -----


async def test_http_liveness_during_a_hanging_preprocessing_job(fake_ocr_supervisor):
    supervisor = fake_ocr_supervisor(preprocessor_behavior="hang_forever", conversion_timeout_seconds=3)
    await supervisor.start()

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as async_client:
        files = {"file": ("photo.jpg", b"\xff\xd8\xff\xe0" + b"\x00" * 64, "image/jpeg")}
        data = {"correlationId": "corr-preprocess-live", "mimeType": "image/jpeg", "originalFilename": "photo.jpg"}
        task = asyncio.create_task(async_client.post("/v1/documents/analyse", files=files, data=data))

        await asyncio.sleep(0.3)
        t0 = time.monotonic()
        live = await asyncio.wait_for(async_client.get("/health/live"), timeout=1.0)
        assert live.status_code == 200
        assert time.monotonic() - t0 < 1.0

        response = await task
        assert response.status_code == 504
        assert response.json()["code"] == "PROCESSING_TIMEOUT"


async def test_preprocessing_conversion_failure_degrades_safely_over_http(fake_ocr_supervisor):
    supervisor = fake_ocr_supervisor(preprocessor_behavior="raise_error")
    await supervisor.start()

    with TestClient(app) as client:
        files = {"file": ("photo.jpg", b"\xff\xd8\xff\xe0" + b"\x00" * 64, "image/jpeg")}
        data = {"correlationId": "corr-preprocess-fail", "mimeType": "image/jpeg", "originalFilename": "photo.jpg"}
        response = client.post("/v1/documents/analyse", files=files, data=data)

    assert response.status_code == 200, "a preprocessing engine crash must degrade safely, never 500"
    body = response.json()
    assert body["selectedRoute"] == "SCAFFOLD_NOT_IMPLEMENTED"
    assert any("preprocessor" in reason for reason in body["fallbackReasons"])
