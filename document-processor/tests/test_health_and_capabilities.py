import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app


@pytest.fixture(scope="module")
def client():
    # Step 4.5: readiness now genuinely depends on the supervisor having
    # been started by the app's lifespan handler (main.py) -- a bare
    # TestClient(app) never runs lifespan startup/shutdown, so it would
    # always see the worker in its default UNAVAILABLE state regardless of
    # DOCLING_ENABLED. The context-manager form does trigger lifespan,
    # which is what actually exercises the Step 4.5 warm-up wiring when
    # this file is run with DOCLING_ENABLED=true (as the CI job does).
    with TestClient(app) as test_client:
        yield test_client


def test_health_live_returns_200_and_status_live(client):
    response = client.get("/health/live")
    assert response.status_code == 200
    assert response.json() == {"status": "live"}


def test_health_ready_reports_engine_availability_and_load(client):
    response = client.get("/health/ready")
    body = response.json()
    # Step 6: docling and ocr each carry BOTH a generic EngineReadiness
    # entry (uniform shape, workerState included) AND their own richer
    # per-pool status object (docling/ocr keys) with queue/active-job
    # detail -- consistent with how /v1/capabilities already reported
    # docling.
    assert "docling" in body["engines"]
    assert "ocr" in body["engines"]
    if settings.docling_enabled:
        # Real lifespan startup ran warm-up for real -- either it
        # succeeded (READY) or the environment genuinely can't run
        # Docling (DEGRADED), but it must not still be UNAVAILABLE (that
        # would mean lifespan never actually started the worker).
        assert response.status_code in (200, 503)
        assert body["docling"]["state"] in ("READY", "BUSY", "DEGRADED")
    else:
        assert response.status_code == 200
        assert body["status"] == "ready"
        assert body["docling"]["state"] == "UNAVAILABLE"
    assert body["docling"]["activeConversions"] == 0
    assert body["docling"]["queuedRequests"] == 0
    # OCR pool defaults off (PADDLEOCR_ENABLED / PREPROCESSING_ENABLED both false).
    if not (settings.preprocessing_enabled or settings.paddleocr_enabled):
        assert body["ocr"]["state"] == "UNAVAILABLE"
        assert body["engines"]["ocr"]["available"] is False
    assert isinstance(body["activeRequests"], int)
    assert isinstance(body["maxConcurrentRequests"], int)


def test_capabilities_reports_schema_version_and_defers_surya_explicitly(client):
    response = client.get("/v1/capabilities")
    assert response.status_code == 200
    body = response.json()
    assert body["schemaVersion"] == "1.0.0"
    assert set(body["supportedMimeTypes"]) == {
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "image/jpeg",
        "image/png",
    }
    assert body["gpuEnabled"] is False
    assert "surya" in body["engines"]
    assert body["engines"]["surya"]["available"] is False
    assert "licens" in body["engines"]["surya"]["reason"].lower()
    assert "maxConcurrentRequests" in body["limits"]
    # Step 4.5: docling's entry now also carries the isolated worker's
    # lifecycle state, not just static availability.
    if settings.docling_enabled:
        assert body["engines"]["docling"]["workerState"] in ("READY", "BUSY", "DEGRADED")
    else:
        assert body["engines"]["docling"]["workerState"] == "UNAVAILABLE"
    assert body["engines"]["surya"]["workerState"] is None
    # Step 6: ocr/preprocessor share the OCR pool's worker lifecycle state.
    assert "preprocessor" in body["engines"]
    assert "ocr" in body["engines"]
    if not (settings.preprocessing_enabled or settings.paddleocr_enabled):
        assert body["engines"]["ocr"]["workerState"] == "UNAVAILABLE"
        assert body["engines"]["preprocessor"]["workerState"] == "UNAVAILABLE"
