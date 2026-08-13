"""Structured JSON logging that never includes resume content, contact
fields, or image bytes — only operational metadata (sizes, timings, route
decisions, error codes). Mirrors the Node backend's existing structured
`console.log(JSON.stringify({...}))` pattern for consistency across services.
"""
from __future__ import annotations

import json
import logging
import re
import sys
import time

from app.config import settings

_ALLOWED_EVENT_KEYS = {
    "event",
    "correlationId",
    "level",
    "mimeType",
    "sniffedMimeType",
    "fileSizeBytes",
    "pageCount",
    "selectedRoute",
    "fallbackReasons",
    "durationMs",
    "code",
    "message",
    "retryable",
    "activeRequests",
    "maxConcurrentRequests",
    "engine",
    "engineAvailable",
    "workerId",
    "statusCode",
}


def _safe_logger() -> logging.Logger:
    logger = logging.getLogger("document-processor")
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(logging.Formatter("%(message)s"))
        logger.addHandler(handler)
        logger.setLevel(settings.log_level)
    return logger


# A temp file's on-disk name embeds the caller-supplied original filename
# (see security.py's sanitize_filename_for_storage: <32-hex-uuid>-<original
# name>). Third-party libraries this service depends on transitively
# (Docling and its own dependency tree) log through their own logger names,
# entirely bypassing log_event()'s explicit allow-list. Confirmed directly:
# Docling's `docling.document_converter` logger emits messages like "Input
# document <name> is not valid." at WARNING level, including that filename,
# when a document fails to parse.
#
# This filter redacts only the matched filename substring, not the whole
# message -- the surrounding text (which library, what kind of failure)
# stays intact and diagnosable. It does not change any logger's level, so
# genuine operational INFO/WARNING output is unaffected. It is attached only
# to the specific third-party logger names below, never to the root logger:
# a substring-redaction filter that never matches is a safe no-op on any
# unrelated log line, but scoping it to named loggers means it is
# impossible for it to ever even see, let alone touch, this service's own
# application logs.
_TEMP_FILENAME_PATTERN = re.compile(r"[0-9a-f]{32}-\S+\.\w+")
_TEMP_FILENAME_REPLACEMENT = "<redacted-filename>"


class _RedactTempFilenameFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        try:
            message = record.getMessage()
        except Exception:  # pragma: no cover - never let logging itself crash the app
            return True
        redacted = _TEMP_FILENAME_PATTERN.sub(_TEMP_FILENAME_REPLACEMENT, message)
        if redacted != message:
            record.msg = redacted
            record.args = ()
        return True


# Named individually and attached individually, not relied on to inherit
# via the logger hierarchy: Python's logging module only runs a logger's
# *own* filters at the point that exact logger is called (e.g. `.warning()`
# on "docling.document_converter"); filters attached to an ancestor logger
# (e.g. "docling") do not run for a call made directly on a more specific
# descendant. Listing both the parent prefix and the one child logger
# confirmed by reproduction to leak covers both call shapes without
# depending on propagation.
_THIRD_PARTY_LOGGER_NAMES = (
    "docling",
    "docling.document_converter",
    "docling_core",
    "transformers",
    "PIL",
    "rapidocr",
)


def sanitize_third_party_loggers() -> None:
    """Redacts sensitive substrings from named third-party loggers without
    suppressing their level or touching the root logger. Deliberately does
    NOT call setLevel: raising these loggers to ERROR would hide genuinely
    useful operational warnings (e.g. an unexpected engine warning that
    isn't filename-shaped), leaving unexpected failures undiagnosable."""
    redact_filter = _RedactTempFilenameFilter()
    for name in _THIRD_PARTY_LOGGER_NAMES:
        logging.getLogger(name).addFilter(redact_filter)


sanitize_third_party_loggers()


def log_event(level: str, event: str, **fields) -> None:
    """`fields` must only ever contain metadata, never document content.
    Any key not in the explicit allow-list above is dropped rather than
    logged, so a future call site accidentally passing raw text/bytes fails
    safe (silently omitted) instead of leaking it."""
    payload = {"level": level, "event": event, "timestamp": time.time()}
    for key, value in fields.items():
        if key in _ALLOWED_EVENT_KEYS:
            payload[key] = value
    logger = _safe_logger()
    line = json.dumps(payload, default=str)
    if level == "error":
        logger.error(line)
    elif level == "warn":
        logger.warning(line)
    else:
        logger.info(line)
