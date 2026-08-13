"""Orchestrates the Step 5 preprocessing pipeline: loads a page image
(from a raw image file or a rendered PDF page), applies a bounded set of
real corrections, scores the result, and writes the final OCR-ready
image to the job's isolated temp directory.

Every transformation is measured, not blindly applied: each stage
records whether it ran and, where meaningful, a before/after quality
delta. A transformation that would make quality worse is rolled back
rather than applied -- this is checked directly (re-scoring after
enhancement and comparing), not assumed.

This module never claims to have read/parsed candidate text -- it
produces cleaned images and quality metadata only.
"""
from __future__ import annotations

import os
import time
import uuid

import cv2
import numpy as np
from PIL import Image

from app.preprocessing import geometry, quality
from app.preprocessing.exif import apply_exif_orientation, strip_metadata
from app.preprocessing.quality_policy import decide_quality


def _pil_to_bgr(image: Image.Image) -> np.ndarray:
    rgb = image.convert("RGB")
    return cv2.cvtColor(np.array(rgb), cv2.COLOR_RGB2BGR)


def _bgr_to_pil(image_bgr: np.ndarray) -> Image.Image:
    rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
    return Image.fromarray(rgb)


def _score_all(image_bgr: np.ndarray, min_resolution_dimension: int) -> dict:
    gray = quality.to_grayscale(image_bgr)
    illumination = quality.measure_illumination(gray)
    scores = {
        "blurScore": quality.measure_blur(gray),
        "contrastScore": quality.measure_contrast(gray),
        "illuminationScore": illumination["evenness"],
        "meanBrightness": illumination["meanBrightness"],
        "glareScore": quality.measure_glare(gray),
        "resolutionScore": quality.measure_resolution_score(image_bgr.shape[1], image_bgr.shape[0], min_resolution_dimension),
    }
    scores["overallScore"] = quality.overall_quality_score(scores)
    return scores


def _conservative_contrast_enhance(image_bgr: np.ndarray) -> np.ndarray:
    """CLAHE (contrast-limited adaptive histogram equalisation) on the
    luminance channel only -- deliberately mild (clipLimit=2.0, the
    commonly-cited conservative default) so it cannot introduce the kind
    of harsh, blotchy over-enhancement a naive global histogram
    equalisation would. Colour is preserved (only L in LAB is touched)."""
    lab = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2LAB)
    l_channel, a_channel, b_channel = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced_l = clahe.apply(l_channel)
    merged = cv2.merge((enhanced_l, a_channel, b_channel))
    return cv2.cvtColor(merged, cv2.COLOR_LAB2BGR)


def preprocess_page(
    image_bgr: np.ndarray,
    *,
    page_number: int,
    source_type: str,
    output_dir: str,
    min_resolution_dimension: int,
    apply_geometry_correction: bool,
) -> dict:
    """Runs the full stage sequence against one already-loaded page
    image (BGR numpy array) and writes the final image to `output_dir`.
    Returns a plain dict matching the canonical per-page preprocessing
    schema (see app/schemas.py's PagePreprocessingResult)."""
    started_at = time.monotonic()
    original_h, original_w = image_bgr.shape[:2]
    transformations: list[str] = []
    warnings: list[str] = []
    current = image_bgr

    skew_angle = 0.0
    crop_applied = False
    perspective_applied = False

    if apply_geometry_correction:
        # Page-boundary/perspective correction only makes sense for a
        # photographed image (a page against some background) -- a
        # rendered PDF page already fills its own canvas with no
        # background to distinguish, so this is gated separately from
        # deskew below, which is safe and useful for either source type.
        gray = quality.to_grayscale(current)
        boundary = geometry.detect_page_boundary(gray)
        if boundary is not None:
            h, w = gray.shape
            touches_edge = (
                np.any(boundary[:, 0] <= 1) or np.any(boundary[:, 0] >= w - 2)
                or np.any(boundary[:, 1] <= 1) or np.any(boundary[:, 1] >= h - 2)
            )
            if touches_edge:
                warnings.append("DOCUMENT_CUT_OFF")
            current = geometry.correct_perspective(current, boundary)
            perspective_applied = True
            crop_applied = True
            transformations.append("perspective_correction")
            transformations.append("crop")
        else:
            warnings.append("PAGE_BOUNDARY_NOT_FOUND")

    gray_after_crop = quality.to_grayscale(current)
    skew_angle = geometry.detect_skew_angle(gray_after_crop)
    if abs(skew_angle) >= 0.3:
        current = geometry.deskew(current, skew_angle)
        transformations.append("deskew")

    scores_before_enhance = _score_all(current, min_resolution_dimension)

    enhancement_applied = False
    if scores_before_enhance["contrastScore"] < 0.35:
        candidate = _conservative_contrast_enhance(current)
        candidate_scores = _score_all(candidate, min_resolution_dimension)
        if candidate_scores["overallScore"] > scores_before_enhance["overallScore"]:
            current = candidate
            enhancement_applied = True
            transformations.append("contrast_enhancement")
        # else: rolled back -- enhancement measured worse, original kept.

    final_scores = _score_all(current, min_resolution_dimension)
    decision, quality_warnings = decide_quality(final_scores)
    warnings.extend(w for w in quality_warnings if w not in warnings)

    os.makedirs(output_dir, exist_ok=True)
    artifact_name = f"page-{page_number}-{uuid.uuid4().hex}.png"
    artifact_path = os.path.join(output_dir, artifact_name)
    cv2.imwrite(artifact_path, current)

    duration_ms = int((time.monotonic() - started_at) * 1000)

    return {
        "pageNumber": page_number,
        "sourceType": source_type,
        "originalWidthPx": original_w,
        "originalHeightPx": original_h,
        "outputWidthPx": int(current.shape[1]),
        "outputHeightPx": int(current.shape[0]),
        "colorMode": "BGR",
        "skewAngleDegrees": round(skew_angle, 2),
        "cropApplied": crop_applied,
        "perspectiveCorrectionApplied": perspective_applied,
        "blurScore": round(final_scores["blurScore"], 2),
        "contrastScore": round(final_scores["contrastScore"], 3),
        "illuminationScore": round(final_scores["illuminationScore"], 3),
        "glareScore": round(final_scores["glareScore"], 3),
        "resolutionScore": round(final_scores["resolutionScore"], 3),
        "overallQualityScore": round(final_scores["overallScore"], 3),
        "transformationsApplied": transformations,
        "enhancementApplied": enhancement_applied,
        "warnings": warnings,
        "qualityDecision": decision.value,
        "processingDurationMs": duration_ms,
        # Internal-only: the artifact path never leaves this process --
        # analyse.py strips it before building the HTTP response (Step 5
        # closure requirement: no filesystem paths in the API response).
        "_artifactPath": artifact_path,
    }


def load_image_file(file_path: str) -> np.ndarray:
    """Loads a JPEG/PNG file, applying EXIF orientation correction and
    stripping metadata before any further processing -- both happen here
    (not as separate pipeline "stages" with their own image round-trip)
    since Pillow is already the tool doing the initial decode.

    validate_image_dimensions() (called before this, in the engine) only
    reads the header -- it cannot catch a file that has a well-formed
    header but fails partway through actual pixel decoding (e.g. a
    truncated JPEG). image.load() is what triggers that decode, so it is
    wrapped here specifically -- confirmed necessary by reproduction: an
    unwrapped truncated-JPEG fixture raised a raw OSError that reached
    the worker's generic exception handler instead of a classified,
    safe ValidationError.
    """
    from app.security import ValidationError

    try:
        with Image.open(file_path) as image:
            image.load()
            corrected, _ = apply_exif_orientation(image)
            clean = strip_metadata(corrected)
            return _pil_to_bgr(clean)
    except ValidationError:
        raise
    except Exception as error:
        raise ValidationError("IMAGE_CORRUPT_OR_UNREADABLE", "Image could not be decoded.", retryable=False) from error
