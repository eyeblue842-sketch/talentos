"""The process-wide supervisor singletons, following the same pattern as
app/state.py's analysis_semaphore: created once at import time, driven by
main.py's lifespan handler.

Routes and tests must access these via the module
(`worker_instance.docling_supervisor` / `worker_instance.ocr_supervisor`,
`import app.worker.instance as worker_instance`), never via
`from app.worker.instance import docling_supervisor` -- the latter copies
the reference at import time, so a test that later monkeypatches
`app.worker.instance.docling_supervisor` to point at a fake-engine
supervisor would have no effect on a route module that already bound its
own local name. Module-qualified access always sees the current value.

Step 6: TWO independent supervisors, each owning its own isolated child
process -- not one supervisor hosting more engines, as Step 5 did for
Docling+preprocessing. This is the architecture requirement itself: a
Docling timeout/crash/recycle must never affect OCR, and vice versa. Two
DoclingWorkerSupervisor instances (the class name predates this split and
is generic -- it supervises "a worker process hosting one or more
engines", not literally "Docling" specifically) achieve that for free,
since each instance already manages its own independent `multiprocessing`
child, queue, timeout, and recycling policy with zero shared state between
instances.

- docling_supervisor: Docling only (structure extraction for digital
  PDF/DOCX). Never imports OpenCV/PaddleOCR.
- ocr_supervisor: preprocessing (moved out of docling_supervisor here)
  + PaddleOCR together, per the Step 6 spec ("OCR worker: Preprocessing +
  PaddleOCR"). Never imports torch/docling.
"""
from __future__ import annotations

from app.config import settings
from app.worker.supervisor import DoclingWorkerSupervisor, EngineSpec, SupervisorConfig


def _build_docling_supervisor() -> DoclingWorkerSupervisor:
    return DoclingWorkerSupervisor(
        SupervisorConfig(
            engines=[
                EngineSpec(key="docling", module="app.engines.docling_engine", cls="DoclingEngine", kwargs={}),
            ],
            conversion_timeout_seconds=settings.docling_conversion_timeout_seconds,
            queue_capacity=settings.docling_queue_capacity,
            max_documents_per_worker=settings.docling_worker_max_documents,
            max_worker_rss_mb=settings.docling_worker_max_rss_mb,
            process_start_timeout_seconds=settings.docling_process_start_timeout_seconds,
            warmup_timeout_seconds=settings.docling_warmup_timeout_seconds,
            terminate_grace_seconds=settings.docling_terminate_grace_seconds,
            shutdown_grace_seconds=settings.docling_shutdown_grace_seconds,
        )
    )


def _build_ocr_supervisor() -> DoclingWorkerSupervisor:
    return DoclingWorkerSupervisor(
        SupervisorConfig(
            engines=[
                EngineSpec(key="preprocessor", module="app.engines.preprocessor_engine", cls="PreprocessorEngine", kwargs={}),
                EngineSpec(key="ocr", module="app.engines.paddleocr_engine", cls="PaddleOCREngine", kwargs={}),
            ],
            conversion_timeout_seconds=settings.ocr_conversion_timeout_seconds,
            queue_capacity=settings.ocr_queue_capacity,
            max_documents_per_worker=settings.ocr_worker_max_documents,
            max_worker_rss_mb=settings.ocr_worker_max_rss_mb,
            process_start_timeout_seconds=settings.ocr_process_start_timeout_seconds,
            warmup_timeout_seconds=settings.ocr_warmup_timeout_seconds,
            terminate_grace_seconds=settings.ocr_terminate_grace_seconds,
            shutdown_grace_seconds=settings.ocr_shutdown_grace_seconds,
        )
    )


docling_supervisor = _build_docling_supervisor()
ocr_supervisor = _build_ocr_supervisor()

# Back-compat alias for pre-Step-6 call sites/tests that referred to "the"
# supervisor when there was only one pool. New code should name
# docling_supervisor/ocr_supervisor explicitly.
supervisor = docling_supervisor
