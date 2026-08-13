"""Real OpenCV geometric correction: page-boundary detection, perspective
correction, and deskew. Every function here either returns a genuine
result plus a confidence signal, or returns None/0.0 honestly when it
can't find a reliable answer -- none of these guess silently.
"""
from __future__ import annotations

import cv2
import numpy as np


def detect_page_boundary(gray: np.ndarray, min_area_fraction: float = 0.25) -> np.ndarray | None:
    """Looks for the largest roughly-quadrilateral contour in the image
    -- the page edge against a background, for a photographed document.
    Returns the 4 corner points (float32, shape (4, 2)) if found and
    plausible (at least `min_area_fraction` of the frame), else None.
    None is a real, expected outcome (e.g. the page fills the entire
    frame with no visible background/border, or the shot is too close
    to see an edge) -- callers must treat it as "boundary not found",
    not retry with different parameters."""
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 50, 150)
    edges = cv2.dilate(edges, np.ones((3, 3), np.uint8), iterations=1)

    contours, _ = cv2.findContours(edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None

    frame_area = gray.shape[0] * gray.shape[1]
    best_quad = None
    best_area = 0.0

    for contour in contours:
        area = cv2.contourArea(contour)
        if area < frame_area * min_area_fraction or area <= best_area:
            continue
        perimeter = cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, 0.02 * perimeter, True)
        if len(approx) == 4 and cv2.isContourConvex(approx):
            best_quad = approx.reshape(4, 2).astype(np.float32)
            best_area = area

    return best_quad


def _order_corners(points: np.ndarray) -> np.ndarray:
    """Returns corners ordered [top-left, top-right, bottom-right,
    bottom-left] regardless of the order findContours produced them in."""
    ordered = np.zeros((4, 2), dtype=np.float32)
    total = points.sum(axis=1)
    ordered[0] = points[np.argmin(total)]  # smallest x+y -> top-left
    ordered[2] = points[np.argmax(total)]  # largest x+y -> bottom-right
    diff = np.diff(points, axis=1).flatten()
    ordered[1] = points[np.argmin(diff)]  # smallest y-x -> top-right
    ordered[3] = points[np.argmax(diff)]  # largest y-x -> bottom-left
    return ordered


def correct_perspective(image_bgr: np.ndarray, corners: np.ndarray) -> np.ndarray:
    """Warps the quadrilateral region defined by `corners` (as returned
    by detect_page_boundary) to a flat, axis-aligned rectangle. The
    output size is derived from the corner distances themselves (the
    longer of the two width/height estimates on each side), not a fixed
    constant, so aspect ratio is preserved rather than forced."""
    ordered = _order_corners(corners)
    (tl, tr, br, bl) = ordered

    width_a = float(np.linalg.norm(br - bl))
    width_b = float(np.linalg.norm(tr - tl))
    max_width = max(int(width_a), int(width_b), 1)

    height_a = float(np.linalg.norm(tr - br))
    height_b = float(np.linalg.norm(tl - bl))
    max_height = max(int(height_a), int(height_b), 1)

    destination = np.array(
        [[0, 0], [max_width - 1, 0], [max_width - 1, max_height - 1], [0, max_height - 1]],
        dtype=np.float32,
    )
    transform = cv2.getPerspectiveTransform(ordered, destination)
    return cv2.warpPerspective(image_bgr, transform, (max_width, max_height))


def detect_skew_angle(gray: np.ndarray) -> float:
    """Binarises (Otsu) and uses the minimum-area bounding rectangle of
    all foreground (text/content) pixels to estimate rotation. Returns
    degrees in [-45, 45] -- a positive value means the content is
    rotated counter-clockwise and should be rotated clockwise (negative
    angle passed to deskew) to correct it, matching cv2's rotation
    matrix sign convention. Returns 0.0 (no correction) if there isn't
    enough foreground content to get a meaningful bounding box, rather
    than guessing from noise."""
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    coords = cv2.findNonZero(binary)
    if coords is None or len(coords) < 50:
        return 0.0
    angle = cv2.minAreaRect(coords)[-1]
    # cv2.minAreaRect's angle convention varies by OpenCV version/shape
    # orientation; normalise into [-45, 45] so downstream rotation is
    # always a "small correction", never an accidental 90-degree flip.
    if angle < -45:
        angle = 90 + angle
    if angle > 45:
        angle = angle - 90
    return float(angle)


def deskew(image_bgr: np.ndarray, angle: float) -> np.ndarray:
    if abs(angle) < 0.05:
        return image_bgr
    (h, w) = image_bgr.shape[:2]
    center = (w // 2, h // 2)
    matrix = cv2.getRotationMatrix2D(center, angle, 1.0)
    return cv2.warpAffine(image_bgr, matrix, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
