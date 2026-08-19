"""Step 6 gross-orientation decision policy.

Real orientation DETECTION is PaddleOCR's own dedicated document-
orientation classifier (PP-LCNet_x1_0_doc_ori, a real 4-way 0/90/180/270
model shipped as part of the PP-OCRv5 pipeline, enabled via
`use_doc_orientation_classify=True`) -- this module does not reimplement
that detection. What it owns is the DECISION: given a raw classifier
result, decide whether to trust and apply it, using a confidence
threshold. It deliberately never rotates because "OCR found more text
after rotating" -- that conflates two different signals and can rotate a
page that was already correctly oriented, just because OCR happened to
transcribe a few more characters one way. That comparison method was
explicitly rejected for this step.
"""
from __future__ import annotations

from dataclasses import dataclass

_VALID_DEGREES = {0, 90, 180, 270}


@dataclass(frozen=True)
class OrientationDecision:
    detected_degrees: int
    correction_degrees: int
    applied_degrees: int
    classifier_confidence: float | None
    uncertain: bool
    correction_source: str = "none"
    method: str = "paddleocr_doc_orientation_classifier"

    def as_dict(self) -> dict:
        return {
            "detectedDegrees": self.detected_degrees,
            "correctionDegrees": self.correction_degrees,
            "appliedDegrees": self.applied_degrees,
            "classifierConfidence": self.classifier_confidence,
            "uncertain": self.uncertain,
            "correctionSource": self.correction_source,
            "method": self.method,
        }


def correction_degrees_for_detected(degrees: int) -> int:
    """Returns the clockwise rotation Careeriz would apply to make a page
    upright for a given detected orientation class. Example: a page
    detected as 90 degrees requires a 270-degree clockwise correction
    (equivalent to a 90-degree counter-clockwise rotation)."""
    if degrees not in _VALID_DEGREES:
        raise ValueError(f"unsupported detected orientation degrees: {degrees}")
    return (360 - degrees) % 360


def decide_orientation(raw_result: dict | None, confidence_threshold: float) -> OrientationDecision:
    """`raw_result` is the extracted classifier output, already normalised
    by the caller into {"degrees": int, "confidence": float | None} -- or
    None if no classifier result could be obtained at all (submodule
    disabled, unavailable, or its output couldn't be parsed into a form
    this function trusts). The None case and the low-confidence case take
    the exact same SAFE path: never fabricate a result, never apply an
    untrusted rotation -- preserve the original image, report uncertainty."""
    if raw_result is None:
        return OrientationDecision(
            detected_degrees=0,
            correction_degrees=0,
            applied_degrees=0,
            classifier_confidence=None,
            uncertain=True,
            correction_source="none",
        )

    degrees = raw_result.get("degrees")
    confidence = raw_result.get("confidence")
    internally_corrected = bool(raw_result.get("internallyCorrected"))

    if degrees not in _VALID_DEGREES:
        return OrientationDecision(
            detected_degrees=0,
            correction_degrees=0,
            applied_degrees=0,
            classifier_confidence=confidence,
            uncertain=True,
            correction_source="none",
        )

    correction_degrees = correction_degrees_for_detected(degrees)

    if internally_corrected and correction_degrees != 0:
        return OrientationDecision(
            detected_degrees=degrees,
            correction_degrees=correction_degrees,
            applied_degrees=correction_degrees,
            classifier_confidence=confidence,
            uncertain=confidence is None or confidence < confidence_threshold,
            correction_source="paddle_internal_doc_preprocessor",
        )

    if confidence is None or confidence < confidence_threshold:
        # Detected but not trusted enough to act on: still report what was
        # detected (a useful signal for a human reviewer) without rotating.
        return OrientationDecision(
            detected_degrees=degrees,
            correction_degrees=correction_degrees,
            applied_degrees=0,
            classifier_confidence=confidence,
            uncertain=True,
            correction_source="none",
        )

    return OrientationDecision(
        detected_degrees=degrees,
        correction_degrees=correction_degrees,
        applied_degrees=correction_degrees,
        classifier_confidence=confidence,
        uncertain=False,
        correction_source="careeriz_manual_postprocess",
    )


def rotate_degrees_cv(image_bgr, degrees: int):
    """Applies a trusted, confident 0/90/180/270 rotation via OpenCV.
    cv2.rotate (not a manual array transpose) correctly handles the
    90/270 cases including colour-plane layout; 180 is a full flip on
    both axes."""
    if degrees == 0:
        return image_bgr

    import cv2

    if degrees == 90:
        return cv2.rotate(image_bgr, cv2.ROTATE_90_CLOCKWISE)
    if degrees == 180:
        return cv2.rotate(image_bgr, cv2.ROTATE_180)
    if degrees == 270:
        return cv2.rotate(image_bgr, cv2.ROTATE_90_COUNTERCLOCKWISE)
    raise ValueError(f"unsupported rotation degrees: {degrees}")
