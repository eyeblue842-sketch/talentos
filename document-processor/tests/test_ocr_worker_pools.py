"""Step 6: OCR worker pool isolation, capability-specific readiness, and
the security/reliability test matrix the Step 6 spec explicitly requested
(items numbered below match that spec's numbering). Uses fake_docling_supervisor
and fake_ocr_supervisor (conftest.py) -- both patch the module-level
singletons independently, exactly mirroring the real two-pool architecture
in app/worker/instance.py, so "does killing/recreating one pool affect the
other" is a genuine question these tests can answer, not a tautology.
"""
from __future__ import annotations

import asyncio
import logging
import os
import sys
import time
import types

import httpx
import pytest
from fastapi.testclient import TestClient

from app import config as config_module
from app.config import settings
from app.main import app
from app.worker.supervisor import ConversionTimeoutError, WorkerState

pytestmark = pytest.mark.anyio


@pytest.fixture
def anyio_backend():
    return "asyncio"


_MINIMAL_JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 64


def _image_multipart(correlation_id="corr-ocr-1"):
    return (
        {"file": ("photo.jpg", _MINIMAL_JPEG, "image/jpeg")},
        {"correlationId": correlation_id, "mimeType": "image/jpeg", "originalFilename": "photo.jpg"},
    )


# --- 1. /health/live remains responsive during OCR ------------------------


async def test_health_live_responds_while_ocr_is_hanging(fake_ocr_supervisor):
    supervisor = fake_ocr_supervisor(ocr_behavior="hang_forever", conversion_timeout_seconds=3)
    await supervisor.start()

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        files, data = _image_multipart()
        task = asyncio.create_task(client.post("/v1/documents/analyse", files=files, data=data))

        await asyncio.sleep(0.3)
        assert supervisor.state == WorkerState.BUSY, "the OCR job should be in flight by now"

        t0 = time.monotonic()
        live = await asyncio.wait_for(client.get("/health/live"), timeout=1.0)
        assert live.status_code == 200
        assert time.monotonic() - t0 < 1.0, "a blocked event loop would make this hang until OCR finishes"

        response = await task
        assert response.status_code == 504


# --- 2, 3. OCR hard timeout kills the actual process; work does not continue -


async def test_ocr_hard_timeout_terminates_the_worker_process(fake_ocr_supervisor):
    supervisor = fake_ocr_supervisor(ocr_behavior="hang_forever", conversion_timeout_seconds=1)
    await supervisor.start()
    original_pid = supervisor.process.pid
    old_process = supervisor.process

    with pytest.raises(ConversionTimeoutError):
        await supervisor.submit_ocr("/tmp/a.jpg", "image/jpeg", "/tmp/ocr-job-a")

    assert not old_process.is_alive(), "the timed-out OCR process must be dead by the time submit_ocr() returns"
    assert supervisor.process.pid != original_pid, "a fresh OCR worker must replace the killed one"
    assert supervisor.state == WorkerState.READY, "the new OCR worker must have re-warmed successfully"


# --- 4, 5. Cross-pool isolation: one pool's crash/restart never affects the other -


async def test_ocr_timeout_and_restart_does_not_affect_docling(fake_docling_supervisor, fake_ocr_supervisor):
    docling = fake_docling_supervisor(behavior="instant_success")
    ocr = fake_ocr_supervisor(ocr_behavior="hang_forever", conversion_timeout_seconds=1)
    await docling.start()
    await ocr.start()

    docling_pid_before = docling.process.pid

    with pytest.raises(ConversionTimeoutError):
        await ocr.submit_ocr("/tmp/a.jpg", "image/jpeg", "/tmp/ocr-job-b")

    assert ocr.process.pid != docling_pid_before  # sanity: genuinely different processes
    assert docling.process.pid == docling_pid_before, "Docling's worker process must be untouched by an OCR timeout/restart"
    assert docling.state == WorkerState.READY
    # Docling must still be able to do real work after the OCR restart.
    result = await docling.submit("/tmp/resume.pdf", "application/pdf")
    assert result["textBlocks"][0]["text"] == "fake engine output"


async def test_docling_timeout_and_restart_does_not_affect_ocr(fake_docling_supervisor, fake_ocr_supervisor):
    docling = fake_docling_supervisor(behavior="hang_forever", conversion_timeout_seconds=1)
    ocr = fake_ocr_supervisor(ocr_behavior="instant_success")
    await docling.start()
    await ocr.start()

    ocr_pid_before = ocr.process.pid

    with pytest.raises(ConversionTimeoutError):
        await docling.submit("/tmp/a.pdf", "application/pdf")

    assert ocr.process.pid == ocr_pid_before, "the OCR worker process must be untouched by a Docling timeout/restart"
    assert ocr.state == WorkerState.READY
    pages = await ocr.submit_ocr("/tmp/photo.jpg", "image/jpeg", "/tmp/ocr-job-c")
    assert pages[0]["textBlocks"][0]["text"] == "fake ocr output"


# --- 6. Queue overflow returns SERVICE_BUSY promptly -----------------------


async def test_ocr_queue_overflow_over_http_returns_503(fake_ocr_supervisor):
    supervisor = fake_ocr_supervisor(ocr_behavior="sleep_then_succeed", ocr_sleep_seconds=0.5, queue_capacity=0)
    await supervisor.start()

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        files_a, data_a = _image_multipart("corr-busy-a")
        task_a = asyncio.create_task(client.post("/v1/documents/analyse", files=files_a, data=data_a))
        await asyncio.sleep(0.1)

        files_b, data_b = _image_multipart("corr-busy-b")
        response_b = await client.post("/v1/documents/analyse", files=files_b, data=data_b)
        assert response_b.status_code == 503
        assert response_b.json()["code"] == "SERVICE_BUSY"
        await task_a


# --- 7. Capability-specific readiness blocks routes whose engine is unavailable -


async def test_pool_ready_but_specific_engine_unavailable_falls_back_correctly(fake_ocr_supervisor):
    """The OCR pool as a whole is READY (preprocessor warmed up fine) but
    the "ocr" engine specifically failed -- an image upload must fall back
    to preprocessing-only (IMAGE_PREPROCESSED), never claim OCR_EXTRACTED
    just because the pool reports READY."""
    supervisor = fake_ocr_supervisor(preprocessor_behavior="instant_success", ocr_behavior="unavailable")
    await supervisor.start()
    assert supervisor.state == WorkerState.READY  # the pool itself is up...
    assert supervisor.is_engine_available("ocr") is False  # ...but OCR specifically is not

    with TestClient(app) as client:
        files, data = _image_multipart("corr-capability-check")
        response = client.post("/v1/documents/analyse", files=files, data=data)

    assert response.status_code == 200
    body = response.json()
    assert body["selectedRoute"] == "IMAGE_PREPROCESSED", "must not report OCR_EXTRACTED when only the pool, not the ocr engine, is ready"
    assert body["ocrTextBlocks"] == []
    assert any("ocr" in reason for reason in body["fallbackReasons"])


# --- 8. Temp files cleaned after success, failure, timeout ------------------


def _list_top_level_temp_entries(tmp_root):
    try:
        return set(os.listdir(tmp_root))
    except OSError:
        return set()


async def test_ocr_request_temp_dir_is_removed_after_success_failure_and_timeout(fake_ocr_supervisor):
    import tempfile

    tmp_root = tempfile.gettempdir()

    for behavior, timeout in [("instant_success", 5), ("raise_error", 5), ("hang_forever", 1)]:
        supervisor = fake_ocr_supervisor(ocr_behavior=behavior, conversion_timeout_seconds=timeout)
        await supervisor.start()

        before = _list_top_level_temp_entries(tmp_root)
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            files, data = _image_multipart(f"corr-cleanup-{behavior}")
            await client.post("/v1/documents/analyse", files=files, data=data)
        after = _list_top_level_temp_entries(tmp_root)

        leaked = {name for name in (after - before) if name.startswith("careeriz-docproc-")}
        assert not leaked, f"temp dir leaked after ocr behavior={behavior}: {leaked}"


# --- 9. No filenames/PII/paths leak through logs ----------------------------


def test_no_filename_or_path_in_logs_for_ocr_request(fake_ocr_supervisor, caplog):
    caplog.set_level(logging.INFO, logger="document-processor")
    supervisor = fake_ocr_supervisor(ocr_behavior="instant_success")
    asyncio.run(supervisor.start())

    sensitive_filename = "Jane_Doe_Aadhaar_9999-8888-7777.jpg"
    with TestClient(app) as client:
        files = {"file": (sensitive_filename, _MINIMAL_JPEG, "image/jpeg")}
        data = {"correlationId": "corr-log-check", "mimeType": "image/jpeg", "originalFilename": sensitive_filename}
        response = client.post("/v1/documents/analyse", files=files, data=data)
    assert response.status_code == 200

    log_text = "\n".join(record.message for record in caplog.records)
    assert sensitive_filename not in log_text
    assert "9999-8888-7777" not in log_text


# --- 10. Model construction cannot happen unexpectedly during a request -----


def test_paddleocr_engine_constructs_the_pipeline_only_once(monkeypatch):
    """Proves warmup() -> _get_ocr() constructs the (fake, stand-in)
    PaddleOCR pipeline exactly once, and subsequent ocr() calls reuse the
    cached instance rather than reconstructing -- reconstruction is the
    operation that could, in the real package, trigger a model
    load/download; a request-time reconstruction would be the "uncontrolled
    download during a user request" the Step 6 spec explicitly forbids.
    Uses a fake `paddleocr` module injected into sys.modules so this runs
    without the real (uninstallable in this environment) package."""
    from app.config import settings
    from app.engines.paddleocr_engine import PaddleOCREngine

    construction_count = {"n": 0}

    class _FakePaddleOCR:
        def __init__(self, **kwargs):
            construction_count["n"] += 1

        def predict(self, _image):
            return [{"rec_texts": ["hi"], "rec_scores": [0.9], "rec_polys": [[[0, 0], [1, 0], [1, 1], [0, 1]]]}]

    fake_module = types.ModuleType("paddleocr")
    fake_module.PaddleOCR = _FakePaddleOCR
    monkeypatch.setitem(sys.modules, "paddleocr", fake_module)

    engine = PaddleOCREngine()
    engine._get_ocr(settings.ocr_language)
    assert construction_count["n"] == 1

    import numpy as np

    image = np.zeros((10, 10, 3), dtype="uint8")
    engine._run_ocr(image)
    engine._run_ocr(image)
    engine._run_ocr(image)

    assert construction_count["n"] == 1, "the OCR pipeline must be constructed once at warm-up, never per-request"


# --- PDF: additive OCR + native-vs-OCR reconciliation appears in the response -


async def test_pdf_reconciliation_appears_for_low_quality_native_text_page(fake_docling_supervisor, fake_ocr_supervisor):
    """PADDLEOCR_ENABLED opts a PDF into the additive OCR pass; Docling's
    native text_blocks (sparse, from the fake engine) and the OCR
    engine's own text_blocks are cross-referenced into a reconciliation
    decision -- proving the two sources genuinely get compared through
    the real HTTP route, not just in the reconciliation unit tests."""
    object.__setattr__(settings, "paddleocr_enabled", True)
    try:
        docling = fake_docling_supervisor(behavior="instant_success")
        ocr = fake_ocr_supervisor(preprocessor_behavior="instant_success", ocr_behavior="instant_success")
        await docling.start()
        await ocr.start()

        with TestClient(app) as client:
            files = {"file": ("resume.pdf", b"%PDF-1.4\n1 0 obj << /Type /Page >> endobj\n%%EOF", "application/pdf")}
            data = {"correlationId": "corr-reconcile", "mimeType": "application/pdf", "originalFilename": "resume.pdf"}
            response = client.post("/v1/documents/analyse", files=files, data=data)

        assert response.status_code == 200
        body = response.json()
        assert body["selectedRoute"] == "DOCLING_STRUCTURE"  # Docling ran; OCR is additive, not route-selecting, for PDFs
        assert len(body["ocrTextBlocks"]) >= 1
        assert len(body["reconciliation"]) >= 1
        decision = body["reconciliation"][0]
        assert decision["decision"] in ("NATIVE_RETAINED", "OCR_USED", "BOTH_RETAINED_LOW_CONFIDENCE")
        # The fake Docling engine's own text ("fake engine output", 19
        # chars) is sparse -- well under the "substantial" threshold --
        # so this must NOT be a blind NATIVE_RETAINED with no comparison
        # having actually happened.
        assert decision["nativeCharCount"] == len("fake engine output")
    finally:
        object.__setattr__(settings, "paddleocr_enabled", config_module._bool_env("PADDLEOCR_ENABLED", False))
