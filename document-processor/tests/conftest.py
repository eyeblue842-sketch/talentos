import asyncio
import sys
from pathlib import Path

# Allow `from app...` imports when pytest is run from the document-processor/
# directory without an installed package.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest  # noqa: E402

import app.worker.instance as worker_instance  # noqa: E402
from app.worker.supervisor import DoclingWorkerSupervisor, EngineSpec, SupervisorConfig  # noqa: E402

_DEFAULT_TEST_TIMEOUTS = {
    "conversion_timeout_seconds": 3,
    "queue_capacity": 1,
    "max_documents_per_worker": 1000,
    "max_worker_rss_mb": 99999,
    "process_start_timeout_seconds": 10,
    "warmup_timeout_seconds": 10,
    "terminate_grace_seconds": 2,
    "shutdown_grace_seconds": 5,
}


@pytest.fixture
def fake_docling_supervisor(monkeypatch):
    """Swaps the process-wide Docling supervisor singleton
    (app.worker.instance.docling_supervisor) for one pointed at the
    configurable FakeEngine instead of the real DoclingEngine, so worker
    lifecycle tests (hangs, crashes, restarts) are deterministic and fast
    rather than depending on a real ~9s conversion or fabricating a fake
    102s cold start every run.

    Step 6: the Docling pool hosts ONLY the "docling" engine key now
    (preprocessing + OCR moved to their own pool -- see
    fake_ocr_supervisor below and app/worker/instance.py). Returns a
    factory: fake_docling_supervisor(behavior=..., sleep_seconds=...,
    **timeout_overrides) -> DoclingWorkerSupervisor (not yet started).
    Every supervisor built through the factory is torn down
    automatically.
    """
    created: list[DoclingWorkerSupervisor] = []

    def _make(behavior: str = "instant_success", sleep_seconds: float = 0.0, **overrides) -> DoclingWorkerSupervisor:
        params = {**_DEFAULT_TEST_TIMEOUTS, **overrides}
        config = SupervisorConfig(
            engines=[
                EngineSpec(
                    key="docling", module="app.engines.fake_engine", cls="FakeEngine",
                    kwargs={"behavior": behavior, "sleep_seconds": sleep_seconds},
                ),
            ],
            **params,
        )
        supervisor = DoclingWorkerSupervisor(config)
        monkeypatch.setattr(worker_instance, "docling_supervisor", supervisor)
        created.append(supervisor)
        return supervisor

    yield _make

    for supervisor in created:
        if supervisor.process is not None:
            asyncio.run(supervisor.shutdown())


@pytest.fixture
def fake_ocr_supervisor(monkeypatch):
    """Same pattern as fake_docling_supervisor, for the Step 6 OCR pool
    (app.worker.instance.ocr_supervisor), which hosts BOTH "preprocessor"
    and "ocr" engine keys via FakeEngine.

    `ocr_behavior` defaults to "unavailable" (NOT "instant_success", the
    convention fake_docling_supervisor uses for its untested engine) --
    deliberately, because a test that only wants to exercise the
    preprocessor-only fallback path (an image upload when OCR itself
    isn't ready) needs OCR to genuinely be unavailable for that fallback
    to trigger at all; a trivially-succeeding "ocr" would silently change
    which code path the request takes. Tests that specifically want to
    exercise the OCR path pass ocr_behavior explicitly.

    Returns a factory: fake_ocr_supervisor(preprocessor_behavior=...,
    preprocessor_sleep_seconds=..., ocr_behavior=..., ocr_sleep_seconds=...,
    **timeout_overrides) -> DoclingWorkerSupervisor (not yet started).
    """
    created: list[DoclingWorkerSupervisor] = []

    def _make(
        preprocessor_behavior: str = "instant_success",
        preprocessor_sleep_seconds: float = 0.0,
        ocr_behavior: str = "unavailable",
        ocr_sleep_seconds: float = 0.0,
        **overrides,
    ) -> DoclingWorkerSupervisor:
        params = {**_DEFAULT_TEST_TIMEOUTS, **overrides}
        config = SupervisorConfig(
            engines=[
                EngineSpec(
                    key="preprocessor", module="app.engines.fake_engine", cls="FakeEngine",
                    kwargs={"behavior": preprocessor_behavior, "sleep_seconds": preprocessor_sleep_seconds},
                ),
                EngineSpec(
                    key="ocr", module="app.engines.fake_engine", cls="FakeEngine",
                    kwargs={"behavior": ocr_behavior, "sleep_seconds": ocr_sleep_seconds},
                ),
            ],
            **params,
        )
        supervisor = DoclingWorkerSupervisor(config)
        monkeypatch.setattr(worker_instance, "ocr_supervisor", supervisor)
        created.append(supervisor)
        return supervisor

    yield _make

    for supervisor in created:
        if supervisor.process is not None:
            asyncio.run(supervisor.shutdown())
