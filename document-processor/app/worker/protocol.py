"""IPC message shapes exchanged between the supervisor (parent, in the
FastAPI process) and the conversion worker (child, a separate OS process).

Every field must be picklable (multiprocessing.Queue pickles messages to
send them across the process boundary) — plain dataclasses of primitives
only, never live objects, file handles, or engine instances.

Engines are referenced by dotted import path + constructor kwargs, not by
passing a live instance: the child is a freshly spawned interpreter (this
service uses the "spawn" start method everywhere, including on Linux, for
cross-platform consistency — see supervisor.py) and shares no memory with
the parent, so an engine instance built in the parent could never be sent
across as-is even if multiprocessing's pickling allowed it in principle.

Step 5: one worker process now hosts more than one engine (docling +
the image-preprocessing pipeline), so jobs/results carry an explicit
`engine` key rather than the worker assuming a single fixed engine.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class WarmupJob:
    """Sent once, right after the worker process starts. Triggers every
    configured engine's warmup() -- each engine pays its own model/init
    cost independently, so a Docling failure doesn't prevent the
    preprocessing pipeline (plain OpenCV/Pillow, nothing to "load") from
    coming up READY, and vice versa."""


@dataclass(frozen=True)
class ConvertJob:
    request_id: str
    file_path: str
    mime_type: str
    engine: str = "docling"


@dataclass(frozen=True)
class PreprocessJob:
    request_id: str
    file_path: str
    mime_type: str
    job_temp_dir: str
    engine: str = "preprocessor"


@dataclass(frozen=True)
class OcrJob:
    """Step 6. Runs inside the OCR worker pool (never the Docling pool --
    see supervisor.py/instance.py). `job_temp_dir` is the same per-request
    isolated temp dir pattern as PreprocessJob: the OCR engine calls the
    preprocessing pipeline's functions directly, in-process, to get the
    cleaned image before feeding it to PaddleOCR -- there is no second
    IPC hop back to the parent between preprocessing and OCR, and no
    artifact is written anywhere the parent process (or an HTTP response)
    can see a filesystem path."""

    request_id: str
    file_path: str
    mime_type: str
    job_temp_dir: str
    language: str = "en"
    engine: str = "ocr"


@dataclass(frozen=True)
class ShutdownJob:
    """Sent to ask the worker to exit its own loop cleanly (used during
    graceful shutdown, before falling back to terminate() if it doesn't
    exit within the grace period)."""


@dataclass(frozen=True)
class EngineWarmupOutcome:
    success: bool
    version: str | None = None
    error_type: str | None = None


@dataclass(frozen=True)
class WarmupResult:
    # Keyed by engine name ("docling", "preprocessor") -- each engine's
    # own outcome, so the supervisor can report per-engine availability
    # rather than a single all-or-nothing worker state.
    engines: dict[str, EngineWarmupOutcome] = field(default_factory=dict)


@dataclass(frozen=True)
class ConvertResult:
    request_id: str
    success: bool
    # `document` is the same dict shape DoclingEngine.analyse() already
    # returns (pages/textBlocks/tables/images/...) — kept as a plain dict
    # here rather than importing the FastAPI/pydantic schema into the
    # child process, which has no need for it.
    document: dict[str, Any] | None = None
    error_type: str | None = None
    error_message: str | None = None


@dataclass(frozen=True)
class PreprocessResult:
    request_id: str
    success: bool
    pages: list[dict[str, Any]] = field(default_factory=list)
    error_type: str | None = None
    error_message: str | None = None


@dataclass(frozen=True)
class OcrResult:
    request_id: str
    success: bool
    # One entry per page actually OCR'd (a single-image upload always
    # produces exactly one). Each page dict carries its own text blocks,
    # orientation assessment, and preprocessing provenance -- see
    # app/engines/paddleocr_engine.py for the exact shape.
    pages: list[dict[str, Any]] = field(default_factory=list)
    error_type: str | None = None
    error_message: str | None = None
