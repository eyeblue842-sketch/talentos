"""Common interface every extraction engine adapter implements. Engines are
in-process Python objects (imported libraries), never external processes —
see security.py's module docstring for why that matters.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class EngineAvailability:
    available: bool
    reason: str | None
    version: str | None


class ExtractionEngine(ABC):
    name: str

    @abstractmethod
    def check_availability(self) -> EngineAvailability:
        """Must never raise — a genuinely broken/missing engine reports
        available=False with a reason, so routing can fall back cleanly."""

    @abstractmethod
    def analyse(self, file_path: str, mime_type: str) -> dict:
        """Returns a partial canonical-document fragment (textBlocks,
        tables, images, quality signals) for this engine's contribution.
        Raises EngineNotImplementedError while the real extraction logic
        for this engine hasn't landed yet (Steps 4/6)."""

    def warmup(self) -> EngineAvailability:
        """Called once, inside the isolated worker process, before any
        real request is admitted (Step 4.5). Default implementation is
        just check_availability() -- correct for engines with no real
        model-loading cost (PaddleOCR's scaffold, FakeEngine in tests).
        An engine whose first real use pays a large one-time cost (Docling:
        torch/RapidOCR model loading) must override this to actually pay
        that cost here, not just confirm the package imports -- otherwise
        "warm-up" would complete in milliseconds while doing nothing, and
        the first real user request would still pay the full cold-start
        penalty this step exists to eliminate."""
        return self.check_availability()


class EngineNotImplementedError(Exception):
    def __init__(self, engine_name: str, step_reference: str):
        super().__init__(f"{engine_name} extraction is not implemented yet ({step_reference}).")
        self.engine_name = engine_name
        self.step_reference = step_reference
