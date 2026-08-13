"""Step 6B: REAL PaddleOCR validation -- prepared here, not executable in
the dev sandbox this was written in (no Python 3.11/Docker locally; see
docs/document-processor.md's Step 6 dependency-gate section and the Step
6B closure report for the exact runtime-availability finding).

Every test in this file is gated the same way DoclingEngine's real smoke
test (test_worker_lifecycle.py) was gated in Step 4.5: skipped unless the
real engine is genuinely importable AND explicitly enabled
(PADDLEOCR_ENABLED=true). This file is meant to run for real in the
Python 3.11 Linux container (Docker or CI) -- it deliberately does NOT
use FakeEngine anywhere; every assertion here is against the actual
PaddleOCR constructor/inference API, because that is precisely the gap
Step 6's own report identified as unverified.

Run (once a real runtime exists):
    PADDLEOCR_ENABLED=true DOCLING_ENABLED=true PREPROCESSING_ENABLED=true \\
        pytest tests/test_ocr_real_engine.py -v -s
"""
from __future__ import annotations

import json
import os
import time

import psutil
import pytest

from app.config import settings
from app.engines.paddleocr_engine import PaddleOCREngine

pytestmark = pytest.mark.anyio


@pytest.fixture
def anyio_backend():
    return "asyncio"


FIXTURES_DIR = os.path.join(os.path.dirname(__file__), "fixtures", "ocr_validation")


def _fixture(name: str) -> str:
    return os.path.join(FIXTURES_DIR, name)


def _ground_truth() -> dict:
    with open(_fixture("ground_truth.json"), encoding="utf-8") as f:
        return json.load(f)


def _real_engine_available() -> bool:
    if not settings.paddleocr_enabled:
        return False
    try:
        import paddleocr  # noqa: F401
    except ImportError:
        return False
    return PaddleOCREngine().check_availability().available


pytestmark = [
    pytest.mark.anyio,
    pytest.mark.skipif(
        not _real_engine_available(),
        reason="PADDLEOCR_ENABLED is not set or paddleocr is not installed -- real engine required, not FakeEngine",
    ),
]


# --- Levenshtein-based CER/WER ----------------------------------------------


def _levenshtein(a: list, b: list) -> int:
    if not a:
        return len(b)
    if not b:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, start=1):
        curr = [i] + [0] * len(b)
        for j, cb in enumerate(b, start=1):
            cost = 0 if ca == cb else 1
            curr[j] = min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
        prev = curr
    return prev[-1]


def character_error_rate(hypothesis: str, reference: str) -> float:
    if not reference:
        return 0.0 if not hypothesis else 1.0
    return _levenshtein(list(hypothesis), list(reference)) / len(reference)


def word_error_rate(hypothesis: str, reference: str) -> float:
    ref_words = reference.split()
    if not ref_words:
        return 0.0 if not hypothesis.split() else 1.0
    return _levenshtein(hypothesis.split(), ref_words) / len(ref_words)


def _normalize_phone(text: str) -> str:
    return "+" + "".join(ch for ch in text if ch.isdigit()) if any(ch.isdigit() for ch in text) else ""


def _extract_full_text(pages: list[dict]) -> str:
    blocks = []
    for page in pages:
        blocks.extend(block["text"] for block in page.get("textBlocks", []))
    return " ".join(blocks)


# --- Real API shape validation ----------------------------------------------


async def test_real_constructor_and_predict_produce_the_assumed_result_shape():
    """The single most important test in this file: proves
    app.engines.paddleocr_engine's `_parse_ocr_result`/
    `_parse_orientation_result` assumptions match the REAL PaddleOCR 3.x
    result object -- not a guess, not FakeEngine. If this fails, the
    adapter's parsing must be corrected against the printed real shape
    before anything else in this file can be trusted."""
    engine = PaddleOCREngine()
    availability = engine.warmup()
    assert availability.available, f"real warm-up failed: {availability.reason}"

    import cv2

    image = cv2.imread(_fixture("01-clean-scanned-resume.png"))
    lines, orientation_raw = engine._run_ocr(image)

    print("REAL PaddleOCR line count:", len(lines))
    print("REAL PaddleOCR first line:", lines[0] if lines else None)
    print("REAL orientation result:", orientation_raw)

    assert len(lines) > 0, "expected at least one detected line on a clean, high-contrast text image"
    for line in lines:
        assert isinstance(line["text"], str)
        assert isinstance(line["confidence"], float)
        assert 0.0 <= line["confidence"] <= 1.0
        assert isinstance(line["box"], list) and len(line["box"]) == 4


async def test_real_engine_handles_empty_and_malformed_input_without_crashing():
    engine = PaddleOCREngine()
    engine.warmup()

    import numpy as np

    blank = np.full((200, 200, 3), 255, dtype="uint8")
    lines, _ = engine._run_ocr(blank)
    print("blank-image line count:", len(lines))
    # Must not raise; zero or near-zero lines on a blank page is expected.


async def test_real_engine_multi_page_pdf():
    engine = PaddleOCREngine()
    engine.warmup()
    pages = engine.ocr(_fixture("12-mixed-digital-scanned.pdf"), "application/pdf", os.path.join(FIXTURES_DIR, "_out_multipage"))
    print("multi-page OCR result page count:", len(pages))
    assert isinstance(pages, list)


# --- Accuracy benchmark ------------------------------------------------------


async def test_accuracy_benchmark_against_ground_truth():
    """Computes and PRINTS (not asserts a pass/fail threshold on) CER/WER
    and field accuracy across the fixture corpus -- the numbers ARE the
    deliverable here, reported with exact denominators, not a boolean
    pass/fail. Run with -s to see the printed table."""
    ground_truth = _ground_truth()
    engine = PaddleOCREngine()
    engine.warmup()

    results = []
    for fixture_name, expected in ground_truth.items():
        if "fullTextApprox" not in expected and "fullName" not in expected:
            continue  # skip fixtures with no text ground truth (corrupt/bomb/password)
        path = _fixture(fixture_name)
        mime = "application/pdf" if fixture_name.endswith(".pdf") else ("image/png" if fixture_name.endswith(".png") else "image/jpeg")
        try:
            pages = engine.ocr(path, mime, os.path.join(FIXTURES_DIR, f"_out_{fixture_name}"))
        except Exception as error:  # noqa: BLE001 - one fixture failing must not abort the whole benchmark
            results.append({"fixture": fixture_name, "error": type(error).__name__})
            continue
        recognized = _extract_full_text(pages)
        entry = {"fixture": fixture_name, "recognizedChars": len(recognized)}
        if "fullTextApprox" in expected:
            entry["cer"] = character_error_rate(recognized, expected["fullTextApprox"])
            entry["wer"] = word_error_rate(recognized, expected["fullTextApprox"])
        if "email" in expected:
            entry["emailFound"] = expected["email"] in recognized
        if "phoneNormalized" in expected:
            entry["phoneFound"] = _normalize_phone(expected["phoneNormalized"]) in _normalize_phone(recognized)
        if "fullName" in expected:
            entry["nameFound"] = expected["fullName"] in recognized
        if "employer" in expected:
            entry["employerFound"] = expected["employer"] in recognized
        if "orientationDegrees" in expected and pages:
            entry["orientationDetected"] = pages[0].get("orientation")
        results.append(entry)

    print("\n=== Step 6B accuracy benchmark ===")
    print(f"Denominator: {len(results)} fixtures with text ground truth")
    for r in results:
        print(json.dumps(r))

    with_email = [r for r in results if "emailFound" in r]
    with_phone = [r for r in results if "phoneFound" in r]
    with_name = [r for r in results if "nameFound" in r]
    if with_email:
        print(f"Email exact-match: {sum(r['emailFound'] for r in with_email)}/{len(with_email)}")
    if with_phone:
        print(f"Phone (normalized) match: {sum(r['phoneFound'] for r in with_phone)}/{len(with_phone)}")
    if with_name:
        print(f"Full-name match: {sum(r['nameFound'] for r in with_name)}/{len(with_name)}")


# --- Orientation ---------------------------------------------------------


async def test_orientation_accuracy_across_rotations():
    engine = PaddleOCREngine()
    engine.warmup()
    ground_truth = _ground_truth()

    checked = 0
    correct = 0
    for fixture_name in ("01-clean-scanned-resume.png", "04-rotated-90.jpg", "05-rotated-180.jpg", "06-rotated-270.jpg"):
        expected_degrees = ground_truth[fixture_name]["orientationDegrees"]
        mime = "image/jpeg" if fixture_name.endswith(".jpg") else "image/png"
        job_dir = os.path.join(FIXTURES_DIR, f"_out_orient_{fixture_name}")
        pages = engine.ocr(_fixture(fixture_name), mime, job_dir)
        checked += 1
        detected = pages[0]["orientation"] if pages else None
        print(f"{fixture_name}: expected={expected_degrees} detected={detected}")
        if detected and not detected["uncertain"] and detected["appliedDegrees"] == expected_degrees:
            correct += 1

    print(f"Orientation accuracy: {correct}/{checked}")


# --- Reading order (two-column) -------------------------------------------


async def test_reading_order_accuracy_two_column():
    engine = PaddleOCREngine()
    engine.warmup()
    pages = engine.ocr(_fixture("10-two-column.png"), "image/png", os.path.join(FIXTURES_DIR, "_out_two_column"))
    ordered_text = [block["text"] for block in pages[0]["textBlocks"]]
    print("Two-column reading order:", ordered_text)
    ground_truth = _ground_truth()["10-two-column.png"]
    name_index = next((i for i, t in enumerate(ordered_text) if ground_truth["fullName"] in t), None)
    skills_index = next((i for i, t in enumerate(ordered_text) if "Skills" in t), None)
    if name_index is not None and skills_index is not None:
        print(f"left-column-first: {name_index < skills_index}")


# --- Resource measurement (real engine) -------------------------------------


async def test_real_engine_resource_measurement():
    parent = psutil.Process(os.getpid())
    parent_rss_before = parent.memory_info().rss / (1024 * 1024)

    engine = PaddleOCREngine()
    t0 = time.monotonic()
    availability = engine.warmup()
    warmup_duration = time.monotonic() - t0
    assert availability.available

    import cv2

    image = cv2.imread(_fixture("01-clean-scanned-resume.png"))

    t0 = time.monotonic()
    engine._run_ocr(image)
    cold_duration = time.monotonic() - t0

    durations = []
    rss_samples = []
    process = psutil.Process(os.getpid())
    for _ in range(20):
        t0 = time.monotonic()
        engine._run_ocr(image)
        durations.append(time.monotonic() - t0)
        rss_samples.append(process.memory_info().rss / (1024 * 1024))

    print(f"parent_rss_before_mb={parent_rss_before:.1f}")
    print(f"warmup_duration_s={warmup_duration:.2f}")
    print(f"cold_inference_duration_s={cold_duration:.3f}")
    print(f"warm_inference_durations_s={[round(d, 3) for d in durations]}")
    print(f"rss_after_each_of_20_repeats_mb={[round(r, 1) for r in rss_samples]}")
    print(f"rss_growth_mb={rss_samples[-1] - rss_samples[0]:.1f}")
