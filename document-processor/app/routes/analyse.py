from __future__ import annotations

import os
import re
import time

from fastapi import APIRouter, Form, HTTPException, UploadFile

from app.config import settings
from app.logging_utils import log_event
from app.ocr import reconciliation
from app.schemas import (
    CanonicalDocument,
    DocumentMetadata,
    PagePreprocessingResult,
    ProcessingDurations,
    SafeErrorResponse,
)
from app.security import (
    ValidationError,
    isolated_temp_dir,
    validate_declared_mime_type,
    validate_file_signature,
    validate_file_size,
    write_temp_file,
)
from app.state import enter_analysis, exit_analysis
from app.worker import instance as worker_instance
from app.worker.supervisor import (
    READY_LIKE_STATES,
    ConversionEngineError,
    ConversionTimeoutError,
    EngineUnavailableError,
    ServiceBusyError,
    ServiceUnavailableError,
)


def _strip_internal_fields(page: dict) -> PagePreprocessingResult:
    return PagePreprocessingResult(**{k: v for k, v in page.items() if not k.startswith("_")})


router = APIRouter()

# Per the routing spec: digital PDF/DOCX go through Docling for structure;
# scanned/image documents are PaddleOCR's territory (Step 6).
_DOCLING_ROUTABLE_MIME_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}

_PDF_PAGE_MARKER = re.compile(rb"/Type\s*/Page(?!s)")


def _approximate_pdf_page_count(content: bytes) -> int | None:
    """A best-effort, non-authoritative page count from raw PDF structure
    (counts /Type /Page object markers). Deliberately not a real PDF parse —
    that's Docling's job (Step 4). Returned only as a quality-of-life
    metadata hint; never relied on for routing or limit enforcement below
    the hard byte-size cap."""
    count = len(_PDF_PAGE_MARKER.findall(content))
    return count if count > 0 else None


def _safe_http_error(status_code: int, code: str, message: str, retryable: bool, correlation_id: str | None) -> HTTPException:
    return HTTPException(
        status_code=status_code,
        detail=SafeErrorResponse(code=code, message=message, retryable=retryable, correlationId=correlation_id).model_dump(),
    )


async def _run_preprocessing(
    file_path: str, mime_type: str, job_temp_dir: str, correlation_id: str,
    quality_warnings: list[str], fallback_reasons: list[str],
) -> list[dict]:
    """Shared by the image and PDF branches when OCR itself is not being
    used for this request -- same worker job type (PreprocessJob), same
    error classification, same "never claim extraction happened, degrade
    safely" contract as the Docling path. Runs on the OCR worker pool
    (Step 6 moved preprocessing there, alongside PaddleOCR -- see
    app/worker/instance.py) -- capability-specific: checks the
    "preprocessor" engine specifically, never treats the pool being READY
    (e.g. because "ocr" warmed up fine) as sufficient on its own. Raises
    the two errors that must abort the whole request (timeout,
    queue-full); everything else degrades in place and returns []."""
    ocr_pool_state = worker_instance.ocr_supervisor.state
    if ocr_pool_state not in READY_LIKE_STATES or not worker_instance.ocr_supervisor.is_engine_available("preprocessor"):
        quality_warnings.append("Preprocessing is unavailable for this request.")
        fallback_reasons.append(f"preprocessor: {ocr_pool_state.value}")
        return []

    try:
        return await worker_instance.ocr_supervisor.submit_preprocess(file_path, mime_type, job_temp_dir)
    except ConversionTimeoutError as error:
        log_event(
            "error", "analyse.preprocessing_timeout", correlationId=correlation_id,
            durationMs=int(settings.ocr_conversion_timeout_seconds * 1000),
        )
        raise _safe_http_error(
            504, "PROCESSING_TIMEOUT",
            "Preprocessing exceeded its hard deadline and was terminated.",
            True, correlation_id,
        ) from error
    except ServiceBusyError as error:
        log_event("warn", "analyse.preprocessing_busy", correlationId=correlation_id)
        raise _safe_http_error(
            503, "SERVICE_BUSY",
            "The processing queue is full. Retry shortly.",
            True, correlation_id,
        ) from error
    except (ServiceUnavailableError, EngineUnavailableError) as error:
        quality_warnings.append("Preprocessing is unavailable for this request.")
        fallback_reasons.append(f"preprocessor: {getattr(error, 'reason', None) or error}")
        return []
    except ConversionEngineError as error:
        quality_warnings.append("Preprocessing failed for this document.")
        fallback_reasons.append(f"preprocessor: processing error ({error.error_type})")
        log_event("warn", "analyse.preprocessing_failed", correlationId=correlation_id, code=error.error_type)
        return []


async def _run_ocr(
    file_path: str, mime_type: str, job_temp_dir: str, correlation_id: str,
    quality_warnings: list[str], fallback_reasons: list[str],
) -> list[dict]:
    """Runs preprocessing + PaddleOCR as one job on the OCR worker pool
    (see app/engines/paddleocr_engine.py -- preprocessing happens
    in-process, inside this same job, not a second round-trip). Requires
    the "ocr" capability specifically, not merely "the OCR pool is up"
    (which could be true purely because "preprocessor" warmed up while
    "ocr" itself failed) -- this is the capability-specific admission
    check the Step 6 architecture requires."""
    ocr_pool_state = worker_instance.ocr_supervisor.state
    if ocr_pool_state not in READY_LIKE_STATES or not worker_instance.ocr_supervisor.is_engine_available("ocr"):
        quality_warnings.append("OCR is unavailable for this request.")
        fallback_reasons.append(f"ocr: {ocr_pool_state.value}")
        return []

    try:
        return await worker_instance.ocr_supervisor.submit_ocr(file_path, mime_type, job_temp_dir, settings.ocr_language)
    except ConversionTimeoutError as error:
        log_event(
            "error", "analyse.ocr_timeout", correlationId=correlation_id,
            durationMs=int(settings.ocr_conversion_timeout_seconds * 1000),
        )
        raise _safe_http_error(
            504, "PROCESSING_TIMEOUT",
            "OCR exceeded its hard deadline and was terminated.",
            True, correlation_id,
        ) from error
    except ServiceBusyError as error:
        log_event("warn", "analyse.ocr_busy", correlationId=correlation_id)
        raise _safe_http_error(
            503, "SERVICE_BUSY",
            "The OCR queue is full. Retry shortly.",
            True, correlation_id,
        ) from error
    except (ServiceUnavailableError, EngineUnavailableError) as error:
        quality_warnings.append("OCR is unavailable for this request.")
        fallback_reasons.append(f"ocr: {getattr(error, 'reason', None) or error}")
        return []
    except ConversionEngineError as error:
        quality_warnings.append("OCR failed for this document.")
        fallback_reasons.append(f"ocr: processing error ({error.error_type})")
        log_event("warn", "analyse.ocr_failed", correlationId=correlation_id, code=error.error_type)
        return []


def _extract_preprocessing_results(ocr_pages: list[dict]) -> list[dict]:
    return [page["preprocessingResult"] for page in ocr_pages if page.get("preprocessingResult")]


def _extract_ocr_text_blocks(ocr_pages: list[dict]) -> list[dict]:
    blocks: list[dict] = []
    for page in ocr_pages:
        blocks.extend(page.get("textBlocks", []))
    return blocks


def _native_char_count_for_page(text_blocks: list[dict], page_number: int) -> tuple[int, bool]:
    page_blocks = [tb for tb in text_blocks if tb.get("page") == page_number]
    char_count = sum(len(tb.get("text", "")) for tb in page_blocks)
    return char_count, bool(page_blocks)


def _build_reconciliation(text_blocks: list[dict], ocr_pages: list[dict]) -> list[dict]:
    decisions: list[dict] = []
    for page in ocr_pages:
        page_number = page["pageNumber"]
        native_char_count, native_text_present = _native_char_count_for_page(text_blocks, page_number)
        decisions.append(
            reconciliation.reconcile_page(
                page=page_number,
                native_char_count=native_char_count,
                native_text_present=native_text_present,
                ocr_text_blocks=page.get("textBlocks", []),
                ocr_min_confidence=settings.ocr_min_confidence,
            )
        )
    return decisions


@router.post("/v1/documents/analyse", response_model=CanonicalDocument)
async def analyse_document(
    file: UploadFile,
    correlationId: str = Form(...),
    mimeType: str = Form(...),
    originalFilename: str = Form(...),
    routeHint: str = Form("auto"),
) -> CanonicalDocument:
    started_at = time.monotonic()
    validation_started_at = started_at

    try:
        validate_declared_mime_type(mimeType)
    except ValidationError as error:
        log_event("warn", "analyse.rejected", correlationId=correlationId, code=error.code, mimeType=mimeType)
        raise _safe_http_error(422, error.code, error.message, error.retryable, correlationId) from error

    content = await file.read()

    try:
        validate_file_size(len(content))
        sniffed_mime_type = validate_file_signature(mimeType, content[:16])
    except ValidationError as error:
        log_event(
            "warn", "analyse.rejected", correlationId=correlationId, code=error.code,
            mimeType=mimeType, fileSizeBytes=len(content),
        )
        raise _safe_http_error(422, error.code, error.message, error.retryable, correlationId) from error

    validation_ms = int((time.monotonic() - validation_started_at) * 1000)

    # Bounded concurrency: a request that can't get a slot within the
    # request timeout is rejected with a retryable error rather than
    # queueing indefinitely and letting callers pile up behind a slow engine.
    acquired = False
    try:
        await enter_analysis()
        acquired = True
    except Exception as error:  # pragma: no cover - semaphore acquisition does not normally raise
        raise _safe_http_error(503, "SERVICE_BUSY", "Too many concurrent analysis requests.", True, correlationId) from error

    try:
        with isolated_temp_dir() as temp_dir:
            file_path = write_temp_file(temp_dir, originalFilename, content)

            page_count = None
            if sniffed_mime_type == "application/pdf":
                page_count = _approximate_pdf_page_count(content)
            elif sniffed_mime_type in ("image/jpeg", "image/png"):
                page_count = 1

            if page_count is not None and page_count > settings.max_page_count:
                raise ValidationError(
                    "PAGE_COUNT_EXCEEDED",
                    f"Document exceeds the {settings.max_page_count}-page limit.",
                    retryable=False,
                )

            ocr_pool_snapshot = worker_instance.ocr_supervisor.snapshot()
            preprocessor_snapshot = ocr_pool_snapshot["engines"].get("preprocessor")
            ocr_snapshot = ocr_pool_snapshot["engines"].get("ocr")
            engine_versions: dict[str, str | None] = {
                "docling": worker_instance.docling_supervisor.engine_version,
                "preprocessor": preprocessor_snapshot["version"] if preprocessor_snapshot else None,
                "ocr": ocr_snapshot["version"] if ocr_snapshot else None,
            }
            fallback_reasons: list[str] = []

            extraction_started_at = time.monotonic()
            selected_route = "SCAFFOLD_NOT_IMPLEMENTED"
            quality_warnings: list[str] = []
            pages: list[dict] = []
            text_blocks: list[dict] = []
            tables: list[dict] = []
            images: list[dict] = []
            reading_order_applied = False
            preprocessing_results: list[dict] = []
            ocr_pages_results: list[dict] = []
            reconciliation_results: list[dict] = []
            preprocessing_job_dir = f"{temp_dir.path}{os.sep}preprocessed"
            ocr_job_dir = f"{temp_dir.path}{os.sep}ocr"

            docling_state = worker_instance.docling_supervisor.state
            docling_ready = (
                docling_state in READY_LIKE_STATES
                and worker_instance.docling_supervisor.is_engine_available("docling")
            )
            if sniffed_mime_type in _DOCLING_ROUTABLE_MIME_TYPES and docling_ready:
                try:
                    document = await worker_instance.docling_supervisor.submit(file_path, sniffed_mime_type)
                    pages = document["pages"]
                    text_blocks = document["textBlocks"]
                    tables = document["tables"]
                    images = document["images"]
                    reading_order_applied = document["readingOrderApplied"]
                    selected_route = "DOCLING_STRUCTURE"
                except ConversionTimeoutError as error:
                    log_event(
                        "error", "analyse.docling_timeout", correlationId=correlationId,
                        durationMs=int(settings.docling_conversion_timeout_seconds * 1000),
                    )
                    raise _safe_http_error(
                        504, "PROCESSING_TIMEOUT",
                        "Document conversion exceeded its hard deadline and was terminated.",
                        True, correlationId,
                    ) from error
                except ServiceBusyError as error:
                    log_event("warn", "analyse.docling_busy", correlationId=correlationId)
                    raise _safe_http_error(
                        503, "SERVICE_BUSY",
                        "The document conversion queue is full. Retry shortly.",
                        True, correlationId,
                    ) from error
                except (ServiceUnavailableError, EngineUnavailableError) as error:
                    # Engine dropped from READY/available to WARMING/
                    # DEGRADED/unavailable between the state check above
                    # and submit() actually running (a real race, not a
                    # hypothetical one -- a concurrent request's timeout
                    # can trigger a restart mid-flight) -- degrade the
                    # same as "was never ready".
                    quality_warnings.append("Docling is unavailable; extraction engines are not implemented for this request.")
                    fallback_reasons.append(f"docling: {getattr(error, 'reason', None) or error}")
                except ConversionEngineError as error:
                    quality_warnings.append("Docling extraction failed for this document; falling back to an empty structural result.")
                    fallback_reasons.append(f"docling: extraction error ({error.error_type})")
                    log_event("warn", "analyse.docling_failed", correlationId=correlationId, code=error.error_type)
            elif sniffed_mime_type in ("image/jpeg", "image/png"):
                # Step 6: security validation -> preprocessing -> gross
                # orientation assessment -> PaddleOCR -> reading-order
                # reconstruction -> canonical text blocks, all as ONE job
                # on the OCR worker pool. Falls back to preprocessing-only
                # (Step 5 behaviour) if OCR specifically is unavailable --
                # never silently treats "the pool is up" as "OCR is up".
                ocr_pages_results = await _run_ocr(
                    file_path, sniffed_mime_type, ocr_job_dir, correlationId, quality_warnings, fallback_reasons,
                )
                if ocr_pages_results:
                    preprocessing_results = _extract_preprocessing_results(ocr_pages_results)
                    selected_route = "OCR_EXTRACTED"
                else:
                    preprocessing_results = await _run_preprocessing(
                        file_path, sniffed_mime_type, preprocessing_job_dir, correlationId, quality_warnings, fallback_reasons,
                    )
                    if preprocessing_results:
                        selected_route = "IMAGE_PREPROCESSED"
            elif sniffed_mime_type in _DOCLING_ROUTABLE_MIME_TYPES:
                quality_warnings.append("Docling is unavailable; extraction engines are not implemented for this request.")
                docling_outcome = worker_instance.docling_supervisor.engine_availability.get("docling")
                docling_reason = docling_outcome.error_type if docling_outcome else None
                fallback_reasons.append(f"docling: {docling_state.value}" + (f" ({docling_reason})" if docling_reason else ""))

            # Additive to whatever the branch above did (Docling
            # succeeded, failed, or wasn't ready): OCR for scanned/hybrid
            # PDF pages and native-vs-OCR reconciliation for low-quality
            # native text, opt-in via PADDLEOCR_ENABLED. Falls back to
            # preprocessing-only assessment (opt-in via
            # PREPROCESSING_ENABLED) when OCR itself is off. Skipped
            # entirely for a clean digital PDF that never needed either
            # (no extra worker round-trip).
            if sniffed_mime_type == "application/pdf" and settings.paddleocr_enabled:
                ocr_pages_results = await _run_ocr(
                    file_path, sniffed_mime_type, ocr_job_dir, correlationId, quality_warnings, fallback_reasons,
                )
                if ocr_pages_results:
                    preprocessing_results = _extract_preprocessing_results(ocr_pages_results)
                    reconciliation_results = _build_reconciliation(text_blocks, ocr_pages_results)
            elif sniffed_mime_type == "application/pdf" and settings.preprocessing_enabled:
                preprocessing_results = await _run_preprocessing(
                    file_path, sniffed_mime_type, preprocessing_job_dir, correlationId, quality_warnings, fallback_reasons,
                )

            ocr_text_blocks = _extract_ocr_text_blocks(ocr_pages_results)

            extraction_ms = int((time.monotonic() - extraction_started_at) * 1000)

            total_ms = int((time.monotonic() - started_at) * 1000)

            log_event(
                "info", "analyse.completed", correlationId=correlationId,
                mimeType=mimeType, sniffedMimeType=sniffed_mime_type,
                fileSizeBytes=len(content), pageCount=page_count,
                selectedRoute=selected_route, fallbackReasons=fallback_reasons,
                durationMs=total_ms,
            )

            return CanonicalDocument(
                schemaVersion=settings.schema_version,
                parserVersion=settings.parser_version,
                correlationId=correlationId,
                engineVersions=engine_versions,
                selectedRoute=selected_route,
                fallbackReasons=fallback_reasons,
                documentMetadata=DocumentMetadata(
                    pageCount=page_count,
                    fileSizeBytes=len(content),
                    mimeType=mimeType,
                    sniffedMimeType=sniffed_mime_type,
                    originalFilename=originalFilename,
                ),
                pages=pages,
                textBlocks=text_blocks,
                tables=tables,
                images=images,
                readingOrderApplied=reading_order_applied,
                extractionConfidence=None,
                qualityWarnings=quality_warnings,
                processingDurations=ProcessingDurations(
                    totalMs=total_ms, validationMs=validation_ms, extractionMs=extraction_ms,
                ),
                error=None,
                preprocessing=[_strip_internal_fields(page) for page in preprocessing_results],
                ocrTextBlocks=ocr_text_blocks,
                ocrPages=[{k: v for k, v in page.items() if k != "preprocessingResult"} for page in ocr_pages_results],
                reconciliation=reconciliation_results,
            )
    except ValidationError as error:
        log_event(
            "warn", "analyse.rejected", correlationId=correlationId, code=error.code,
            mimeType=mimeType, fileSizeBytes=len(content),
        )
        raise _safe_http_error(422, error.code, error.message, error.retryable, correlationId) from error
    finally:
        if acquired:
            await exit_analysis()
