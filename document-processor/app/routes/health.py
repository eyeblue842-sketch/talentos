from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.config import settings
from app.schemas import (
    DoclingWorkerStatus,
    EngineReadiness,
    HealthLiveResponse,
    HealthReadyResponse,
    OcrWorkerStatus,
    PreprocessingEngineStatus,
)
from app.state import active_request_count
from app.worker import instance as worker_instance
from app.worker.supervisor import WorkerState

router = APIRouter()

# States in which a worker can usefully accept new work (running or
# queueing) -- BUSY is deliberately included: a caller checking readiness
# before sending work should see "yes, send it, it may queue briefly",
# not treat a currently-occupied-but-healthy worker as an outage.
_ACCEPTING_STATES = {WorkerState.READY, WorkerState.BUSY}


@router.get("/health/live", response_model=HealthLiveResponse)
async def health_live() -> HealthLiveResponse:
    """Process-alive check only — must never depend on engine state, disk,
    or anything that could make a healthy-but-idle process report unhealthy.
    Critically (Step 4.5/6): must keep responding while a conversion OR an
    OCR job is running in either isolated worker process, since neither
    blocks this process's event loop at all."""
    return HealthLiveResponse()


def _worker_status_dict(snapshot: dict) -> dict:
    return {
        "state": snapshot["state"],
        "engineVersion": snapshot["engineVersion"],
        "degradedReason": snapshot["degradedReason"],
        "activeConversions": snapshot["activeConversions"],
        "queuedRequests": snapshot["queuedRequests"],
        "queueCapacity": snapshot["queueCapacity"],
    }


@router.get("/health/ready", response_model=HealthReadyResponse)
async def health_ready():
    """Readiness reflects whether the service can usefully accept work,
    reported PER CAPABILITY -- docling/preprocessing/ocr each have their
    own independent state, because they now run in two separate worker
    pools (Step 6: docling_supervisor vs ocr_supervisor). A caller must
    check the SPECIFIC capability its request needs, not infer "the
    service is up" from one engine being READY while the one it actually
    needs is DEGRADED -- see analyse.py's capability-specific readiness
    checks, which this same distinction backs.

    The overall `status` stays "ready" even when every engine is
    UNAVAILABLE-by-config (the default) — the service can still serve
    scaffold responses, and an orchestrator must not treat scaffold-only
    mode as an outage. But the HTTP status code drops to 503 whenever a
    pool that IS enabled (this deployment expects it) is not in an
    accepting state — a caller checking readiness before sending work
    needs an accurate "don't bother yet" signal for whichever pool(s) it
    depends on.
    """
    docling_snapshot = worker_instance.docling_supervisor.snapshot()
    ocr_snapshot = worker_instance.ocr_supervisor.snapshot()

    docling_engine_outcome = docling_snapshot["engines"].get("docling")
    engines: dict[str, EngineReadiness] = {
        "docling": EngineReadiness(
            available=bool(docling_engine_outcome and docling_engine_outcome["available"]),
            reason=docling_engine_outcome["reason"] if docling_engine_outcome else "not configured",
            version=docling_engine_outcome["version"] if docling_engine_outcome else None,
            workerState=docling_snapshot["state"],
        )
    }

    preprocessor_snapshot = ocr_snapshot["engines"].get("preprocessor")
    preprocessing_status = PreprocessingEngineStatus(
        available=bool(preprocessor_snapshot and preprocessor_snapshot["available"]),
        version=preprocessor_snapshot["version"] if preprocessor_snapshot else None,
        reason=preprocessor_snapshot["reason"] if preprocessor_snapshot else "not configured",
    )

    ocr_engine_outcome = ocr_snapshot["engines"].get("ocr")
    engines["ocr"] = EngineReadiness(
        available=bool(ocr_engine_outcome and ocr_engine_outcome["available"]),
        reason=ocr_engine_outcome["reason"] if ocr_engine_outcome else "not configured",
        version=ocr_engine_outcome["version"] if ocr_engine_outcome else None,
        workerState=ocr_snapshot["state"],
    )

    body = HealthReadyResponse(
        status="ready",
        engines=engines,
        docling=DoclingWorkerStatus(**_worker_status_dict(docling_snapshot)),
        preprocessing=preprocessing_status,
        ocr=OcrWorkerStatus(**_worker_status_dict(ocr_snapshot)),
        activeRequests=active_request_count(),
        maxConcurrentRequests=settings.max_concurrent_requests,
    )

    status_code = 200
    if settings.docling_enabled and worker_instance.docling_supervisor.state not in _ACCEPTING_STATES:
        status_code = 503
    if (settings.preprocessing_enabled or settings.paddleocr_enabled) and worker_instance.ocr_supervisor.state not in _ACCEPTING_STATES:
        status_code = 503

    return JSONResponse(status_code=status_code, content=body.model_dump())
