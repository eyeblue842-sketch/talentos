"""Step 4 closure: readiness and failure-mode test matrix.

Covers the specific scenarios the closure review asked for, beyond what
test_analyse.py / test_docling_engine.py / test_health_and_capabilities.py
already exercise:

  - Docling disabled (the safe default)
  - Docling enabled and available
  - Docling enabled but unavailable
  - Conversion failure (engine raises mid-conversion)
  - Hard conversion timeout is now enforced (Step 4.5 -- was previously
    a documented gap; the isolated-worker test matrix in
    test_worker_lifecycle.py proves the termination/recovery mechanics,
    this file proves the HTTP-route-level outcome)
  - Password-protected / corrupt document (reclassified below)
  - Page-limit failure
  - Native fallback (the route always returns SCAFFOLD_NOT_IMPLEMENTED
    rather than a 500 when no engine can handle a request)

Since Step 4.5, every real conversion goes through the isolated worker
supervisor (app.worker.instance.supervisor), never a directly-called
engine object -- these tests use the fake_docling_supervisor fixture
(conftest.py) to swap in a fast, deterministic FakeEngine rather than
paying a real ~9s (warm) or ~100s+ (cold, from-scratch worker start-up)
Docling conversion per test. Real-engine correctness (does Docling
actually fail on a password-protected/corrupt file) is proven directly
against DoclingEngine elsewhere (test_docling_engine.py,
test_table_image_fixtures.py) and end-to-end through the full HTTP route
with a real worker in test_worker_lifecycle.py's smoke test. What this
file proves is route-level behaviour: given *some* engine failure
(password-protected, corrupt, or anything else), does the route degrade
safely -- which is identical code regardless of why the engine failed.

"Model warming" and "Node adapter rejecting unavailable/scaffold results"
are not re-tested here: model warming is covered by
test_worker_lifecycle.py's readiness-transition tests, and the
Node-adapter scaffold-rejection tests already live in
backend/src/__tests__/document-processor-client.test.js.
"""

from __future__ import annotations

import asyncio
import os

import pytest
from fastapi.testclient import TestClient

from app import config as config_module
from app.config import settings
from app.main import app

client = TestClient(app)

FIXTURES_DIR = os.path.join(os.path.dirname(__file__), "fixtures")


def _multipart(filename: str, content: bytes, mime_type: str):
    return (
        {"file": (filename, content, mime_type)},
        {"correlationId": "corr-matrix-1", "mimeType": mime_type, "originalFilename": filename},
    )


def _real_pdf_bytes(name: str) -> bytes:
    with open(os.path.join(FIXTURES_DIR, name), "rb") as f:
        return f.read()


_MINIMAL_PDF = b"%PDF-1.4\n1 0 obj << /Type /Page >> endobj\n%%EOF"


# --- Docling disabled / enabled+available / enabled+unavailable -------


def test_docling_disabled_is_the_default_and_routes_to_scaffold():
    if os.environ.get("DOCLING_ENABLED", "").strip().lower() in {"1", "true", "yes", "on"}:
        pytest.skip("DOCLING_ENABLED is set for this run -- this test is specifically about the unset default")
    assert settings.docling_enabled is False, "the safe default must stay disabled unless explicitly configured"
    files, data = _multipart("resume.pdf", _MINIMAL_PDF, "application/pdf")
    response = client.post("/v1/documents/analyse", files=files, data=data)
    assert response.status_code == 200
    assert response.json()["selectedRoute"] == "SCAFFOLD_NOT_IMPLEMENTED"


def test_docling_enabled_and_available_routes_to_real_extraction(fake_docling_supervisor):
    supervisor = fake_docling_supervisor(behavior="instant_success")
    asyncio.run(supervisor.start())
    assert supervisor.engine_version == "fake-1.0.0"

    files, data = _multipart("resume.pdf", _MINIMAL_PDF, "application/pdf")
    response = client.post("/v1/documents/analyse", files=files, data=data)
    assert response.status_code == 200
    body = response.json()
    assert body["selectedRoute"] == "DOCLING_STRUCTURE"
    assert body["textBlocks"][0]["text"] == "fake engine output"
    assert body["engineVersions"]["docling"] == "fake-1.0.0"


def test_docling_enabled_but_unavailable_falls_back_to_scaffold_with_a_reason(fake_docling_supervisor):
    supervisor = fake_docling_supervisor(behavior="unavailable")
    asyncio.run(supervisor.start())
    # Step 6: the Docling pool hosts only the "docling" engine key now
    # (preprocessing/OCR moved to their own pool), so an unavailable
    # docling engine means the whole pool is DEGRADED -- there is no
    # other engine in this pool to keep it READY.
    assert supervisor.is_engine_available("docling") is False

    files, data = _multipart("resume.pdf", _MINIMAL_PDF, "application/pdf")
    response = client.post("/v1/documents/analyse", files=files, data=data)
    assert response.status_code == 200
    body = response.json()
    assert body["selectedRoute"] == "SCAFFOLD_NOT_IMPLEMENTED"
    assert any("docling" in reason for reason in body["fallbackReasons"])


# --- Conversion failure -------------------------------------------------


def test_conversion_failure_degrades_to_scaffold_not_a_500(fake_docling_supervisor):
    supervisor = fake_docling_supervisor(behavior="raise_error")
    asyncio.run(supervisor.start())

    files, data = _multipart("resume.pdf", _MINIMAL_PDF, "application/pdf")
    response = client.post("/v1/documents/analyse", files=files, data=data)
    assert response.status_code == 200, "an engine crash must degrade safely, never 500 the whole request"
    body = response.json()
    assert body["selectedRoute"] == "SCAFFOLD_NOT_IMPLEMENTED"
    assert any("extraction error" in reason for reason in body["fallbackReasons"])
    assert any("failed" in w.lower() for w in body["qualityWarnings"])


# --- Hard timeout is now enforced (Step 4.5) ----------------------------


def test_conversion_exceeding_the_hard_deadline_returns_a_processing_timeout_error(fake_docling_supervisor):
    supervisor = fake_docling_supervisor(behavior="hang_forever", conversion_timeout_seconds=1)
    asyncio.run(supervisor.start())

    files, data = _multipart("resume.pdf", _MINIMAL_PDF, "application/pdf")
    response = client.post("/v1/documents/analyse", files=files, data=data)
    assert response.status_code == 504
    body = response.json()
    assert body["code"] == "PROCESSING_TIMEOUT"
    assert body["retryable"] is True


# --- Password-protected / corrupt document (route-level degrade) -------


def test_password_protected_pdf_is_reported_as_a_quality_warning_not_a_crash(fake_docling_supervisor):
    supervisor = fake_docling_supervisor(behavior="raise_error")
    asyncio.run(supervisor.start())
    content = _real_pdf_bytes("fixture-19-password-protected.pdf")
    files, data = _multipart("resume.pdf", content, "application/pdf")
    response = client.post("/v1/documents/analyse", files=files, data=data)
    assert response.status_code == 200
    body = response.json()
    assert body["selectedRoute"] == "SCAFFOLD_NOT_IMPLEMENTED"
    assert any("docling" in reason for reason in body["fallbackReasons"])


def test_corrupt_document_is_reported_as_a_quality_warning_not_a_crash(fake_docling_supervisor):
    supervisor = fake_docling_supervisor(behavior="raise_error")
    asyncio.run(supervisor.start())
    content = _real_pdf_bytes("fixture-20-corrupt.pdf")
    files, data = _multipart("resume.pdf", content, "application/pdf")
    response = client.post("/v1/documents/analyse", files=files, data=data)
    assert response.status_code == 200
    body = response.json()
    assert body["selectedRoute"] == "SCAFFOLD_NOT_IMPLEMENTED"


# --- Page-limit failure ---------------------------------------------------


def test_page_limit_exceeded_is_rejected_before_extraction():
    object.__setattr__(settings, "max_page_count", 1)
    try:
        # 3 /Type /Page markers -- exceeds the monkeypatched limit of 1.
        content = (
            b"%PDF-1.4\n"
            b"1 0 obj << /Type /Page >> endobj\n"
            b"2 0 obj << /Type /Page >> endobj\n"
            b"3 0 obj << /Type /Page >> endobj\n"
            b"%%EOF"
        )
        files, data = _multipart("resume.pdf", content, "application/pdf")
        response = client.post("/v1/documents/analyse", files=files, data=data)
        assert response.status_code == 422
        assert response.json()["code"] == "PAGE_COUNT_EXCEEDED"
    finally:
        object.__setattr__(settings, "max_page_count", config_module._int_env("MAX_PAGE_COUNT", 50))


# --- Native fallback: an unroutable request never 500s -------------------


def test_unsupported_route_falls_back_to_scaffold_never_500s():
    # Step 6: with neither the OCR pool's "ocr" nor "preprocessor" engine
    # available (bare TestClient, both PADDLEOCR_ENABLED and
    # PREPROCESSING_ENABLED default off / no lifespan startup), an image
    # upload degrades to scaffold with an explicit unavailability warning
    # for each -- never a 500.
    files, data = _multipart("resume.jpg", b"\xff\xd8\xff\xe0" + b"\x00" * 64, "image/jpeg")
    response = client.post("/v1/documents/analyse", files=files, data=data)
    assert response.status_code == 200
    body = response.json()
    assert body["selectedRoute"] == "SCAFFOLD_NOT_IMPLEMENTED"
    assert any("OCR is unavailable" in w for w in body["qualityWarnings"])
    assert any("ocr" in reason for reason in body["fallbackReasons"])
