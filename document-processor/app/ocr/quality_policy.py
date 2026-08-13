"""Step 6 OCR quality policy: explicit rules for scenarios the engine
cannot resolve on its own -- what confidence counts as usable, and what
an empty page means. Kept as pure functions over plain dicts so they are
testable without the real PaddleOCR engine installed.
"""
from __future__ import annotations


def mean_confidence(text_blocks: list[dict]) -> float | None:
    scores = [block["confidence"] for block in text_blocks if block.get("confidence") is not None]
    if not scores:
        return None
    return sum(scores) / len(scores)


def is_empty_output(text_blocks: list[dict]) -> bool:
    return len(text_blocks) == 0 or all(not block.get("text", "").strip() for block in text_blocks)


def is_low_confidence_page(mean_confidence_value: float | None, min_confidence: float) -> bool:
    return mean_confidence_value is None or mean_confidence_value < min_confidence
