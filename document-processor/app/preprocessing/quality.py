"""Real, measured image-quality scoring -- OpenCV/numpy, no ML models,
nothing that needs "warming up". Every score is a plain float derived
from actual pixel statistics of the image passed in, not an estimate or
a placeholder; thresholds for what counts as "acceptable" live in
quality_policy.py, kept separate from the raw measurement so a threshold
can be recalibrated without touching how a score is computed.

All functions take a grayscale numpy array (uint8, 2D) unless noted, and
return a float score in the documented range. None of these load a
model or hit the filesystem -- pure array math, safe to call from any
process without warm-up.
"""
from __future__ import annotations

import cv2
import numpy as np


def to_grayscale(image_bgr: np.ndarray) -> np.ndarray:
    if image_bgr.ndim == 2:
        return image_bgr
    return cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)


def measure_blur(gray: np.ndarray) -> float:
    """Variance of the Laplacian -- the standard, well-documented
    sharpness proxy (Pech-Pacheco et al., 2000). Higher = sharper. Not
    normalised to a fixed 0-1 range: it is legitimately scale- and
    content-dependent (a blank page and a dense paragraph have different
    natural variance even both in sharp focus), so quality_policy.py's
    threshold is calibrated against this raw value, not a normalised one."""
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def measure_contrast(gray: np.ndarray) -> float:
    """RMS contrast normalised to roughly 0-1 (127.5 is the theoretical
    max standard deviation for an 8-bit image split evenly between 0 and
    255)."""
    return float(min(1.0, gray.std() / 127.5))


def measure_illumination(gray: np.ndarray, grid: int = 4) -> dict:
    """Splits the image into a grid x grid block layout and compares
    block-mean brightness. High variance between blocks indicates uneven
    lighting (a shadow across part of the page, or a bright glare region
    elsewhere) rather than uniform illumination. Returns both the overall
    mean brightness (0-255) and a 0-1 "evenness" score (1.0 = perfectly
    even lighting across all blocks)."""
    h, w = gray.shape
    block_h, block_w = max(1, h // grid), max(1, w // grid)
    block_means = []
    for by in range(grid):
        for bx in range(grid):
            block = gray[by * block_h : (by + 1) * block_h, bx * block_w : (bx + 1) * block_w]
            if block.size:
                block_means.append(float(block.mean()))
    if not block_means:
        return {"meanBrightness": float(gray.mean()), "evenness": 1.0}
    block_means_arr = np.array(block_means)
    # Normalise the between-block std by a plausible max (half the
    # 0-255 range) so evenness lands roughly in 0-1 without clipping
    # away real signal for extreme cases.
    evenness = float(max(0.0, 1.0 - (block_means_arr.std() / 127.5)))
    return {"meanBrightness": float(gray.mean()), "evenness": evenness}


def measure_glare(gray: np.ndarray, highlight_threshold: int = 248, dominant_blob_fraction: float = 0.5) -> float:
    """Fraction of near-white pixels, EXCLUDING the largest connected
    bright region if it alone covers more than `dominant_blob_fraction`
    of the frame.

    That exclusion is not a cosmetic tweak -- an earlier version of this
    function measured plain "fraction of near-white pixels" directly and
    was caught misfiring on ordinary white-background document pages
    during this step's own benchmark run: a normal page is MOSTLY white
    background by area, so a naive threshold flagged nearly every clean
    document as "glare". Real glare is a comparatively small, localised
    blown-out spot on an otherwise varied page -- treating one single
    dominant bright region as "this is the page background", not "this
    is glare", is what actually distinguishes the two cases.
    """
    if gray.size == 0:
        return 0.0
    highlight_mask = (gray >= highlight_threshold).astype(np.uint8)
    total_highlight = int(highlight_mask.sum())
    if total_highlight == 0:
        return 0.0

    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(highlight_mask, connectivity=8)
    if num_labels <= 1:  # pragma: no cover - no foreground component found despite total_highlight > 0
        return float(total_highlight / gray.size)

    largest_area = int(stats[1:, cv2.CC_STAT_AREA].max())
    if largest_area / gray.size > dominant_blob_fraction:
        total_highlight -= largest_area

    return float(max(0.0, total_highlight) / gray.size)


def measure_resolution_score(width_px: int, height_px: int, min_dimension_px: int) -> float:
    """A page image below `min_dimension_px` on its shorter side is
    unlikely to have enough detail for reliable OCR later -- this is a
    pixel-dimension proxy, not a true DPI measurement (a photograph
    carries no print-DPI metadata), documented as such rather than
    presented as more precise than it is."""
    shorter_side = min(width_px, height_px)
    return float(min(1.0, shorter_side / max(1, min_dimension_px)))


def overall_quality_score(scores: dict) -> float:
    """A single 0-1 summary, a simple weighted mean of the individual
    dimensions that matter most for downstream OCR readability. Blur and
    contrast matter most (directly determine whether text edges are
    recoverable); illumination evenness and resolution matter somewhat
    less; glare is penalised more lightly since conservative enhancement
    can sometimes recover glare-affected regions.
    """
    blur_component = min(1.0, scores["blurScore"] / 150.0)  # ~150 is a reasonably sharp real photo in practice
    weights = {
        "blur": (blur_component, 0.35),
        "contrast": (scores["contrastScore"], 0.25),
        "illumination": (scores["illuminationScore"], 0.15),
        "resolution": (scores["resolutionScore"], 0.15),
        "glare": (1.0 - scores["glareScore"], 0.10),
    }
    total_weight = sum(w for _, w in weights.values())
    weighted = sum(v * w for v, w in weights.values())
    return float(weighted / total_weight) if total_weight else 0.0
