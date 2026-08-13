"""Explicit, configurable quality-decision thresholds. Deliberately
NOT claimed as final/production-calibrated -- these are informed
starting points (documented rationale per threshold below) pending real
benchmarking against a representative document corpus, per the Step 5
review's explicit instruction not to overclaim readiness here.
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class QualityDecision(str, Enum):
    ACCEPTABLE = "ACCEPTABLE"
    PREPROCESSING_RECOMMENDED = "PREPROCESSING_RECOMMENDED"
    MANUAL_REVIEW_REQUIRED = "MANUAL_REVIEW_REQUIRED"
    UNUSABLE = "UNUSABLE"


@dataclass(frozen=True)
class QualityThresholds:
    # Laplacian-variance blur score (quality.measure_blur). NOT
    # normalised -- these are raw values calibrated against this
    # service's own synthetic benchmark fixtures (see tests/fixtures),
    # not an external reference corpus.
    blur_unusable_below: float = 15.0
    blur_review_below: float = 60.0
    # RMS contrast, 0-1.
    contrast_unusable_below: float = 0.05
    contrast_review_below: float = 0.15
    # Illumination evenness, 0-1 (1.0 = perfectly even).
    illumination_review_below: float = 0.45
    # Glare fraction, 0-1 (higher = worse).
    glare_review_above: float = 0.12
    # Resolution proxy, 0-1 (quality.measure_resolution_score).
    resolution_unusable_below: float = 0.25
    resolution_review_below: float = 0.55
    # Overall weighted score, 0-1 (quality.overall_quality_score).
    overall_acceptable_at_or_above: float = 0.72
    overall_review_at_or_above: float = 0.40


DEFAULT_THRESHOLDS = QualityThresholds()


def decide_quality(scores: dict, thresholds: QualityThresholds = DEFAULT_THRESHOLDS) -> tuple[QualityDecision, list[str]]:
    """Returns (decision, warning codes). Hard per-dimension floors are
    checked first (any one of them can force UNUSABLE/MANUAL_REVIEW
    regardless of the overall weighted score -- an image can have a
    fine *average* while being unreadable for one specific, decisive
    reason, e.g. severe blur), then the overall score decides between
    the remaining bands."""
    warnings: list[str] = []

    if scores["blurScore"] < thresholds.blur_unusable_below:
        warnings.append("IMAGE_TOO_BLURRY")
        return QualityDecision.UNUSABLE, warnings
    if scores["resolutionScore"] < thresholds.resolution_unusable_below:
        warnings.append("RESOLUTION_TOO_LOW")
        return QualityDecision.UNUSABLE, warnings
    if scores["contrastScore"] < thresholds.contrast_unusable_below:
        warnings.append("PREPROCESSING_LOW_CONFIDENCE")
        return QualityDecision.UNUSABLE, warnings

    if scores["blurScore"] < thresholds.blur_review_below:
        warnings.append("IMAGE_TOO_BLURRY")
    if scores["resolutionScore"] < thresholds.resolution_review_below:
        warnings.append("RESOLUTION_TOO_LOW")
    if scores["contrastScore"] < thresholds.contrast_review_below:
        warnings.append("PREPROCESSING_LOW_CONFIDENCE")
    if scores["illuminationScore"] < thresholds.illumination_review_below:
        warnings.append("UNEVEN_ILLUMINATION")
    if scores["glareScore"] > thresholds.glare_review_above:
        warnings.append("EXCESSIVE_GLARE")

    overall = scores["overallScore"]
    if warnings or overall < thresholds.overall_review_at_or_above:
        return QualityDecision.MANUAL_REVIEW_REQUIRED, warnings
    if overall < thresholds.overall_acceptable_at_or_above:
        return QualityDecision.PREPROCESSING_RECOMMENDED, warnings
    return QualityDecision.ACCEPTABLE, warnings
