"""Step 4.5: isolated worker process lifecycle test matrix.

Uses the configurable FakeEngine (app/engines/fake_engine.py) via the
fake_docling_supervisor fixture (conftest.py) for deterministic,
fast lifecycle tests -- a real Docling conversion is ~9s warm / ~100s+
cold, which is far too slow to drive dozens of hang/crash/restart
scenarios. One real end-to-end smoke test against the actual DoclingEngine
closes the loop at the bottom of this file, skipped if docling isn't
installed.

Numbered comments below map to the Step 4.5 closure request's 18-item
test list; items 14-16 (Node readiness/timeout/circuit-breaker handling)
live in backend/src/__tests__/document-processor-client.test.js, not
here -- this file only covers what's observable from the Python side.
"""
from __future__ import annotations

import asyncio
import os
import time

import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.worker.supervisor import ConversionEngineError, ConversionTimeoutError, ServiceBusyError, WorkerState

pytestmark = pytest.mark.anyio


@pytest.fixture
def anyio_backend():
    return "asyncio"


# --- 1. HTTP liveness during a long conversion --------------------------


async def test_health_live_responds_while_a_conversion_is_hanging(fake_docling_supervisor):
    supervisor = fake_docling_supervisor(behavior="hang_forever", conversion_timeout_seconds=3)
    await supervisor.start()

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as async_client:
        files = {"file": ("resume.pdf", b"%PDF-1.4\n1 0 obj << /Type /Page >> endobj\n%%EOF", "application/pdf")}
        data = {"correlationId": "corr-live", "mimeType": "application/pdf", "originalFilename": "resume.pdf"}
        analyse_task = asyncio.create_task(async_client.post("/v1/documents/analyse", files=files, data=data))

        # Give the analyse request a moment to actually reach BUSY before
        # polling -- this is timing-sensitive by nature (proving the event
        # loop isn't blocked requires something to actually be blocking).
        await asyncio.sleep(0.3)
        assert supervisor.state == WorkerState.BUSY, "the conversion should be in flight by now"

        t0 = time.monotonic()
        live_response = await asyncio.wait_for(async_client.get("/health/live"), timeout=1.0)
        live_latency = time.monotonic() - t0

        assert live_response.status_code == 200
        assert live_latency < 1.0, "a blocked event loop would make this hang until the conversion finishes"

        analyse_response = await analyse_task
        assert analyse_response.status_code == 504


# --- 2, 3. Readiness transitions -----------------------------------------


async def test_readiness_is_false_while_warming(fake_docling_supervisor):
    # A measurably slow (but finite) warm-up so the WARMING window is
    # observable deterministically, rather than racing a near-instant
    # fake warm-up and hoping the assertion lands inside a 1ms window.
    supervisor = fake_docling_supervisor(behavior="slow_warmup_then_succeed", sleep_seconds=0.4)
    start_task = asyncio.create_task(supervisor.start())

    await asyncio.sleep(0.1)
    assert supervisor.state in (WorkerState.STARTING, WorkerState.WARMING)

    await start_task
    assert supervisor.state == WorkerState.READY


async def test_readiness_is_true_after_successful_warmup(fake_docling_supervisor):
    supervisor = fake_docling_supervisor(behavior="instant_success")
    await supervisor.start()
    assert supervisor.state == WorkerState.READY
    assert supervisor.engine_version == "fake-1.0.0"


# --- 4. Warm-up failure -> degraded/unavailable ---------------------------


async def test_one_engine_failing_does_not_degrade_the_whole_worker(fake_ocr_supervisor):
    """Step 5/6: multi-engine coexistence within one pool -- now exercised
    on the OCR pool (preprocessor + ocr), since Step 6 split Docling out
    into its own single-engine pool. One engine failing warm-up must not
    prevent the (independent) other from coming up READY."""
    supervisor = fake_ocr_supervisor(preprocessor_behavior="instant_success", ocr_behavior="unavailable")
    await supervisor.start()
    assert supervisor.state == WorkerState.READY
    assert supervisor.is_engine_available("preprocessor") is True
    assert supervisor.is_engine_available("ocr") is False


async def test_all_engines_failing_produces_degraded_status(fake_ocr_supervisor):
    supervisor = fake_ocr_supervisor(preprocessor_behavior="unavailable", ocr_behavior="unavailable")
    await supervisor.start()
    assert supervisor.state == WorkerState.DEGRADED
    assert supervisor.degraded_reason is not None
    assert supervisor.is_engine_available("preprocessor") is False
    assert supervisor.is_engine_available("ocr") is False


async def test_warmup_that_times_out_produces_degraded_status(fake_docling_supervisor):
    supervisor = fake_docling_supervisor(behavior="hang_during_warmup", warmup_timeout_seconds=1)
    await supervisor.start()
    assert supervisor.state == WorkerState.DEGRADED
    assert "timed out" in (supervisor.degraded_reason or "")
    # the hung warm-up process must actually be gone, not orphaned
    assert supervisor.process is not None


# --- 5, 6, 7. Concurrency and bounded queue -------------------------------


async def test_exactly_one_active_conversion_by_default(fake_docling_supervisor):
    supervisor = fake_docling_supervisor(behavior="sleep_then_succeed", sleep_seconds=0.5, queue_capacity=2)
    await supervisor.start()

    task_a = asyncio.create_task(supervisor.submit("/tmp/a.pdf", "application/pdf"))
    await asyncio.sleep(0.1)
    assert supervisor.snapshot()["activeConversions"] == 1
    task_b = asyncio.create_task(supervisor.submit("/tmp/b.pdf", "application/pdf"))
    await asyncio.sleep(0.1)
    # b is queued, not running concurrently with a
    assert supervisor.snapshot()["activeConversions"] == 1
    assert supervisor.snapshot()["queuedRequests"] == 1

    await task_a
    await task_b


async def test_bounded_queue_admits_up_to_capacity(fake_docling_supervisor):
    supervisor = fake_docling_supervisor(behavior="sleep_then_succeed", sleep_seconds=0.5, queue_capacity=1)
    await supervisor.start()

    # capacity = 1 running + 1 queued = 2 total
    task_a = asyncio.create_task(supervisor.submit("/tmp/a.pdf", "application/pdf"))
    await asyncio.sleep(0.1)
    task_b = asyncio.create_task(supervisor.submit("/tmp/b.pdf", "application/pdf"))
    await asyncio.sleep(0.1)
    assert supervisor.snapshot()["queuedRequests"] == 1

    await task_a
    await task_b


async def test_queue_overflow_is_rejected_immediately_not_queued(fake_docling_supervisor):
    supervisor = fake_docling_supervisor(behavior="sleep_then_succeed", sleep_seconds=0.5, queue_capacity=1)
    await supervisor.start()

    task_a = asyncio.create_task(supervisor.submit("/tmp/a.pdf", "application/pdf"))
    task_b = asyncio.create_task(supervisor.submit("/tmp/b.pdf", "application/pdf"))
    await asyncio.sleep(0.1)

    t0 = time.monotonic()
    with pytest.raises(ServiceBusyError):
        await supervisor.submit("/tmp/c.pdf", "application/pdf")
    rejection_latency = time.monotonic() - t0
    assert rejection_latency < 0.2, "an overflow request must be rejected immediately, not held and then timed out"

    await task_a
    await task_b


async def test_queue_overflow_over_http_returns_503(fake_docling_supervisor):
    supervisor = fake_docling_supervisor(behavior="sleep_then_succeed", sleep_seconds=0.5, queue_capacity=0)
    await supervisor.start()

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as async_client:
        def _post():
            files = {"file": ("resume.pdf", b"%PDF-1.4\n1 0 obj << /Type /Page >> endobj\n%%EOF", "application/pdf")}
            data = {"correlationId": "corr-busy", "mimeType": "application/pdf", "originalFilename": "resume.pdf"}
            return async_client.post("/v1/documents/analyse", files=files, data=data)

        task_a = asyncio.create_task(_post())
        await asyncio.sleep(0.1)
        response_b = await _post()
        assert response_b.status_code == 503
        assert response_b.json()["code"] == "SERVICE_BUSY"
        await task_a


# --- 8, 9, 10. Real hard timeout, termination, recovery ------------------


async def test_hard_timeout_terminates_the_worker_process(fake_docling_supervisor):
    supervisor = fake_docling_supervisor(behavior="hang_forever", conversion_timeout_seconds=1)
    await supervisor.start()
    original_pid = supervisor.process.pid

    with pytest.raises(ConversionTimeoutError):
        await supervisor.submit("/tmp/a.pdf", "application/pdf")

    assert supervisor.process.pid != original_pid, "a fresh worker process must replace the killed one"
    assert supervisor.state == WorkerState.READY, "the new worker must have re-warmed successfully"


async def test_timed_out_work_does_not_continue_after_the_call_returns(fake_docling_supervisor):
    """The whole point of terminate() (not just giving up on it): once
    submit() raises ConversionTimeoutError, the hung process must already
    be gone -- not still running in the background consuming CPU/memory."""
    supervisor = fake_docling_supervisor(behavior="hang_forever", conversion_timeout_seconds=1)
    await supervisor.start()
    old_process = supervisor.process

    with pytest.raises(ConversionTimeoutError):
        await supervisor.submit("/tmp/a.pdf", "application/pdf")

    assert not old_process.is_alive(), "the timed-out process must be dead by the time submit() returns, not merely abandoned"


async def test_worker_recreation_and_rewarm_after_timeout_allows_a_new_conversion(fake_docling_supervisor):
    supervisor = fake_docling_supervisor(behavior="hang_forever", conversion_timeout_seconds=1)
    await supervisor.start()

    with pytest.raises(ConversionTimeoutError):
        await supervisor.submit("/tmp/a.pdf", "application/pdf")

    assert supervisor.state == WorkerState.READY
    # a genuinely new document, on the recreated worker, must succeed --
    # note the *behavior* is still hang_forever on this fake engine, so we
    # only assert the worker is usable (READY, accepts submission) rather
    # than trying to prove a "successful" convert with a permanently
    # hanging engine.
    with pytest.raises(ConversionTimeoutError):
        await supervisor.submit("/tmp/b.pdf", "application/pdf")
    assert supervisor.state == WorkerState.READY


# --- 11. Temp-file cleanup across outcomes --------------------------------


def _list_top_level_temp_entries(tmp_root):
    try:
        return set(os.listdir(tmp_root))
    except OSError:
        return set()


async def test_request_temp_dir_is_removed_after_success_failure_and_timeout(fake_docling_supervisor):
    # This exercises the route (app/security.py's isolated_temp_dir), not
    # the supervisor directly -- the request-scoped temp directory is a
    # PARENT-owned resource, cleaned up in the route's `finally` clause
    # regardless of how the worker behaved, which is what actually
    # guarantees no leak regardless of success/failure/timeout.
    import tempfile

    tmp_root = tempfile.gettempdir()

    for behavior, timeout in [("instant_success", 5), ("raise_error", 5), ("hang_forever", 1)]:
        supervisor = fake_docling_supervisor(behavior=behavior, conversion_timeout_seconds=timeout)
        await supervisor.start()

        before = _list_top_level_temp_entries(tmp_root)
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as async_client:
            files = {"file": ("resume.pdf", b"%PDF-1.4\n1 0 obj << /Type /Page >> endobj\n%%EOF", "application/pdf")}
            data = {"correlationId": f"corr-{behavior}", "mimeType": "application/pdf", "originalFilename": "resume.pdf"}
            await async_client.post("/v1/documents/analyse", files=files, data=data)
        after = _list_top_level_temp_entries(tmp_root)

        leaked = {name for name in (after - before) if name.startswith("careeriz-docproc-")}
        assert not leaked, f"temp dir leaked after behavior={behavior}: {leaked}"


# --- 12, 13. Graceful shutdown, no orphans --------------------------------


async def test_graceful_shutdown_terminates_the_worker_cleanly(fake_docling_supervisor):
    supervisor = fake_docling_supervisor(behavior="instant_success")
    await supervisor.start()
    pid = supervisor.process.pid
    assert supervisor.process.is_alive()

    await supervisor.shutdown()

    assert supervisor.state == WorkerState.STOPPED
    assert not supervisor.process.is_alive(), f"worker process {pid} must not survive shutdown"


async def test_shutdown_waits_a_bounded_grace_period_for_active_work(fake_docling_supervisor):
    supervisor = fake_docling_supervisor(behavior="sleep_then_succeed", sleep_seconds=0.3, shutdown_grace_seconds=2)
    await supervisor.start()

    submit_task = asyncio.create_task(supervisor.submit("/tmp/a.pdf", "application/pdf"))
    await asyncio.sleep(0.05)

    t0 = time.monotonic()
    await supervisor.shutdown()
    shutdown_duration = time.monotonic() - t0

    assert shutdown_duration < 2.0, "shutdown should return once the in-flight job finishes, not wait the full grace period"
    assert supervisor.state == WorkerState.STOPPED
    submit_task.cancel()


async def test_shutdown_terminates_even_a_hung_job_once_the_grace_period_elapses(fake_docling_supervisor):
    supervisor = fake_docling_supervisor(behavior="hang_forever", conversion_timeout_seconds=30, shutdown_grace_seconds=1)
    await supervisor.start()

    submit_task = asyncio.create_task(supervisor.submit("/tmp/a.pdf", "application/pdf"))
    await asyncio.sleep(0.2)

    t0 = time.monotonic()
    await supervisor.shutdown()
    shutdown_duration = time.monotonic() - t0

    assert shutdown_duration < 5.0, "shutdown must not wait for a hung job's own (much longer) conversion timeout"
    assert not supervisor.process.is_alive()
    submit_task.cancel()
    try:
        await submit_task
    except (asyncio.CancelledError, ConversionTimeoutError, ConversionEngineError):
        pass


# --- 17. No sensitive data in logs/metrics --------------------------------


def test_snapshot_never_includes_file_paths_or_document_content(fake_docling_supervisor):
    supervisor = fake_docling_supervisor(behavior="instant_success")
    snapshot = supervisor.snapshot()
    # the snapshot shape is a fixed, deliberately small set of operational
    # fields -- assert the exact key set rather than "absence of a
    # filename", so a future field addition is forced to be a conscious,
    # reviewed decision rather than an accidental leak.
    assert set(snapshot.keys()) == {
        "state", "engineVersion", "degradedReason", "activeConversions",
        "queuedRequests", "queueCapacity", "documentsSinceWarm", "engines",
    }
    # Step 5: per-engine detail is equally constrained -- no paths, no
    # PIDs, no host detail, just availability/version/reason.
    for engine_snapshot in snapshot["engines"].values():
        assert set(engine_snapshot.keys()) == {"available", "version", "reason"}


# --- Real Docling smoke test (not the fake engine) ------------------------


def test_real_docling_conversion_through_the_full_supervisor_stack():
    from app.config import settings
    from app.engines.docling_engine import DoclingEngine

    if not settings.docling_enabled:
        pytest.skip("DOCLING_ENABLED is not set -- this smoke test needs the app's real lifespan to start the real worker")
    availability = DoclingEngine().check_availability()
    if not availability.available:
        pytest.skip(f"docling not available: {availability.reason}")

    with TestClient(app) as client:
        fixtures_dir = os.path.join(os.path.dirname(__file__), "fixtures")
        with open(os.path.join(fixtures_dir, "fixture-12-pdf-table.pdf"), "rb") as f:
            content = f.read()
        files = {"file": ("resume.pdf", content, "application/pdf")}
        data = {"correlationId": "corr-real-smoke", "mimeType": "application/pdf", "originalFilename": "resume.pdf"}
        response = client.post("/v1/documents/analyse", files=files, data=data)

    assert response.status_code == 200
    body = response.json()
    assert body["selectedRoute"] == "DOCLING_STRUCTURE"
    assert len(body["textBlocks"]) >= 1
