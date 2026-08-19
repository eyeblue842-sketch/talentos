from __future__ import annotations

from fastapi import APIRouter

from app.config import SUPPORTED_MIME_TYPES, settings
from app.schemas import CapabilitiesResponse, EngineReadiness
from app.worker import instance as worker_instance

router = APIRouter()


@router.get("/v1/capabilities", response_model=CapabilitiesResponse)
async def capabilities() -> CapabilitiesResponse:
    # Step 6: docling lives in its own worker pool; preprocessing + ocr
    # share the OCR pool (see app/worker/instance.py). Each engine's
    # availability comes from its OWN pool's snapshot -- no host-sensitive
    # detail (PIDs, file paths, hostnames) is included, only the state
    # name, version, and a short degraded-reason code.
    docling_snapshot = worker_instance.docling_supervisor.snapshot()
    ocr_pool_snapshot = worker_instance.ocr_supervisor.snapshot()

    docling_outcome = docling_snapshot["engines"].get("docling")
    engines: dict[str, EngineReadiness] = {
        "docling": EngineReadiness(
            available=bool(docling_outcome and docling_outcome["available"]),
            reason=docling_outcome["reason"] if docling_outcome else "not configured",
            version=docling_outcome["version"] if docling_outcome else None,
            workerState=docling_snapshot["state"],
        )
    }

    preprocessor_outcome = ocr_pool_snapshot["engines"].get("preprocessor")
    engines["preprocessor"] = EngineReadiness(
        available=bool(preprocessor_outcome and preprocessor_outcome["available"]),
        reason=preprocessor_outcome["reason"] if preprocessor_outcome else "not configured",
        version=preprocessor_outcome["version"] if preprocessor_outcome else None,
        workerState=ocr_pool_snapshot["state"],
    )

    ocr_outcome = ocr_pool_snapshot["engines"].get("ocr")
    engines["ocr"] = EngineReadiness(
        available=bool(ocr_outcome and ocr_outcome["available"]),
        reason=ocr_outcome["reason"] if ocr_outcome else "not configured",
        version=ocr_outcome["version"] if ocr_outcome else None,
        workerState=ocr_pool_snapshot["state"],
    )

    # Surya is intentionally absent — deferred (licensing), not silently
    # unavailable-by-bug. Reported explicitly so a caller can't confuse
    # "not integrated" with "temporarily down".
    engines["surya"] = EngineReadiness(
        available=False,
        reason=(
            "Deferred: model-weight license requires revenue/funding thresholds "
            "or a paid Datalab license (see Track B feasibility report)."
        ),
        version=None,
    )

    return CapabilitiesResponse(
        schemaVersion=settings.schema_version,
        parserVersion=settings.parser_version,
        supportedMimeTypes=sorted(SUPPORTED_MIME_TYPES.keys()),
        engines=engines,
        gpuEnabled=settings.gpu_enabled,
        limits={
            "maxFileSizeMb": settings.max_file_size_mb,
            "maxPageCount": settings.max_page_count,
            "maxPixelDimension": settings.max_pixel_dimension,
            "maxDecompressedPixels": settings.max_decompressed_pixels,
            "maxConcurrentRequests": settings.max_concurrent_requests,
            "requestTimeoutSeconds": settings.request_timeout_seconds,
            "preprocessingRenderDpi": settings.preprocessing_render_dpi,
            "preprocessingMaxRenderedPixelsPerDocument": settings.preprocessing_max_rendered_pixels_per_document,
            "preprocessingMaxTempDiskMb": settings.preprocessing_max_temp_disk_mb,
            "ocrMaxPagesPerDocument": settings.ocr_max_pages_per_document,
            "ocrMinConfidence": settings.ocr_min_confidence,
            "ocrOrientationConfidenceThreshold": settings.ocr_orientation_confidence_threshold,
        },
    )
