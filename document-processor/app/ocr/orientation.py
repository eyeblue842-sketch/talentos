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
    applied_degrees: int
    confidence: float | None
    uncertain: bool
    method: str = "paddleocr_doc_orientation_classifier"

    def as_dict(self) -> dict:
        return {
            "detectedDegrees": self.detected_degrees,
            "appliedDegrees": self.applied_degrees,
            "confidence": self.confidence,
            "uncertain": self.uncertain,
            "method": self.method,
        }


def decide_orientation(raw_result: dict | None, confidence_threshold: float) -> OrientationDecision:
    """`raw_result` is the extracted classifier output, already normalised
    by the caller into {"degrees": int, "confidence": float | None} -- or
    None if no classifier result could be obtained at all (submodule
    disabled, unavailable, or its output couldn't be parsed into a form
    this function trusts). The None case and the low-confidence case take
    the exact same SAFE path: never fabricate a result, never apply an
    untrusted rotation -- preserve the original image, report uncertainty."""
    if raw_result is None:
        return OrientationDecision(detected_degrees=0, applied_degrees=0, confidence=None, uncertain=True)

    degrees = raw_result.get("degrees")
    confidence = raw_result.get("confidence")

    if degrees not in _VALID_DEGREES:
        return OrientationDecision(detected_degrees=0, applied_degrees=0, confidence=confidence, uncertain=True)

    if confidence is None or confidence < confidence_threshold:
        # Detected but not trusted enough to act on: still report what was
        # detected (a useful signal for a human reviewer) without rotating.
        return OrientationDecision(detected_degrees=degrees, applied_degrees=0, confidence=confidence, uncertain=True)

    return OrientationDecision(detected_degrees=degrees, applied_degrees=degrees, confidence=confidence, uncertain=False)


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
