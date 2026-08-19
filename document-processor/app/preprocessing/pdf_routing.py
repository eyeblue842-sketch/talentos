"""Page-level assessment for scanned/hybrid PDFs: for each page, decide
whether it already has usable digital text (stays on the existing
Docling/native route, never rendered to an image) or needs to be
rendered and preprocessed for a future OCR step (Step 6 -- this module
never runs OCR itself).

Uses pypdfium2 directly (already a transitive Docling dependency, real
PDFium bindings) rather than trusting Docling's own page metadata for
this decision -- this needs to run standalone, before/independently of
whether Docling successfully converts the document at all.
"""
from __future__ import annotations

import cv2
import numpy as np
import pypdfium2 as pdfium

# A page with fewer extractable characters than this, relative to its
# area, is treated as "no usable digital text" even if pdfium found a
# handful of stray characters (e.g. a page number, or OCR artifacts left
# in a previously-scanned-and-OCRed PDF that produced a few garbled
# characters) -- not enough for Docling's own text extraction to be
# reliable on its own.
_MIN_CHARS_FOR_DIGITAL_TEXT = 40
# Below this, more chars than the digital-text floor but still sparse
# relative to a full page of resume content, flagged as "low quality"
# rather than confidently good.
_LOW_QUALITY_CHAR_THRESHOLD = 200


def assess_pdf_pages(file_path: str, render_dpi: int, max_rendered_pixels_per_document: int) -> list[dict]:
    """Returns one assessment dict per page (1-indexed pageNumber),
    never renders more pixels total than max_rendered_pixels_per_document
    -- pages beyond that budget are marked RENDER_BUDGET_EXCEEDED and
    left unrendered rather than silently expanding memory/disk use."""
    results = []
    rendered_pixels_so_far = 0
    scale = render_dpi / 72.0  # pypdfium2 scale is relative to the PDF's 1/72in canvas unit

    pdf = pdfium.PdfDocument(file_path)
    try:
        for index in range(len(pdf)):
            page = pdf[index]
            try:
                width_pt, height_pt = page.get_size()
                rotation = page.get_rotation()
                textpage = page.get_textpage()
                try:
                    char_count = textpage.count_chars()
                finally:
                    textpage.close()

                render_width = int(width_pt * scale)
                render_height = int(height_pt * scale)
                render_pixels = render_width * render_height

                if char_count >= _LOW_QUALITY_CHAR_THRESHOLD:
                    text_quality = "GOOD_DIGITAL_TEXT"
                    planned_route = "NATIVE_DOCLING"
                elif char_count >= _MIN_CHARS_FOR_DIGITAL_TEXT:
                    text_quality = "LOW_QUALITY_NATIVE_TEXT"
                    planned_route = "NATIVE_WITH_OCR_BACKUP"
                else:
                    text_quality = "IMAGE_ONLY"
                    planned_route = "RENDER_FOR_OCR"

                render_performed = False
                warnings = []
                if planned_route != "NATIVE_DOCLING":
                    if rendered_pixels_so_far + render_pixels > max_rendered_pixels_per_document:
                        warnings.append("RENDER_BUDGET_EXCEEDED")
                    else:
                        rendered_pixels_so_far += render_pixels
                        render_performed = True

                results.append(
                    {
                        "pageNumber": index + 1,
                        "charCount": char_count,
                        "textQuality": text_quality,
                        "plannedRoute": planned_route,
                        "rotationDegrees": rotation,
                        "renderWidthPx": render_width,
                        "renderHeightPx": render_height,
                        "renderPerformed": render_performed,
                        "warnings": warnings,
                    }
                )
            finally:
                page.close()
    finally:
        pdf.close()
    return results


def render_pdf_page_to_bgr(file_path: str, page_number_1_indexed: int, render_dpi: int) -> np.ndarray:
    """Renders exactly one page (1-indexed) to a BGR numpy array, for
    hand-off into the same image-preprocessing pipeline used for
    directly-uploaded JPEG/PNG files -- a rendered scanned PDF page and
    a photographed page image go through identical downstream logic."""
    scale = render_dpi / 72.0
    pdf = pdfium.PdfDocument(file_path)
    try:
        page = pdf[page_number_1_indexed - 1]
        try:
            bitmap = page.render(scale=scale)
            pil_image = bitmap.to_pil()
            rgb = pil_image.convert("RGB")
            return cv2.cvtColor(np.array(rgb), cv2.COLOR_RGB2BGR)
        finally:
            page.close()
    finally:
        pdf.close()
