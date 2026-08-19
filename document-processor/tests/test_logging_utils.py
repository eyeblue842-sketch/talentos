"""Tests for the corrected (Step 4 closure) third-party log redaction in
app/logging_utils.py.

Exercises the redaction filter directly against the real named loggers it
is attached to (docling.document_converter etc.) rather than mocking
logging internals, so a regression in *how* the filter is wired (e.g.
accidentally raising a logger's level, or attaching to the root logger)
would be caught here rather than only being visible by inspection.
"""

from __future__ import annotations

import importlib.util
import logging
import os
import tempfile

import pytest

from app.logging_utils import _RedactTempFilenameFilter, log_event, sanitize_third_party_loggers

_THIRD_PARTY_LOGGER_NAMES = ("docling", "docling.document_converter", "docling_core", "transformers", "PIL", "rapidocr")


def test_docling_document_converter_redacts_only_the_temp_filename(caplog):
    caplog.set_level(logging.WARNING, logger="docling.document_converter")
    logger = logging.getLogger("docling.document_converter")

    sensitive = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4-John_Doe_resume.pdf"
    logger.warning("Input document %s is not valid.", sensitive)

    assert len(caplog.records) == 1
    message = caplog.records[0].getMessage()
    assert sensitive not in message
    assert "John_Doe_resume.pdf" not in message
    # the safe error type/shape survives -- only the filename is gone
    assert "Input document" in message
    assert "is not valid." in message


def test_an_unexpected_engine_warning_remains_observable_in_sanitised_form(caplog):
    caplog.set_level(logging.WARNING, logger="docling.document_converter")
    logger = logging.getLogger("docling.document_converter")

    logger.warning("CUDA is not available, falling back to CPU inference.")

    assert len(caplog.records) == 1
    # no filename-shaped substring is present, so nothing is redacted --
    # this exact diagnostic warning must remain fully visible
    assert caplog.records[0].getMessage() == "CUDA is not available, falling back to CPU inference."


def test_sanitize_third_party_loggers_never_calls_setLevel(monkeypatch):
    # Step 4's first attempt raised these loggers to ERROR, hiding routine
    # WARNING/INFO diagnostics. The corrected behaviour only attaches the
    # redaction filter -- it must never touch a logger's level. Asserting
    # on the *ambient* level of well-known names like "transformers" is
    # unreliable in a full test-suite run: transformers sets its own
    # logger's level internally once it's actually loaded elsewhere in the
    # suite (e.g. by test_docling_engine.py, which runs first
    # alphabetically) -- that's the library managing its own verbosity, not
    # a suppression this service imposes, and it isn't this service's to
    # control. So this spies on setLevel calls made *by
    # sanitize_third_party_loggers itself*, which is the only thing this
    # service actually owns.
    calls = []
    original_set_level = logging.Logger.setLevel

    def _spy(self, level):
        calls.append((self.name, level))
        return original_set_level(self, level)

    monkeypatch.setattr(logging.Logger, "setLevel", _spy)
    sanitize_third_party_loggers()

    touched = [name for name, _level in calls if name in _THIRD_PARTY_LOGGER_NAMES]
    assert touched == [], f"sanitize_third_party_loggers must never call setLevel, but touched: {touched}"


def test_redaction_filter_is_not_attached_to_the_root_logger():
    root = logging.getLogger()
    assert not any(isinstance(f, _RedactTempFilenameFilter) for f in root.filters), (
        "the redaction filter must be scoped to named third-party loggers only, "
        "never attached to the root logger, so it can never touch this service's own logs"
    )


def test_redaction_filter_is_attached_to_each_named_third_party_logger():
    for name in _THIRD_PARTY_LOGGER_NAMES:
        logger = logging.getLogger(name)
        assert any(isinstance(f, _RedactTempFilenameFilter) for f in logger.filters), f"{name} is missing the redaction filter"


def test_an_unrelated_application_logger_with_a_filename_shaped_message_is_never_touched(caplog):
    caplog.set_level(logging.WARNING, logger="some.unrelated.module")
    logger = logging.getLogger("some.unrelated.module")

    sensitive = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4-John_Doe_resume.pdf"
    logger.warning("processing %s", sensitive)

    assert len(caplog.records) == 1
    # this logger is not one of the named third-party loggers the
    # redaction filter is scoped to -- its message must pass through
    # completely unmodified, proving the scoping is real, not just documented
    assert caplog.records[0].getMessage() == f"processing {sensitive}"


def test_log_event_never_logs_resume_content_email_or_phone(caplog):
    caplog.set_level(logging.INFO, logger="document-processor")
    log_event(
        "info",
        "test_event",
        correlationId="corr-1",
        resumeText="Jane Doe, jane@example.com, +1-555-0100, 5 years experience...",
        email="jane@example.com",
        phone="+1-555-0100",
        pageCount=2,
    )
    log_text = "\n".join(record.message for record in caplog.records)
    assert "jane@example.com" not in log_text
    assert "555-0100" not in log_text
    assert "Jane Doe" not in log_text
    assert "experience" not in log_text
    # only allow-listed fields survive
    assert '"pageCount": 2' in log_text
    assert '"correlationId": "corr-1"' in log_text


_docling_importable = importlib.util.find_spec("docling") is not None


@pytest.mark.skipif(not _docling_importable, reason="docling package is not installed")
def test_real_docling_conversion_failure_leaks_no_filename_into_any_captured_log(caplog):
    """End-to-end reproduction of the original leak: a genuinely invalid
    document run through the real DocumentConverter, with logging captured
    at the root (i.e. across every logger, not just this service's own),
    the same way the original leak was actually found. Deliberately does
    not depend on DOCLING_ENABLED -- that flag controls whether this
    service *routes* documents to Docling, not whether the package itself
    is safe to exercise directly in a test.
    """
    from docling.document_converter import DocumentConverter

    caplog.set_level(logging.DEBUG)

    original_filename = "Jane_Doe_Confidential_Resume.pdf"
    temp_name = f"{'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4'}-{original_filename}"
    temp_dir = tempfile.mkdtemp(prefix="careeriz-docproc-test-")
    temp_path = os.path.join(temp_dir, temp_name)
    try:
        with open(temp_path, "wb") as f:
            f.write(b"%PDF-1.4 not actually a valid pdf body")

        try:
            DocumentConverter().convert(temp_path)
        except Exception:
            pass  # the failure itself is expected; only the log output is under test

        log_text = "\n".join(record.getMessage() for record in caplog.records)
        assert original_filename not in log_text
        assert temp_name not in log_text
    finally:
        try:
            os.remove(temp_path)
        except OSError:
            pass
        os.rmdir(temp_dir)
