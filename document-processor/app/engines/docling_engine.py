"""Docling adapter — real extraction as of Step 4.

Scope: document layout/structure only (pages, text blocks with bounding
boxes and reading order, section labels, tables). Deliberately does NOT
attempt candidate-field extraction (name/email/phone/etc) — that
reconciliation into candidate data is Step 9's job, layered on top of this
structural output, not this module's concern.
"""
from __future__ import annotations

import os

from app.config import settings
from app.engines.base import EngineAvailability, EngineNotImplementedError, ExtractionEngine

_WARMUP_FIXTURE_PATH = os.path.join(os.path.dirname(__file__), "..", "assets", "warmup.pdf")


def _build_bounding_box(prov, page_no: int) -> dict | None:
    if prov is None or prov.bbox is None:
        return None
    bbox = prov.bbox
    # docling's BoundingBox is (l, t, r, b) in the page's own coord_origin
    # (typically BOTTOM_LEFT for PDF pages, i.e. larger y = higher on the
    # page). Stored as-is here (x=l, y=b, width/height derived) rather than
    # flipped to a top-left image convention -- a future pixel-cropping
    # consumer (Step 10, photo extraction) must account for coord_origin
    # explicitly rather than assume top-left, since flipping it here would
    # silently lose that information.
    return {
        "page": page_no,
        "x": bbox.l,
        "y": min(bbox.t, bbox.b),
        "width": abs(bbox.r - bbox.l),
        "height": abs(bbox.t - bbox.b),
    }


def _build_table_rows(table_data) -> list[list[str]]:
    if table_data.num_rows == 0 or table_data.num_cols == 0:
        return []
    grid = [["" for _ in range(table_data.num_cols)] for _ in range(table_data.num_rows)]
    for cell in table_data.table_cells:
        row = cell.start_row_offset_idx
        col = cell.start_col_offset_idx
        if 0 <= row < table_data.num_rows and 0 <= col < table_data.num_cols:
            grid[row][col] = cell.text
    return grid


class DoclingEngine(ExtractionEngine):
    name = "docling"

    def check_availability(self) -> EngineAvailability:
        if not settings.docling_enabled:
            return EngineAvailability(available=False, reason="DOCLING_ENABLED is false", version=None)
        try:
            import docling
        except ImportError:
            return EngineAvailability(available=False, reason="docling package is not installed", version=None)
        version = getattr(docling, "__version__", None)
        if not version:
            try:
                from importlib.metadata import version as pkg_version
                version = pkg_version("docling")
            except Exception:  # pragma: no cover - defensive only
                version = "unknown"
        return EngineAvailability(available=True, reason=None, version=version)

    def warmup(self) -> EngineAvailability:
        """A real synthetic conversion, not just an import check (Step
        4.5) -- check_availability() alone only confirms `import docling`
        succeeds, which is near-instant and loads no ML models at all.
        The actual cost (torch + layout/table model weights loading from
        disk) only happens on the first real DocumentConverter.convert()
        call. Running that conversion here, against a tiny bundled
        fixture with no real content, is what actually moves that cost
        from the first user request to service start-up. (Step 4.5's
        original ~100s cold measurement included RapidOCR's own model
        load; do_ocr=False in analyse() as of Step 6B removes that
        component -- re-measured below, not assumed unchanged.)"""
        availability = self.check_availability()
        if not availability.available:
            return availability
        try:
            self.analyse(_WARMUP_FIXTURE_PATH, "application/pdf")
        except Exception as error:  # noqa: BLE001 - any warm-up failure must report DEGRADED, never crash the worker
            return EngineAvailability(available=False, reason=type(error).__name__, version=availability.version)
        return availability

    def analyse(self, file_path: str, mime_type: str) -> dict:
        availability = self.check_availability()
        if not availability.available:
            raise EngineNotImplementedError("docling", availability.reason or "unavailable")

        from docling.datamodel.base_models import InputFormat
        from docling.datamodel.pipeline_options import PdfPipelineOptions
        from docling.document_converter import DocumentConverter, PdfFormatOption
        from docling_core.types.doc.document import PictureItem, TableItem, TextItem

        # do_ocr=False: Docling's own default pipeline silently runs a
        # bundled RapidOCR fallback for scanned pages. That is redundant
        # with (and unaccounted for by) this service's own OCR capability
        # -- Step 6's PaddleOCR pool and pdf_routing.py's native-vs-OCR
        # page classification -- and, discovered during Step 6B's real
        # container verification, crashes outright in the production
        # image: RapidOCR tries to download its model weights into the
        # (root-owned) site-packages directory, which the non-root
        # `docproc` container user cannot write to. This engine's own
        # scope is native/digital text and structure only (see module
        # docstring); scanned-page OCR is deliberately PaddleOCREngine's
        # job, not this one's.
        pipeline_options = PdfPipelineOptions()
        pipeline_options.do_ocr = False
        converter = DocumentConverter(
            format_options={InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options)}
        )
        result = converter.convert(file_path)
        doc = result.document

        pages = [
            {
                "pageNumber": page_no,
                "widthPx": int(round(page.size.width)) if page.size else None,
                "heightPx": int(round(page.size.height)) if page.size else None,
                "nativeTextPresent": True,
            }
            for page_no, page in sorted(doc.pages.items())
        ]

        text_blocks = []
        tables = []
        images = []
        reading_order = 0

        for item, _level in doc.iterate_items():
            provs = item.prov if getattr(item, "prov", None) else [None]
            for prov in provs:
                page_no = prov.page_no if prov is not None else 1  # DOCX has no page concept; anchor to a single logical page

                if isinstance(item, TableItem):
                    tables.append({
                        "page": page_no,
                        "boundingBox": _build_bounding_box(prov, page_no),
                        "rows": _build_table_rows(item.data),
                        "engine": "docling",
                    })
                elif isinstance(item, PictureItem):
                    images.append({
                        "page": page_no,
                        "boundingBox": _build_bounding_box(prov, page_no),
                        "widthPx": None,
                        "heightPx": None,
                        "mimeType": None,
                        "engine": "docling",
                        "classification": "NOT_CLASSIFIED",
                    })
                elif isinstance(item, TextItem):
                    text = (item.text or "").strip()
                    if not text:
                        continue
                    text_blocks.append({
                        "text": text,
                        "page": page_no,
                        "readingOrder": reading_order,
                        "boundingBox": _build_bounding_box(prov, page_no),
                        "section": item.label.value if item.label else None,
                        "engine": "docling",
                        "engineConfidence": None,
                    })
                    reading_order += 1

        return {
            "pages": pages,
            "textBlocks": text_blocks,
            "tables": tables,
            "images": images,
            "readingOrderApplied": True,
            "engineVersion": availability.version,
        }
