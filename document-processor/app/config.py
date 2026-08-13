"""Environment-driven configuration for the document-processing service.

No secret-bearing values are expected here today (the service has no
external API keys of its own yet), but the pattern mirrors the Node backend's
config.js: parse once at import time, fail fast on invalid values, expose a
single immutable `settings` object.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field

# Must be set before torch is ever imported by anything (docling pulls it in
# transitively). torch's JIT compiler (inductor/dynamo) tries to invoke a
# C++ compiler (cl.exe on Windows, gcc/cc on Linux) to build optimised
# kernels; that toolchain is not guaranteed to exist in either this
# environment or the production container (python:3.11-slim has no compiler
# installed). This service's workload (a handful of documents at a time,
# not high-throughput batch inference) does not need JIT-compiled kernels'
# speed badly enough to justify depending on a system compiler being
# present -- eager-mode execution is simpler and more portable. Confirmed
# necessary by direct reproduction: Docling conversion failed with
# `InvalidCxxCompiler: Compiler: cl is not found` without this.
os.environ.setdefault("TORCHDYNAMO_DISABLE", "1")
os.environ.setdefault("TORCH_COMPILE_DISABLE", "1")

# Step 6: PaddleX (PaddleOCR's inference/model-management layer) caches
# downloaded model weights under a home directory it resolves itself,
# and separately decides which of several hosting platforms
# (huggingface/aistudio/bos/modelscope) to try via PADDLE_PDX_MODEL_SOURCE.
# A single Careeriz-owned env var controls it, set before paddlex/paddleocr
# is ever imported, so operators have exactly one knob to bind-mount a
# pre-baked model cache into the container.
#
# The real variable name -- PADDLE_PDX_CACHE_HOME -- was corrected during
# Step 6B's real-container verification (source: paddlex 3.7.2's own
# app/utils/cache.py, `CACHE_DIR = os.environ.get("PADDLE_PDX_CACHE_HOME",
# DEFAULT_CACHE_DIR)`). The originally-assumed PADDLEX_HOME/
# PADDLEX_CACHE_DIR names were verified only against PaddleX's public
# documentation, not a real install (no compatible Python interpreter or
# Docker was available then) -- confirmed wrong by real execution: models
# downloaded to PaddleX's own default `~/.paddlex/official_models` despite
# the env var being set, before this fix.
_paddleocr_model_dir = os.environ.get("PADDLEOCR_MODEL_DIR")
if _paddleocr_model_dir:
    os.environ.setdefault("PADDLE_PDX_CACHE_HOME", _paddleocr_model_dir)


def _bool_env(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _int_env(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    return int(raw)


@dataclass(frozen=True)
class Settings:
    schema_version: str = "1.0.0"
    parser_version: str = "document-processor-0.1.0"

    port: int = field(default_factory=lambda: _int_env("PORT", 8081))

    # Concurrency and resource limits, enforced in-process (a documented,
    # non-authoritative complement to any container-level CPU/memory limits
    # set in docker-compose.yml).
    max_concurrent_requests: int = field(default_factory=lambda: _int_env("MAX_CONCURRENT_REQUESTS", 2))
    max_file_size_mb: int = field(default_factory=lambda: _int_env("MAX_FILE_SIZE_MB", 15))
    max_page_count: int = field(default_factory=lambda: _int_env("MAX_PAGE_COUNT", 50))
    max_pixel_dimension: int = field(default_factory=lambda: _int_env("MAX_PIXEL_DIMENSION", 6000))
    max_decompressed_pixels: int = field(default_factory=lambda: _int_env("MAX_DECOMPRESSED_PIXELS", 40_000_000))

    request_timeout_seconds: int = field(default_factory=lambda: _int_env("REQUEST_TIMEOUT_SECONDS", 60))

    # Engine availability flags. Docling is real as of Step 4, but defaults
    # OFF: a package being installed must never be sufficient for it to run
    # automatically -- enabling real extraction (real CPU/memory cost, real
    # model loads) is an explicit, deliberate opt-in, not an accident of
    # what happens to be in the environment. Set DOCLING_ENABLED=true
    # explicitly (e.g. in a canary/dev docker-compose override) to turn it
    # on. PaddleOCR is real as of Step 6 (real engine code, own isolated
    # worker pool -- see app/worker/instance.py) but stays off by default
    # for the same reason; PADDLEOCR_ENABLED also gates the entire OCR
    # worker pool (see ocr_* settings below), not just the engine's own
    # availability check. Surya is deliberately absent: its model weights
    # carry a revenue/funding-gated commercial license (see the Track B
    # feasibility report) and integrating it was explicitly deferred.
    docling_enabled: bool = field(default_factory=lambda: _bool_env("DOCLING_ENABLED", False))
    paddleocr_enabled: bool = field(default_factory=lambda: _bool_env("PADDLEOCR_ENABLED", False))

    # Step 4.5: isolated worker process lifecycle. Values are chosen from
    # the Step 4 closure's real measurement (cold ~102.5s, warm ~9.3s,
    # peak RSS ~1.52GB), not arbitrary -- see docs/document-processor.md
    # for the worked rationale behind each one.
    # NOTE: despite the name (kept for backwards compatibility with
    # existing DOCLING_* env vars), this is the shared per-job hard
    # deadline the supervisor enforces for ANY job sent to the worker
    # process (Step 5: also image/PDF preprocessing jobs, not just
    # Docling conversions) -- there is one worker, one concurrency slot,
    # one timeout, regardless of which engine a given job targets.
    docling_conversion_timeout_seconds: float = field(
        default_factory=lambda: _int_env("DOCLING_CONVERSION_TIMEOUT_SECONDS", 45)
    )
    docling_queue_capacity: int = field(default_factory=lambda: _int_env("DOCLING_QUEUE_CAPACITY", 1))
    docling_worker_max_documents: int = field(default_factory=lambda: _int_env("DOCLING_WORKER_MAX_DOCUMENTS", 50))
    docling_worker_max_rss_mb: float = field(default_factory=lambda: _int_env("DOCLING_WORKER_MAX_RSS_MB", 2200))
    docling_process_start_timeout_seconds: float = field(
        default_factory=lambda: _int_env("DOCLING_PROCESS_START_TIMEOUT_SECONDS", 30)
    )
    docling_warmup_timeout_seconds: float = field(
        default_factory=lambda: _int_env("DOCLING_WARMUP_TIMEOUT_SECONDS", 150)
    )
    docling_terminate_grace_seconds: float = field(
        default_factory=lambda: _int_env("DOCLING_TERMINATE_GRACE_SECONDS", 3)
    )
    docling_shutdown_grace_seconds: float = field(
        default_factory=lambda: _int_env("DOCLING_SHUTDOWN_GRACE_SECONDS", 10)
    )

    # Step 5: image/scanned-document preprocessing. max_pixel_dimension
    # and max_decompressed_pixels already existed (Step 3 scaffold) but
    # were never enforced anywhere until now.
    preprocessing_enabled: bool = field(default_factory=lambda: _bool_env("PREPROCESSING_ENABLED", False))
    preprocessing_render_dpi: int = field(default_factory=lambda: _int_env("PREPROCESSING_RENDER_DPI", 200))
    preprocessing_max_rendered_pixels_per_document: int = field(
        default_factory=lambda: _int_env("PREPROCESSING_MAX_RENDERED_PIXELS_PER_DOCUMENT", 100_000_000)
    )
    preprocessing_max_temp_disk_mb: int = field(default_factory=lambda: _int_env("PREPROCESSING_MAX_TEMP_DISK_MB", 500))
    # Abandoned per-job temp directories (left behind by a hard kill that
    # bypassed normal cleanup) older than this are swept on startup and
    # periodically.
    preprocessing_abandoned_dir_max_age_minutes: int = field(
        default_factory=lambda: _int_env("PREPROCESSING_ABANDONED_DIR_MAX_AGE_MINUTES", 60)
    )

    # Step 6: OCR worker pool. A SEPARATE process pool from Docling's (see
    # app/worker/instance.py: docling_supervisor vs ocr_supervisor) -- a
    # hung/killed/recycled OCR worker must never affect Docling and vice
    # versa, per the Step 6 architecture requirement. Timeout/RSS defaults
    # below are provisional, not measured: PaddleOCR could not actually be
    # run in this dev sandbox (paddlepaddle publishes wheels for cp39-cp313
    # only; the local interpreter here is 3.14, and no Docker/Linux 3.11
    # environment is available -- see the Step 6 dependency-gate report).
    # They are order-of-magnitude estimates from PaddleOCR's own published
    # CPU-latency claims (PP-OCRv5 mobile: low-second-range per page) with
    # generous headroom, and MUST be re-validated against real measurement
    # in the Python 3.11 Linux container before being treated as final --
    # exactly the same caveat Step 4 originally carried for Docling's own
    # timeout before Step 4 closure's real measurement corrected it.
    ocr_conversion_timeout_seconds: float = field(default_factory=lambda: _int_env("OCR_CONVERSION_TIMEOUT_SECONDS", 60))
    ocr_queue_capacity: int = field(default_factory=lambda: _int_env("OCR_QUEUE_CAPACITY", 1))
    ocr_worker_max_documents: int = field(default_factory=lambda: _int_env("OCR_WORKER_MAX_DOCUMENTS", 50))
    ocr_worker_max_rss_mb: float = field(default_factory=lambda: _int_env("OCR_WORKER_MAX_RSS_MB", 1800))
    ocr_process_start_timeout_seconds: float = field(default_factory=lambda: _int_env("OCR_PROCESS_START_TIMEOUT_SECONDS", 30))
    # Generous: a cold model download (if the image wasn't built with
    # models pre-baked -- see PADDLEOCR_MODEL_DIR above) happens here, at
    # startup, deliberately -- never during a user request. 300s is enough
    # for a few hundred MB over an ordinary connection; slower than that
    # should fail warm-up loudly (DEGRADED) rather than let a request wait
    # on it.
    ocr_warmup_timeout_seconds: float = field(default_factory=lambda: _int_env("OCR_WARMUP_TIMEOUT_SECONDS", 300))
    ocr_terminate_grace_seconds: float = field(default_factory=lambda: _int_env("OCR_TERMINATE_GRACE_SECONDS", 3))
    ocr_shutdown_grace_seconds: float = field(default_factory=lambda: _int_env("OCR_SHUTDOWN_GRACE_SECONDS", 10))

    # OCR behaviour / quality policy (see app/ocr/quality_policy.py and
    # app/ocr/reconciliation.py for where each of these is actually used).
    ocr_language: str = field(default_factory=lambda: os.environ.get("OCR_LANGUAGE", "en"))
    ocr_min_confidence: float = field(default_factory=lambda: float(os.environ.get("OCR_MIN_CONFIDENCE", "0.5")))
    ocr_orientation_confidence_threshold: float = field(
        default_factory=lambda: float(os.environ.get("OCR_ORIENTATION_CONFIDENCE_THRESHOLD", "0.85"))
    )
    ocr_max_pages_per_document: int = field(default_factory=lambda: _int_env("OCR_MAX_PAGES_PER_DOCUMENT", 30))

    # GPU is not provisioned anywhere in the current deployment. This flag
    # exists so engine adapters can branch on it later without a redesign —
    # it must stay False until real GPU infrastructure exists and has been
    # explicitly approved.
    gpu_enabled: bool = field(default_factory=lambda: _bool_env("GPU_ENABLED", False))

    log_level: str = field(default_factory=lambda: os.environ.get("LOG_LEVEL", "INFO"))

    temp_dir_prefix: str = "careeriz-docproc-"


settings = Settings()

SUPPORTED_MIME_TYPES = {
    "application/pdf": ".pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "image/jpeg": ".jpg",
    "image/png": ".png",
}
