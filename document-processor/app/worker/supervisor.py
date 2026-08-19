"""Supervises a single, isolated worker process hosting one or more
engines (Docling, and the Step 5 image-preprocessing pipeline).

This owns the entire lifecycle the Step 4 closure measurement showed was
missing: spawning the worker, warming its engines before real traffic is
admitted, bounding how many requests can be in flight at once, enforcing
a hard timeout from OUTSIDE the worker (a stuck/hung engine cannot defeat
this -- the supervisor does not ask the worker to cooperate, it kills
it), and recreating a clean worker afterward.

Concurrency model: exactly one job (of EITHER engine) runs at a time,
sharing one admission gate -- matching the ~1.5GB measured peak RSS of a
single Docling conversion (running two heavy jobs at once, of any engine
combination, would not fit the recommended container memory). A small,
fixed-capacity admission counter allows a few requests to wait their
turn; anything beyond that is rejected immediately (ServiceBusyError),
never queued unboundedly.

Timeout mechanism: the parent waits on the result queue with
Queue.get(timeout=...), which is a real, OS-level bounded wait -- not an
asyncio.wait_for wrapped around a thread, which would cancel the asyncio
Task but leave the underlying blocking thread parked forever (a slow,
permanent leak of one thread per timeout). Wrapping the *already-bounded*
blocking call in asyncio.to_thread keeps the event loop responsive
without that leak, since the thread itself is guaranteed to return within
the timeout regardless of what the worker does.

Multi-engine model (Step 5): each engine warms up independently -- one
engine failing does not block the others from becoming available, and a
request for one engine never touches the other's dependencies (routing
an image to the preprocessor never imports torch; routing a digital PDF
to Docling never touches OpenCV).
"""
from __future__ import annotations

import asyncio
import multiprocessing
import queue
import time
import uuid
from dataclasses import dataclass, field
from enum import Enum

import psutil

from app.logging_utils import log_event
from app.worker.protocol import (
    ConvertJob,
    ConvertResult,
    EngineWarmupOutcome,
    OcrJob,
    OcrResult,
    PreprocessJob,
    PreprocessResult,
    ShutdownJob,
    WarmupJob,
    WarmupResult,
)
from app.worker.worker_process import worker_main

# Spawn everywhere (not fork), even on Linux where fork is the platform
# default: fork's copy-on-write semantics with a process that may have
# partially imported heavy ML libraries in flight is a well-known source
# of subtle hangs/corruption; spawn is slower to start but behaves
# identically cross-platform, which matters more here than shaving a few
# hundred ms off process start.
_MP_CONTEXT = multiprocessing.get_context("spawn")


class WorkerState(str, Enum):
    UNAVAILABLE = "UNAVAILABLE"  # disabled by config -- no process at all
    STARTING = "STARTING"  # process spawned, interpreter/imports not yet done
    WARMING = "WARMING"  # process alive, warm-up job in flight
    READY = "READY"  # warmed, idle, can accept work (at least one engine usable)
    BUSY = "BUSY"  # a job is currently running
    DEGRADED = "DEGRADED"  # warm-up failed for every engine; worker unusable
    RESTARTING = "RESTARTING"  # old worker was just killed, new one starting
    SHUTTING_DOWN = "SHUTTING_DOWN"
    STOPPED = "STOPPED"


READY_LIKE_STATES = {WorkerState.READY, WorkerState.BUSY}


class ServiceUnavailableError(Exception):
    def __init__(self, state: WorkerState, reason: str | None = None):
        super().__init__(f"worker unavailable in state {state.value}: {reason}")
        self.state = state
        self.reason = reason


class EngineUnavailableError(Exception):
    def __init__(self, engine: str, reason: str | None):
        super().__init__(f"engine {engine!r} is not available: {reason}")
        self.engine = engine
        self.reason = reason


class ServiceBusyError(Exception):
    pass


class ConversionTimeoutError(Exception):
    pass


class ConversionEngineError(Exception):
    def __init__(self, error_type: str | None):
        super().__init__(error_type or "unknown engine error")
        self.error_type = error_type


@dataclass
class EngineSpec:
    key: str
    module: str
    cls: str
    kwargs: dict = field(default_factory=dict)

    def as_dict(self) -> dict:
        return {"key": self.key, "module": self.module, "class": self.cls, "kwargs": self.kwargs}


@dataclass
class SupervisorConfig:
    engines: list[EngineSpec]
    conversion_timeout_seconds: float
    queue_capacity: int
    max_documents_per_worker: int
    max_worker_rss_mb: float
    process_start_timeout_seconds: float
    warmup_timeout_seconds: float
    terminate_grace_seconds: float
    shutdown_grace_seconds: float


class DoclingWorkerSupervisor:
    def __init__(self, config: SupervisorConfig):
        self._config = config
        self.state = WorkerState.UNAVAILABLE
        self.engine_availability: dict[str, EngineWarmupOutcome] = {}
        self.degraded_reason: str | None = None

        self.process: multiprocessing.process.BaseProcess | None = None
        self.job_queue = None
        self.result_queue = None
        self._documents_since_warm = 0

        # Total requests allowed "in the system" at once, across BOTH
        # engines combined: 1 actually running + queue_capacity waiting.
        self._capacity = 1 + max(0, config.queue_capacity)
        self._admitted = 0
        self._admitted_lock = asyncio.Lock()
        self._execution_lock = asyncio.Lock()
        self._restart_lock = asyncio.Lock()

    @property
    def engine_version(self) -> str | None:
        """Back-compat accessor for the "docling" engine's version
        specifically -- most existing call sites only ever cared about
        Docling's own version string."""
        outcome = self.engine_availability.get("docling")
        return outcome.version if outcome else None

    def is_engine_available(self, key: str) -> bool:
        outcome = self.engine_availability.get(key)
        return bool(outcome and outcome.success)

    # --- lifecycle -----------------------------------------------------

    async def start(self) -> None:
        await self._spawn_and_warm()

    async def shutdown(self) -> None:
        self.state = WorkerState.SHUTTING_DOWN
        try:
            await asyncio.wait_for(self._execution_lock.acquire(), timeout=self._config.shutdown_grace_seconds)
            self._execution_lock.release()
        except asyncio.TimeoutError:
            log_event("warn", "worker.shutdown_grace_period_exceeded")
        if self.process is not None and self.process.is_alive() and self.job_queue is not None:
            try:
                self.job_queue.put(ShutdownJob())
            except (OSError, ValueError):  # pragma: no cover - queue already broken
                pass
        await asyncio.to_thread(self._terminate_worker_sync)
        self.state = WorkerState.STOPPED

    async def _spawn_and_warm(self) -> None:
        self.job_queue = _MP_CONTEXT.Queue()
        self.result_queue = _MP_CONTEXT.Queue()
        ready_event = _MP_CONTEXT.Event()
        self.process = _MP_CONTEXT.Process(
            target=worker_main,
            args=(
                self.job_queue,
                self.result_queue,
                ready_event,
                [spec.as_dict() for spec in self._config.engines],
            ),
            daemon=True,
        )
        self.process.start()
        self._documents_since_warm = 0
        self.state = WorkerState.STARTING

        became_alive = await asyncio.to_thread(ready_event.wait, self._config.process_start_timeout_seconds)
        if not became_alive:
            self.state = WorkerState.DEGRADED
            self.degraded_reason = "worker process did not start in time"
            log_event("error", "worker.start_timeout")
            return

        self.state = WorkerState.WARMING
        self.job_queue.put(WarmupJob())
        try:
            result: WarmupResult = await asyncio.to_thread(self.result_queue.get, True, self._config.warmup_timeout_seconds)
        except queue.Empty:
            self.state = WorkerState.DEGRADED
            self.degraded_reason = "warm-up timed out"
            log_event("error", "worker.warmup_timeout")
            return

        self.engine_availability = result.engines
        any_available = any(outcome.success for outcome in result.engines.values())
        for key, outcome in result.engines.items():
            log_event(
                "info" if outcome.success else "warn", "worker.engine_warmup",
                engine=key, engineAvailable=outcome.success, code=outcome.error_type,
            )

        if any_available:
            self.state = WorkerState.READY
            self.degraded_reason = None
        else:
            self.state = WorkerState.DEGRADED
            self.degraded_reason = "no configured engine warmed up successfully"

    def _terminate_worker_sync(self) -> None:
        if self.process is None:
            return
        if self.process.is_alive():
            self.process.terminate()
            self.process.join(timeout=self._config.terminate_grace_seconds)
            if self.process.is_alive():
                self.process.kill()
                self.process.join(timeout=2.0)
        for q in (self.job_queue, self.result_queue):
            if q is not None:
                try:
                    q.close()
                except (OSError, ValueError):  # pragma: no cover
                    pass

    async def _terminate_and_recreate(self) -> None:
        async with self._restart_lock:
            self.state = WorkerState.RESTARTING
            await asyncio.to_thread(self._terminate_worker_sync)
            await self._spawn_and_warm()

    # --- request handling ------------------------------------------------

    async def submit(self, file_path: str, mime_type: str) -> dict:
        """Back-compat entrypoint for Docling conversion specifically."""
        return await self.submit_convert(file_path, mime_type)

    async def submit_convert(self, file_path: str, mime_type: str) -> dict:
        result = await self._submit_job(
            engine="docling",
            build_job=lambda request_id: ConvertJob(request_id=request_id, file_path=file_path, mime_type=mime_type, engine="docling"),
        )
        return result.document

    async def submit_preprocess(self, file_path: str, mime_type: str, job_temp_dir: str) -> list[dict]:
        result = await self._submit_job(
            engine="preprocessor",
            build_job=lambda request_id: PreprocessJob(
                request_id=request_id, file_path=file_path, mime_type=mime_type,
                job_temp_dir=job_temp_dir, engine="preprocessor",
            ),
        )
        return result.pages

    async def submit_ocr(self, file_path: str, mime_type: str, job_temp_dir: str, language: str = "en") -> list[dict]:
        result = await self._submit_job(
            engine="ocr",
            build_job=lambda request_id: OcrJob(
                request_id=request_id, file_path=file_path, mime_type=mime_type,
                job_temp_dir=job_temp_dir, language=language, engine="ocr",
            ),
        )
        return result.pages

    async def _submit_job(self, engine: str, build_job):
        if self.state not in READY_LIKE_STATES:
            raise ServiceUnavailableError(self.state, self.degraded_reason)
        if not self.is_engine_available(engine):
            outcome = self.engine_availability.get(engine)
            raise EngineUnavailableError(engine, outcome.error_type if outcome else "not configured")

        async with self._admitted_lock:
            if self._admitted >= self._capacity:
                raise ServiceBusyError()
            self._admitted += 1

        try:
            async with self._execution_lock:
                if self.state not in READY_LIKE_STATES:
                    raise ServiceUnavailableError(self.state, self.degraded_reason)
                if not self.is_engine_available(engine):
                    outcome = self.engine_availability.get(engine)
                    raise EngineUnavailableError(engine, outcome.error_type if outcome else "not configured")

                self.state = WorkerState.BUSY
                request_id = uuid.uuid4().hex
                job = build_job(request_id)
                self.job_queue.put(job)

                try:
                    result = await asyncio.to_thread(
                        self._blocking_wait_for_result, request_id, self._config.conversion_timeout_seconds,
                    )
                except TimeoutError:
                    log_event(
                        "warn", "worker.job_timeout", engine=engine,
                        durationMs=int(self._config.conversion_timeout_seconds * 1000),
                    )
                    await self._terminate_and_recreate()
                    raise ConversionTimeoutError() from None

                self.state = WorkerState.READY
                self._documents_since_warm += 1
                await self._maybe_recycle()

                if not result.success:
                    raise ConversionEngineError(result.error_type)
                return result
        finally:
            async with self._admitted_lock:
                self._admitted = max(0, self._admitted - 1)

    def _blocking_wait_for_result(self, request_id: str, timeout_seconds: float):
        deadline = time.monotonic() + timeout_seconds
        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise TimeoutError()
            try:
                message = self.result_queue.get(timeout=remaining)
            except queue.Empty:
                raise TimeoutError() from None
            if isinstance(message, (ConvertResult, PreprocessResult, OcrResult)) and message.request_id == request_id:
                return message
            # A stale message from an earlier request (should not happen
            # given concurrency=1, but discarding rather than trusting it
            # is the safe default) -- keep waiting within the same deadline.

    async def _maybe_recycle(self) -> None:
        reason = None
        if self._documents_since_warm >= self._config.max_documents_per_worker:
            reason = "document count threshold reached"
        else:
            rss_mb = self._current_worker_rss_mb()
            if rss_mb is not None and rss_mb >= self._config.max_worker_rss_mb:
                reason = "memory threshold reached"
        if reason:
            log_event("info", "worker.recycling", code=reason)
            await self._terminate_and_recreate()

    def _current_worker_rss_mb(self) -> float | None:
        if self.process is None or not self.process.is_alive():
            return None
        try:
            return psutil.Process(self.process.pid).memory_info().rss / (1024 * 1024)
        except psutil.NoSuchProcess:  # pragma: no cover - process exited between checks
            return None

    # --- introspection ---------------------------------------------------

    def snapshot(self) -> dict:
        active = 1 if self.state == WorkerState.BUSY else 0
        return {
            "state": self.state.value,
            "engineVersion": self.engine_version,
            "degradedReason": self.degraded_reason,
            "activeConversions": active,
            "queuedRequests": max(0, self._admitted - active),
            "queueCapacity": self._capacity,
            "documentsSinceWarm": self._documents_since_warm,
            "engines": {
                key: {"available": outcome.success, "version": outcome.version, "reason": outcome.error_type}
                for key, outcome in self.engine_availability.items()
            },
        }
