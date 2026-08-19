import io
import logging
import os
import zipfile

from fastapi.testclient import TestClient

from app import security
from app.config import settings
from app.main import app

client = TestClient(app)

MINIMAL_PDF = (
    b"%PDF-1.4\n"
    b"1 0 obj << /Type /Catalog >> endobj\n"
    b"2 0 obj << /Type /Page >> endobj\n"
    b"3 0 obj << /Type /Page >> endobj\n"
    b"%%EOF"
)

MINIMAL_JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 64
MINIMAL_PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64


def _minimal_docx_bytes() -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("[Content_Types].xml", "<Types/>")
        archive.writestr("word/document.xml", "<w:document/>")
    return buffer.getvalue()


def _multipart(filename: str, content: bytes, mime_type: str, correlation_id: str = "corr-test-1"):
    return {
        "file": (filename, content, mime_type),
    }, {
        "correlationId": correlation_id,
        "mimeType": mime_type,
        "originalFilename": filename,
        "routeHint": "auto",
    }


def test_valid_pdf_request_returns_scaffold_canonical_document_with_approximate_page_count():
    files, data = _multipart("resume.pdf", MINIMAL_PDF, "application/pdf")
    response = client.post("/v1/documents/analyse", files=files, data=data)
    assert response.status_code == 200
    body = response.json()
    assert body["schemaVersion"] == "1.0.0"
    assert body["selectedRoute"] == "SCAFFOLD_NOT_IMPLEMENTED"
    assert body["documentMetadata"]["mimeType"] == "application/pdf"
    assert body["documentMetadata"]["sniffedMimeType"] == "application/pdf"
    assert body["documentMetadata"]["pageCount"] == 2
    assert body["correlationId"] == "corr-test-1"
    assert body["textBlocks"] == []
    # docling is always unavailable-by-default here (bare TestClient never
    # triggers lifespan startup) -> exactly one "docling: ..." fallback
    # reason. OCR/preprocessing are only even ATTEMPTED for a PDF when
    # PADDLEOCR_ENABLED or PREPROCESSING_ENABLED is set (Step 5/6's PDF
    # path is opt-in, to avoid an extra worker round-trip for every PDF by
    # default) -- when attempted, they too report unavailable (same
    # reason: no supervisor was ever started), adding exactly one more
    # reason (paddleocr_enabled and preprocessing_enabled both being set
    # still only adds one, since the OCR path takes priority and covers
    # preprocessing too -- see analyse.py's additive PDF block).
    expected_reasons = 2 if (settings.preprocessing_enabled or settings.paddleocr_enabled) else 1
    assert len(body["fallbackReasons"]) == expected_reasons


def test_valid_docx_request_is_accepted_by_signature():
    docx_bytes = _minimal_docx_bytes()
    files, data = _multipart("resume.docx", docx_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    response = client.post("/v1/documents/analyse", files=files, data=data)
    assert response.status_code == 200
    body = response.json()
    assert body["documentMetadata"]["sniffedMimeType"] == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


def test_valid_image_request_is_accepted_and_page_count_is_one():
    files, data = _multipart("resume.jpg", MINIMAL_JPEG, "image/jpeg")
    response = client.post("/v1/documents/analyse", files=files, data=data)
    assert response.status_code == 200
    body = response.json()
    assert body["documentMetadata"]["sniffedMimeType"] == "image/jpeg"
    assert body["documentMetadata"]["pageCount"] == 1

    files, data = _multipart("resume.png", MINIMAL_PNG, "image/png")
    response = client.post("/v1/documents/analyse", files=files, data=data)
    assert response.status_code == 200
    assert response.json()["documentMetadata"]["sniffedMimeType"] == "image/png"


def test_unsupported_mime_type_is_rejected_with_a_safe_structured_error():
    files, data = _multipart("resume.txt", b"plain text content", "text/plain")
    response = client.post("/v1/documents/analyse", files=files, data=data)
    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "UNSUPPORTED_MIME_TYPE"
    assert body["retryable"] is False


def test_file_signature_mismatch_is_rejected():
    # Declares PDF but the bytes are a real, recognised JPEG signature --
    # must be rejected by cross-checking the sniffed type against the
    # declared type, not silently accepted on the declared MIME alone.
    files, data = _multipart("fake.pdf", MINIMAL_JPEG, "application/pdf")
    response = client.post("/v1/documents/analyse", files=files, data=data)
    assert response.status_code == 422
    assert response.json()["code"] == "FILE_SIGNATURE_MISMATCH"


def test_file_signature_unrecognised_content_is_rejected():
    # Declares PDF but the bytes don't match any known signature at all --
    # a distinct failure mode from a mismatch against a *different* known type.
    files, data = _multipart("fake.pdf", b"this is not a pdf at all", "application/pdf")
    response = client.post("/v1/documents/analyse", files=files, data=data)
    assert response.status_code == 422
    assert response.json()["code"] == "FILE_SIGNATURE_UNRECOGNISED"


def test_oversized_file_is_rejected():
    oversized = MINIMAL_PDF + (b"0" * (settings.max_file_size_mb * 1024 * 1024 + 1))
    files, data = _multipart("big.pdf", oversized, "application/pdf")
    response = client.post("/v1/documents/analyse", files=files, data=data)
    assert response.status_code == 422
    assert response.json()["code"] == "FILE_TOO_LARGE"


def test_temp_files_are_cleaned_up_after_a_request(monkeypatch):
    # Spy on the underlying tempfile.mkdtemp call that isolated_temp_dir()
    # uses, so we can inspect the exact directory the request wrote to and
    # confirm it (and everything in it) is gone once the request completes.
    import tempfile as tempfile_module

    captured_dirs = []
    original_mkdtemp = tempfile_module.mkdtemp

    def spying_mkdtemp(*args, **kwargs):
        path = original_mkdtemp(*args, **kwargs)
        captured_dirs.append(path)
        return path

    monkeypatch.setattr(security.tempfile, "mkdtemp", spying_mkdtemp)

    files, data = _multipart("resume.pdf", MINIMAL_PDF, "application/pdf")
    response = client.post("/v1/documents/analyse", files=files, data=data)
    assert response.status_code == 200
    assert len(captured_dirs) == 1
    assert not os.path.exists(captured_dirs[0]), "the per-request temp directory must not survive the request"


def test_no_resume_content_or_filename_appears_in_log_output(caplog):
    caplog.set_level(logging.INFO, logger="document-processor")
    sensitive_filename = "John_Doe_SSN_123-45-6789.pdf"
    files, data = _multipart(sensitive_filename, MINIMAL_PDF, "application/pdf")
    response = client.post("/v1/documents/analyse", files=files, data=data)
    assert response.status_code == 200

    log_text = "\n".join(record.message for record in caplog.records)
    assert sensitive_filename not in log_text
    assert "123-45-6789" not in log_text
    assert MINIMAL_PDF.decode("latin-1") not in log_text
