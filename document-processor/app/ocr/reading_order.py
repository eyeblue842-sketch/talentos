"""Step 6: reading-order reconstruction and duplicate/overlap suppression
for raw OCR line results. PaddleOCR returns lines in a device/scan order
that is not guaranteed to already be human reading order for arbitrary
layouts (e.g. a genuinely two-column resume) -- this reconstructs it
independently rather than trusting the engine's own line ordering as
final. Pure functions over plain dicts: {"box": [[x,y]x4], "confidence":
float, ...}, no PaddleOCR dependency, so this is fully unit-testable
without the real engine installed.
"""
from __future__ import annotations


def _box_bounds(box):
    xs = [p[0] for p in box]
    ys = [p[1] for p in box]
    return min(xs), min(ys), max(xs), max(ys)


def deduplicate_overlapping_lines(lines: list[dict], iou_threshold: float = 0.6) -> list[dict]:
    """When two lines overlap heavily (IoU above threshold -- PaddleOCR
    can occasionally emit a duplicate/near-duplicate detection for the
    same text region), keep only the higher-confidence one rather than
    letting both survive into the canonical output as separate blocks."""

    def iou(a, b):
        ax0, ay0, ax1, ay1 = _box_bounds(a["box"])
        bx0, by0, bx1, by1 = _box_bounds(b["box"])
        ix0, iy0 = max(ax0, bx0), max(ay0, by0)
        ix1, iy1 = min(ax1, bx1), min(ay1, by1)
        if ix1 <= ix0 or iy1 <= iy0:
            return 0.0
        intersection = (ix1 - ix0) * (iy1 - iy0)
        area_a = (ax1 - ax0) * (ay1 - ay0)
        area_b = (bx1 - bx0) * (by1 - by0)
        union = area_a + area_b - intersection
        return intersection / union if union > 0 else 0.0

    kept: list[dict] = []
    for line in sorted(lines, key=lambda entry: entry["confidence"], reverse=True):
        if any(iou(line, other) >= iou_threshold for other in kept):
            continue
        kept.append(line)
    return kept


def reconstruct_reading_order(lines: list[dict], column_gap_ratio: float = 0.06) -> list[dict]:
    """Sorts lines into reading order: primarily top-to-bottom, splitting
    into left/right columns first when the page shows a genuine
    two-column gap (the largest x-center gap between lines, roughly in
    the middle third of the page) -- otherwise falls back to simple
    row-then-x ordering, which is also correct for the common
    single-column case. Returns new dicts with a "readingOrder" key
    added; does not mutate the input list.
    """
    if not lines:
        return []

    bounds = [_box_bounds(line["box"]) for line in lines]
    page_left = min(b[0] for b in bounds)
    page_right = max(b[2] for b in bounds)
    page_width = max(page_right - page_left, 1.0)

    centers_x = sorted((b[0] + b[2]) / 2 for b in bounds)
    # A real column gap: the largest gap between consecutive sorted
    # x-centers that falls within the middle third of the page width -- a
    # gap at the very edge is just where text happens to end, not a
    # column boundary.
    best_gap = 0.0
    best_gap_x = None
    for left_x, right_x in zip(centers_x, centers_x[1:]):
        gap = right_x - left_x
        midpoint = (left_x + right_x) / 2
        if page_left + page_width * 0.3 <= midpoint <= page_left + page_width * 0.7 and gap > best_gap:
            best_gap = gap
            best_gap_x = midpoint

    is_two_column = best_gap_x is not None and best_gap >= page_width * column_gap_ratio

    def sort_key(index: int):
        x0, y0, x1, y1 = bounds[index]
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        column = 1 if (is_two_column and cx >= best_gap_x) else 0
        # Row bucketing: group lines whose vertical centers are close
        # (within roughly the line's own height) so near-neighbours on
        # the same visual row don't get separated purely by sub-pixel y
        # jitter between adjacent detections.
        row_bucket = round(cy / max((y1 - y0), 1.0))
        return (column, row_bucket, cy, x0)

    order = sorted(range(len(lines)), key=sort_key)
    return [{**lines[i], "readingOrder": position} for position, i in enumerate(order)]
