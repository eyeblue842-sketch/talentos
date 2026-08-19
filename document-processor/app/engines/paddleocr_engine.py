"""PaddleOCR adapter -- real OCR extraction as of Step 6.

Runs inside the OCR worker pool (never Docling's -- see
app/worker/instance.py: docling_supervisor vs ocr_supervisor), alongside
PreprocessorEngine in the same process. Scope: OCR text evidence only
(page number, text, reading order, bounding box, confidence, engine
version, extraction route, preprocessing provenance) -- no LLM
candidate-field extraction. That reconciliation into candidate data is a
later step, layered on top of this structural output, not this module's
concern (matching how DoclingEngine already scopes itself).

Preprocessing is called directly, in-process (this class imports
app.preprocessing.pipeline/pdf_routing the same way PreprocessorEngine
does) rather than via a second IPC job -- the cleaned image is handed
straight to PaddleOCR within this one worker-process function call, never
round-tripped through the parent process or exposed as a path in any
HTTP response.

VERIFICATION STATUS -- read before trusting this in production: the real
PaddleOCR 3.x / `PaddleOCR.predict()` result shape parsed here
(`_parse_ocr_result`, `_parse_orientation_result`) was verified during
Phase P1 in the Python 3.11 Linux/AMD64 container runtime this service
targets. That same validation also established that paddlepaddle 3.3.1
fails CPU OCR inference at runtime for this stack, while 3.2.2 succeeds.
If the real result shape changes again in a future Paddle release,
parsing is written to raise `OcrResultParseError` loudly (failing
warm-up -> DEGRADED) rather than silently return wrong or empty data.
"""
from __future__ import annotations

import os
import time

from app.config import settings
from app.engines.base import EngineAvailability
from app.ocr import orientation as orientation_policy
from app.ocr import quality_policy
from app.ocr.reading_order import deduplicate_overlapping_lines, reconstruct_reading_order
from app.preprocessing import pdf_routing, pipeline
from app.security import ValidationError, validate_image_dimensions, validate_pdf_for_preprocessing

_WARMUP_FIXTURE_PATH = os.path.join(os.path.dirname(__file__), "..", "assets", "warmup_ocr.png")


class OcrResultParseError(Exception):
    pass


def _to_plain(value):
    """Numpy scalars/arrays leak out of PaddleX result objects; convert to
    plain Python types before this ever reaches a pydantic model or a
    pickled IPC message."""
    if hasattr(value, "tolist"):
        return value.tolist()
    if hasattr(value, "item"):
        return value.item()
    return value


def _parse_ocr_result(raw) -> list[dict]:
    """`raw` is one entry of PaddleOCR.predict()'s return list (one per
    input image). Defensively reads the PaddleX 3.x unified OCR pipeline
    result shape (rec_texts/rec_scores/rec_polys) -- see the module
    docstring's verification-status note. Returns a list of
    {"text", "confidence", "box"} dicts, one per detected line."""
    getter = raw.get if hasattr(raw, "get") else (lambda k, d=None: raw[k] if k in raw else d)

    texts = getter("rec_texts")
    scores = getter("rec_scores")
    polys = getter("rec_polys")
    if polys is None:
        polys = getter("dt_polys")

    if texts is None or scores is None or polys is None:
        raise OcrResultParseError(
            "PaddleOCR result did not contain the expected rec_texts/rec_scores/rec_polys (or dt_polys) keys."
        )
    if not (len(texts) == len(scores) == len(polys)):
        raise OcrResultParseError("PaddleOCR result's text/score/box arrays have mismatched lengths.")

    lines = []
    for text, score, box in zip(texts, scores, polys):
        box_points = _to_plain(box)
        lines.append({"text": str(text), "confidence": float(_to_plain(score)), "box": [[float(x), float(y)] for x, y in box_points]})
    return lines


def _parse_orientation_result(raw) -> dict | None:
    """Best-effort extraction of the doc-orientation-classifier outcome
    from a PaddleX pipeline result. Several plausible shapes are probed;
    if none match, returns None -- decide_orientation() treats that as
    "uncertain", never fabricating a class or confidence."""
    getter = raw.get if hasattr(raw, "get") else (lambda k, d=None: raw[k] if k in raw else d)
    preprocessor_res = getter("doc_preprocessor_res")
    if preprocessor_res is None:
        return None
    def inner_getter(k, d=None):
        if hasattr(preprocessor_res, "get"):
            return preprocessor_res.get(k, d)
        return preprocessor_res[k] if k in preprocessor_res else d

    degrees = inner_getter("angle")
    if degrees is None:
        degrees = inner_getter("orientation_angle")
    confidence = inner_getter("score")
    if confidence is None:
        confidence = inner_getter("confidence")
    output_img = inner_getter("output_img")
    rot_img = inner_getter("rot_img")

    if degrees is None:
        return None
    try:
        degrees = int(_to_plain(degrees))
    except (TypeError, ValueError):
        return None
    correction_degrees = orientation_policy.correction_degrees_for_detected(degrees)
    internally_corrected = correction_degrees != 0 and (output_img is not None or rot_img is not None)
    return {
        "degrees": degrees,
        "confidence": float(_to_plain(confidence)) if confidence is not None else None,
        "correctionDegrees": correction_degrees,
        "internallyCorrected": internally_corrected,
    }


class PaddleOCREngine:
    name = "ocr"

    def __init__(self):
        self._ocr = None
        self._ocr_language = None

    def check_availability(self) -> EngineAvailability:
        if not settings.paddleocr_enabled:
            return EngineAvailability(available=False, reason="PADDLEOCR_ENABLED is false", version=None)
        try:
            from importlib.metadata import version as pkg_version

            import paddle  # noqa: F401 - import-availability check only
            import paddleocr  # noqa: F401 - import-availability check only
        except ImportError as error:
            return EngineAvailability(available=False, reason=f"missing dependency: {error.name}", version=None)
        return EngineAvailability(available=True, reason=None, version=f"paddleocr={pkg_version('paddleocr')}")

    def _get_ocr(self, language: str):
        """Constructs the PaddleOCR pipeline once and reuses it for every
        subsequent call in this worker process -- construction is what
        pays the model load/download cost (Step 6's whole reason for
        running warmup() before any request is admitted). use_doc_unwarping
        is off: Step 5's preprocessing pipeline already applies perspective
        correction, so running PaddleX's own unwarping submodule too would
        be redundant double-processing, not additional correctness.
        use_doc_orientation_classify stays on -- this IS the gross
        orientation detector Step 6 requires (see app/ocr/orientation.py's
        module docstring for why this is preferred over any home-grown
        heuristic)."""
        if self._ocr is None or self._ocr_language != language:
            from paddleocr import PaddleOCR

            self._ocr = PaddleOCR(
                lang=language,
                use_doc_orientation_classify=True,
                use_doc_unwarping=False,
                use_textline_orientation=True,
            )
            self._ocr_language = language
        return self._ocr

    def warmup(self) -> EngineAvailability:
        availability = self.check_availability()
        if not availability.available:
            return availability
        try:
            self._get_ocr(settings.ocr_language)
            import cv2

            fixture = cv2.imread(_WARMUP_FIXTURE_PATH)
            if fixture is None:
                raise FileNotFoundError(f"OCR warm-up fixture not found or unreadable: {_WARMUP_FIXTURE_PATH}")
            self._run_ocr(fixture)
        except Exception as error:  # noqa: BLE001 - any warm-up failure must report DEGRADED, never crash the worker
            return EngineAvailability(available=False, reason=type(error).__name__, version=availability.version)
        return availability

    def _run_ocr(self, image_bgr) -> tuple[list[dict], dict | None]:
        """Runs one PaddleOCR.predict() call and returns (raw text lines,
        raw orientation result) -- both still in "raw-ish" shape (already
        parsed out of the PaddleX result object, not yet turned into
        canonical text blocks with reading order applied)."""
        ocr = self._get_ocr(settings.ocr_language)
        results = ocr.predict(image_bgr)
        if not results:
            return [], None
        raw = results[0]
        lines = _parse_ocr_result(raw)
        orientation_raw = _parse_orientation_result(raw)
        return lines, orientation_raw

    def ocr(self, file_path: str, mime_type: str, job_temp_dir: str, language: str = "en") -> list[dict]:
        if mime_type in ("image/jpeg", "image/png"):
            return self._ocr_image(file_path, job_temp_dir)
        if mime_type == "application/pdf":
            return self._ocr_pdf(file_path, job_temp_dir)
        raise ValidationError("UNSUPPORTED_MIME_TYPE", f"MIME type '{mime_type}' is not supported for OCR.", retryable=False)

    def _preprocessed_array(self, image_bgr, *, page_number: int, source_type: str, job_temp_dir: str, apply_geometry_correction: bool):
        """Runs the Step 5 preprocessing pipeline in-process and reads the
        cleaned result back into memory from THIS job's own isolated temp
        dir -- still one worker-process function call, no second IPC job,
        no artifact visible outside this job's lifetime."""
        import cv2

        page = pipeline.preprocess_page(
            image_bgr, page_number=page_number, source_type=source_type, output_dir=job_temp_dir,
            min_resolution_dimension=900, apply_geometry_correction=apply_geometry_correction,
        )
        artifact_path = page.get("_artifactPath")
        cleaned = cv2.imread(artifact_path) if artifact_path else image_bgr
        if cleaned is None:
            cleaned = image_bgr
        return cleaned, page

    def _build_page_result(
        self, *, page_number: int, source_type: str, extraction_route: str,
        cleaned_image, preprocessing_page: dict, started_at: float,
    ) -> dict:
        lines, orientation_raw = self._run_ocr(cleaned_image)
        decision = orientation_policy.decide_orientation(orientation_raw, settings.ocr_orientation_confidence_threshold)

        final_image = cleaned_image
        rerun = False
        if decision.correction_source == "careeriz_manual_postprocess" and decision.applied_degrees != 0:
            final_image = orientation_policy.rotate_degrees_cv(cleaned_image, decision.applied_degrees)
            rerun = True
        if rerun:
            lines, _ = self._run_ocr(final_image)

        lines = deduplicate_overlapping_lines(lines)
        lines = reconstruct_reading_order(lines)

        engine_version = self.check_availability().version
        transformations = preprocessing_page.get("transformationsApplied", [])
        warnings = list(preprocessing_page.get("warnings", []))

        text_blocks = []
        for line in lines:
            x0 = min(p[0] for p in line["box"])
            y0 = min(p[1] for p in line["box"])
            x1 = max(p[0] for p in line["box"])
            y1 = max(p[1] for p in line["box"])
            text_blocks.append(
                {
                    "page": page_number,
                    "text": line["text"],
                    "readingOrder": line["readingOrder"],
                    "boundingBox": {"page": page_number, "x": x0, "y": y0, "width": x1 - x0, "height": y1 - y0},
                    "confidence": line["confidence"],
                    "engine": "paddleocr",
                    "engineVersion": engine_version,
                    "extractionRoute": extraction_route,
                    "preprocessingApplied": transformations,
                }
            )

        mean_conf = quality_policy.mean_confidence(text_blocks)
        empty = quality_policy.is_empty_output(text_blocks)
        low_confidence = quality_policy.is_low_confidence_page(mean_conf, settings.ocr_min_confidence)
        if empty:
            warnings.append("OCR produced no readable text for this page.")
        elif low_confidence:
            warnings.append("OCR confidence is below the minimum threshold for this page; review recommended.")
        if decision.correction_source == "paddle_internal_doc_preprocessor" and decision.uncertain:
            warnings.append(
                "Page orientation was corrected internally by PaddleOCR, but classifier confidence was not exposed "
                "or did not clear the configured threshold."
            )
        elif decision.uncertain:
            warnings.append("Page orientation could not be confidently determined; original orientation was preserved.")

        preprocessing_public = {k: v for k, v in preprocessing_page.items() if not k.startswith("_")}

        return {
            "pageNumber": page_number,
            "sourceType": source_type,
            "extractionRoute": extraction_route,
            "textBlocks": text_blocks,
            "orientation": decision.as_dict(),
            "meanConfidence": mean_conf,
            "lowConfidence": bool(low_confidence),
            "emptyOutput": bool(empty),
            "warnings": warnings,
            "processingDurationMs": int((time.monotonic() - started_at) * 1000),
            # Carried through so a single OCR job (which already ran
            # preprocessing internally, in-process) can populate the
            # canonical `preprocessing` list too, without a second worker
            # round-trip -- see analyse.py.
            "preprocessingResult": preprocessing_public,
        }

    def _ocr_image(self, file_path: str, job_temp_dir: str) -> list[dict]:
        started_at = time.monotonic()
        validate_image_dimensions(file_path)
        image_bgr = pipeline.load_image_file(file_path)
        cleaned, preprocessing_page = self._preprocessed_array(
            image_bgr, page_number=1, source_type="PHOTOGRAPHED_IMAGE", job_temp_dir=job_temp_dir, apply_geometry_correction=True,
        )
        return [
            self._build_page_result(
                page_number=1, source_type="PHOTOGRAPHED_IMAGE", extraction_route="OCR_IMAGE",
                cleaned_image=cleaned, preprocessing_page=preprocessing_page, started_at=started_at,
            )
        ]

    @staticmethod
    def _build_failed_page_result(*, page_number: int, extraction_route: str, warning: str, started_at: float) -> dict:
        return {
            "pageNumber": page_number,
            "sourceType": "PDF_RENDERED",
            "extractionRoute": extraction_route,
            "textBlocks": [],
            "orientation": None,
            "meanConfidence": None,
            "lowConfidence": True,
            "emptyOutput": True,
            "warnings": [warning],
            "processingDurationMs": int((time.monotonic() - started_at) * 1000),
        }

    def _ocr_pdf(self, file_path: str, job_temp_dir: str) -> list[dict]:
        validate_pdf_for_preprocessing(file_path)
        assessments = pdf_routing.assess_pdf_pages(
            file_path, settings.preprocessing_render_dpi, settings.preprocessing_max_rendered_pixels_per_document,
        )

        ocr_candidates = [a for a in assessments if a["plannedRoute"] in ("RENDER_FOR_OCR", "NATIVE_WITH_OCR_BACKUP")]
        truncated = len(ocr_candidates) > settings.ocr_max_pages_per_document
        if truncated:
            ocr_candidates = ocr_candidates[: settings.ocr_max_pages_per_document]

        pages: list[dict] = []
        failed_pages: list[dict] = []
        first_error: Exception | None = None
        for index, assessment in enumerate(ocr_candidates):
            started_at = time.monotonic()
            extraction_route = "OCR_RENDERED_PDF_PAGE" if assessment["plannedRoute"] == "RENDER_FOR_OCR" else "OCR_LOW_QUALITY_FALLBACK"
            try:
                image_bgr = pdf_routing.render_pdf_page_to_bgr(file_path, assessment["pageNumber"], settings.preprocessing_render_dpi)
                cleaned, preprocessing_page = self._preprocessed_array(
                    image_bgr, page_number=assessment["pageNumber"], source_type="PDF_RENDERED",
                    job_temp_dir=job_temp_dir, apply_geometry_correction=False,
                )
                page_result = self._build_page_result(
                    page_number=assessment["pageNumber"], source_type="PDF_RENDERED", extraction_route=extraction_route,
                    cleaned_image=cleaned, preprocessing_page=preprocessing_page, started_at=started_at,
                )
                pages.append(page_result)
            except Exception as error:
                if first_error is None:
                    first_error = error
                failed_pages.append(
                    self._build_failed_page_result(
                        page_number=assessment["pageNumber"],
                        extraction_route=extraction_route,
                        warning=(
                            f"OCR processing failed for page {assessment['pageNumber']} "
                            f"({type(error).__name__}); other successfully processed pages were preserved."
                        ),
                        started_at=started_at,
                    )
                )
                continue
            if truncated and index == len(ocr_candidates) - 1:
                page_result["warnings"].append(
                    f"Document exceeded the {settings.ocr_max_pages_per_document}-page OCR budget; "
                    "remaining OCR-eligible pages were not processed."
                )
        if not pages and failed_pages and first_error is not None:
            raise first_error
        return sorted([*pages, *failed_pages], key=lambda page: page["pageNumber"])
