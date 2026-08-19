import pytest

from app.security import (
    ValidationError,
    sanitize_filename_for_storage,
    sniff_mime_type,
    validate_declared_mime_type,
    validate_file_signature,
    validate_file_size,
)


def test_sniff_mime_type_recognises_known_signatures():
    assert sniff_mime_type(b"%PDF-1.4") == "application/pdf"
    assert sniff_mime_type(b"\xff\xd8\xff\xe0") == "image/jpeg"
    assert sniff_mime_type(b"\x89PNG\r\n\x1a\n") == "image/png"
    assert sniff_mime_type(b"PK\x03\x04...") == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


def test_sniff_mime_type_returns_none_for_unrecognised_content():
    assert sniff_mime_type(b"plain text, not a document at all") is None


def test_validate_declared_mime_type_rejects_unsupported_types():
    with pytest.raises(ValidationError) as excinfo:
        validate_declared_mime_type("application/x-msdownload")
    assert excinfo.value.code == "UNSUPPORTED_MIME_TYPE"
    assert excinfo.value.retryable is False


def test_validate_file_signature_rejects_mismatched_content():
    with pytest.raises(ValidationError) as excinfo:
        validate_file_signature("application/pdf", b"\xff\xd8\xff\xe0")  # a real JPEG signature, declared as PDF
    assert excinfo.value.code == "FILE_SIGNATURE_MISMATCH"


def test_validate_file_signature_rejects_unrecognised_content():
    with pytest.raises(ValidationError) as excinfo:
        validate_file_signature("application/pdf", b"not actually a pdf")
    assert excinfo.value.code == "FILE_SIGNATURE_UNRECOGNISED"


def test_validate_file_signature_accepts_matching_content():
    assert validate_file_signature("application/pdf", b"%PDF-1.4") == "application/pdf"


def test_validate_file_size_rejects_empty_and_oversized_files():
    with pytest.raises(ValidationError) as excinfo:
        validate_file_size(0)
    assert excinfo.value.code == "EMPTY_FILE"

    with pytest.raises(ValidationError) as excinfo:
        validate_file_size(10_000_000_000)
    assert excinfo.value.code == "FILE_TOO_LARGE"


def test_sanitize_filename_for_storage_strips_path_traversal_and_stays_safe():
    result = sanitize_filename_for_storage("../../etc/passwd")
    assert "/" not in result
    assert ".." not in result
    assert result.endswith("passwd")


def test_sanitize_filename_for_storage_handles_unsafe_characters():
    result = sanitize_filename_for_storage("résumé (final) <script>.pdf")
    assert all(char.isalnum() or char in "._-" for char in result)
