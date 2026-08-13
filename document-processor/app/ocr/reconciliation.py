"""Step 6 native-vs-OCR reconciliation. A pure decision function: given
what Docling extracted natively for a page and what OCR produced as a
candidate for the same page, decides which is authoritative WITHOUT
mutating either -- the canonical output exposes both `textBlocks` and
`ocrTextBlocks` plus this decision (PageReconciliationDecision), so
nothing is silently thrown away. Never replaces good native text with
lower-confidence OCR just because OCR ran.

Decision order:
  1. No native text exists for this page (already IMAGE_ONLY) -> OCR is
     the only source; used if it clears the confidence bar, otherwise
     flagged for review.
  2. Native text is already substantial -> keep it; OCR here was only
     ever a backup candidate for genuinely uncertain native text, not a
     routine second opinion on text that's already good.
  3. OCR clears its own confidence bar AND finds a real margin of extra
     content over the sparse native extraction (not "one extra
     character") -> use OCR.
  4. Neither source is confidently good -> keep both, flag for review;
     never assert one is right when both are shaky.
"""
from __future__ import annotations

# Below this native character count, native text is treated as
# "substantial" and OCR is not preferred over it regardless of OCR's own
# confidence -- matches pdf_routing.py's own LOW_QUALITY_CHAR_THRESHOLD
# reasoning (a page this size almost always extracted correctly).
_SUBSTANTIAL_NATIVE_CHAR_COUNT = 200

# OCR must find at least this multiple of the native char count to be
# preferred -- guards against swapping in OCR for a marginal difference.
_MEANINGFUL_CONTENT_MARGIN = 1.5


def reconcile_page(
    *,
    page: int,
    native_char_count: int,
    native_text_present: bool,
    ocr_text_blocks: list[dict],
    ocr_min_confidence: float,
) -> dict:
    if not ocr_text_blocks:
        return {
            "page": page,
            "decision": "OCR_NOT_ATTEMPTED",
            "reason": "No OCR candidate was produced for this page.",
            "nativeCharCount": native_char_count if native_text_present else None,
            "ocrMeanConfidence": None,
        }

    ocr_char_count = sum(len(block.get("text", "")) for block in ocr_text_blocks)
    scores = [block["confidence"] for block in ocr_text_blocks if block.get("confidence") is not None]
    ocr_confidence = sum(scores) / len(scores) if scores else None

    if not native_text_present:
        if ocr_confidence is not None and ocr_confidence >= ocr_min_confidence and ocr_char_count > 0:
            decision = "OCR_USED"
            reason = "No native text exists for this page; OCR is the only source and cleared the confidence bar."
        else:
            decision = "OCR_LOW_CONFIDENCE_REVIEW_REQUIRED"
            reason = "No native text exists for this page and OCR confidence did not clear the minimum bar."
        return {"page": page, "decision": decision, "reason": reason, "nativeCharCount": None, "ocrMeanConfidence": ocr_confidence}

    if native_char_count >= _SUBSTANTIAL_NATIVE_CHAR_COUNT:
        return {
            "page": page,
            "decision": "NATIVE_RETAINED",
            "reason": "Native extraction already has substantial text; OCR was only a backup candidate for genuinely uncertain pages.",
            "nativeCharCount": native_char_count,
            "ocrMeanConfidence": ocr_confidence,
        }

    ocr_confidently_better = (
        ocr_confidence is not None
        and ocr_confidence >= ocr_min_confidence
        and ocr_char_count >= native_char_count * _MEANINGFUL_CONTENT_MARGIN
    )
    if ocr_confidently_better:
        return {
            "page": page,
            "decision": "OCR_USED",
            "reason": (
                f"OCR cleared the confidence bar ({ocr_confidence:.2f}) and found meaningfully more text than the "
                f"sparse native extraction ({ocr_char_count} vs {native_char_count} chars)."
            ),
            "nativeCharCount": native_char_count,
            "ocrMeanConfidence": ocr_confidence,
        }

    return {
        "page": page,
        "decision": "BOTH_RETAINED_LOW_CONFIDENCE",
        "reason": (
            "Neither native extraction nor OCR confidently resolved this page's text; "
            "both are retained as evidence for manual review."
        ),
        "nativeCharCount": native_char_count,
        "ocrMeanConfidence": ocr_confidence,
    }
