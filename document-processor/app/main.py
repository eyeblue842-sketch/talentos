from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse

from app.config import settings
from app.logging_utils import log_event
from app.routes import analyse, capabilities, health
from app.schemas import SafeErrorResponse
from app.security import sweep_abandoned_temp_dirs
from app.worker import instance as worker_instance

_ABANDONED_DIR_SWEEP_INTERVAL_SECONDS = 900  # 15 minutes


async def _periodic_abandoned_dir_sweep() -> None:
    while True:
        await asyncio.sleep(_ABANDONED_DIR_SWEEP_INTERVAL_SECONDS)
        try:
            removed = await asyncio.to_thread(sweep_abandoned_temp_dirs, settings.preprocessing_abandoned_dir_max_age_minutes)
            if removed:
                log_event("info", "temp.abandoned_dirs_swept", code=str(removed))
        except Exception as error:  # noqa: BLE001 - a sweep failure must never crash the service
            log_event("warn", "temp.sweep_failed", code=type(error).__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    log_event("info", "service.start", maxConcurrentRequests=settings.max_concurrent_requests)
    # Step 5: sweep any temp directories abandoned by a previous run of
    # this process (e.g. a hard kill of the whole container, not just the
    # worker -- isolated_temp_dir()'s own finally clause already covers
    # every normal request outcome; this is only for that one case).
    removed_at_startup = await asyncio.to_thread(sweep_abandoned_temp_dirs, settings.preprocessing_abandoned_dir_max_age_minutes)
    if removed_at_startup:
        log_event("info", "temp.abandoned_dirs_swept_at_startup", code=str(removed_at_startup))
    sweep_task = asyncio.create_task(_periodic_abandoned_dir_sweep())

    # Each worker pool stays UNAVAILABLE (no process spawned at all)
    # unless at least one of ITS OWN engines is explicitly enabled -- the
    # same safe-default principle as Step 4: a worker process existing is
    # itself real CPU/memory cost, not something a package being
    # installed should trigger automatically. Step 6: docling_supervisor
    # and ocr_supervisor are started and stopped completely independently
    # -- one pool being disabled/absent must never affect the other, and
    # neither `await` here can block on the other (each is its own
    # process spawn with its own timeout).
    docling_pool_enabled = settings.docling_enabled
    ocr_pool_enabled = settings.preprocessing_enabled or settings.paddleocr_enabled
    if docling_pool_enabled:
        await worker_instance.docling_supervisor.start()
    if ocr_pool_enabled:
        await worker_instance.ocr_supervisor.start()
    try:
        yield
    finally:
        sweep_task.cancel()
        try:
            await sweep_task
        except asyncio.CancelledError:
            pass
        if docling_pool_enabled:
            await worker_instance.docling_supervisor.shutdown()
        if ocr_pool_enabled:
            await worker_instance.ocr_supervisor.shutdown()


app = FastAPI(
    title="Careeriz Document Processor",
    version=settings.parser_version,
    lifespan=lifespan,
    # Docs endpoints are harmless to leave enabled for an internal-only,
    # network-isolated service (not exposed on the public docker-compose
    # port mapping); revisit if that changes.
)

app.include_router(health.router)
app.include_router(capabilities.router)
app.include_router(analyse.router)


@app.exception_handler(HTTPException)
async def http_exception_handler(_request: Request, exc: HTTPException) -> JSONResponse:
    # exc.detail is already a SafeErrorResponse dict for validation errors
    # raised in analyse.py; for any other HTTPException, wrap it the same
    # way so callers always get one consistent, safe error shape.
    detail = exc.detail
    if not isinstance(detail, dict) or "code" not in detail:
        detail = SafeErrorResponse(
            code="HTTP_ERROR",
            message=str(detail) if detail else "Request failed.",
            retryable=exc.status_code >= 500,
        ).model_dump()
    return JSONResponse(status_code=exc.status_code, content=detail)


@app.exception_handler(Exception)
async def unhandled_exception_handler(_request: Request, exc: Exception) -> JSONResponse:
    # Never leak a stack trace, file path, or exception internals to the
    # caller — log the type name only (never str(exc), which could contain
    # a file path or, in principle, fragments of request content).
    log_event("error", "unhandled_exception", code=type(exc).__name__)
    return JSONResponse(
        status_code=500,
        content=SafeErrorResponse(
            code="INTERNAL_ERROR",
            message="An internal error occurred while processing the request.",
            retryable=True,
        ).model_dump(),
    )
