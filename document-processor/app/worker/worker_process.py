"""The conversion worker's own process entrypoint. Runs in a child
process spawned by the supervisor (never imported/run in the main FastAPI
process) — this is deliberate isolation: a native/ML crash, an infinite
loop, or unbounded memory growth in here can never take down the HTTP
process, and the supervisor can terminate this entire process (SIGTERM,
escalating to SIGKILL) without touching the parent.

Must be a real top-level, module-level function (not a closure/lambda) so
it can be pickled and referenced by multiprocessing's "spawn" start
method, which this service uses everywhere (see supervisor.py) for
cross-platform consistency between local Windows development and the
Linux container target.

Step 5: this worker hosts more than one engine (docling, and the new
image-preprocessing pipeline). Both are constructed at process start
(construction itself is cheap -- it's warmup() that pays any real model
or first-use cost) and both are warmed independently on WarmupJob, so a
Docling warm-up failure doesn't block preprocessing from coming up READY
and vice versa. A given request only ever invokes the one engine its job
names -- routing digital PDFs to Docling never touches OpenCV, and
routing an image to the preprocessor never touches torch.
"""
from __future__ import annotations

import importlib
import queue as queue_module

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


def _build_engine(engine_module: str, engine_class: str, engine_kwargs: dict):
    module = importlib.import_module(engine_module)
    engine_cls = getattr(module, engine_class)
    return engine_cls(**engine_kwargs)


def worker_main(
    job_queue,
    result_queue,
    ready_event,
    engines_config: list[dict],
) -> None:
    """`engines_config` is a list of {"key", "module", "class", "kwargs"}
    dicts, one per engine this worker should host.

    `ready_event` is set the moment this loop is actually polling the job
    queue -- distinct from engine warm-up (a WarmupJob is a normal
    message on the queue, handled like any other). This just tells the
    supervisor "the process itself is alive and listening," so it doesn't
    have to guess how long process startup + Python interpreter init +
    module import takes before it's safe to enqueue the warm-up job."""
    engines = {
        spec["key"]: _build_engine(spec["module"], spec["class"], spec["kwargs"])
        for spec in engines_config
    }
    ready_event.set()

    while True:
        job = job_queue.get()  # blocks until the supervisor sends something

        if isinstance(job, ShutdownJob):
            return

        if isinstance(job, WarmupJob):
            outcomes = {}
            for key, engine in engines.items():
                try:
                    # engine.warmup() (not check_availability()) -- for
                    # engines with a real one-time cost (Docling's model
                    # loading) this actually pays that cost now, inside
                    # this worker process, before any real request is
                    # admitted. Each engine's failure is independent: one
                    # engine being unavailable doesn't fail the others.
                    availability = engine.warmup()
                    outcomes[key] = EngineWarmupOutcome(
                        success=availability.available,
                        version=availability.version,
                        error_type=None if availability.available else availability.reason,
                    )
                except Exception as error:  # noqa: BLE001 - one engine's warm-up failure must never crash the loop or block the others
                    outcomes[key] = EngineWarmupOutcome(success=False, version=None, error_type=type(error).__name__)
            result_queue.put(WarmupResult(engines=outcomes))
            continue

        if isinstance(job, ConvertJob):
            engine = engines.get(job.engine)
            try:
                if engine is None:
                    raise LookupError(f"no such engine configured: {job.engine}")
                document = engine.analyse(job.file_path, job.mime_type)
                result_queue.put(ConvertResult(request_id=job.request_id, success=True, document=document))
            except Exception as error:  # noqa: BLE001 - one bad document must never crash the worker loop
                # error_message is a fixed, safe string -- never str(error),
                # which could echo a file path or document content back
                # into something that gets logged.
                result_queue.put(
                    ConvertResult(
                        request_id=job.request_id,
                        success=False,
                        error_type=type(error).__name__,
                        error_message="Engine raised during conversion.",
                    )
                )
            continue

        if isinstance(job, PreprocessJob):
            engine = engines.get(job.engine)
            try:
                if engine is None:
                    raise LookupError(f"no such engine configured: {job.engine}")
                pages = engine.preprocess(job.file_path, job.mime_type, job.job_temp_dir)
                result_queue.put(PreprocessResult(request_id=job.request_id, success=True, pages=pages))
            except Exception as error:  # noqa: BLE001 - one malformed image must never crash the worker loop
                result_queue.put(
                    PreprocessResult(
                        request_id=job.request_id,
                        success=False,
                        error_type=type(error).__name__,
                        error_message="Preprocessor raised during processing.",
                    )
                )
            continue

        if isinstance(job, OcrJob):
            engine = engines.get(job.engine)
            try:
                if engine is None:
                    raise LookupError(f"no such engine configured: {job.engine}")
                pages = engine.ocr(job.file_path, job.mime_type, job.job_temp_dir, job.language)
                result_queue.put(OcrResult(request_id=job.request_id, success=True, pages=pages))
            except Exception as error:  # noqa: BLE001 - one bad document must never crash the worker loop
                result_queue.put(
                    OcrResult(
                        request_id=job.request_id,
                        success=False,
                        error_type=type(error).__name__,
                        error_message="OCR engine raised during processing.",
                    )
                )
            continue


def drain_queue_without_blocking(q) -> None:
    """Best-effort cleanup helper: empties a multiprocessing.Queue so its
    background feeder thread doesn't keep the process alive after the
    queue is otherwise abandoned. Never raises."""
    while True:
        try:
            q.get_nowait()
        except queue_module.Empty:
            return
        except (OSError, ValueError):  # pragma: no cover - queue already closed/torn down
            return
