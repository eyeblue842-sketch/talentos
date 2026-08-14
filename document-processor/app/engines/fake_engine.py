"""A configurable fake engine, used only by tests to exercise worker
lifecycle behaviour (hangs, crashes, slow warm-up) deterministically —
without waiting on a real ~9s Docling conversion or fabricating a fake
102s cold start every run. Never imported by production code paths.

Configuration is passed as plain, picklable constructor kwargs (a
behaviour string + a numeric parameter) rather than shared memory or
multiprocessing.Event objects: this service spawns worker processes (see
supervisor.py's use of the "spawn" context), so the child shares no
memory with the parent regardless — passing simple values at construction
time, sent across the process boundary as part of the job protocol, is
the only thing that reliably works here.
"""
from __future__ import annotations

import time

from app.engines.base import EngineAvailability, EngineNotImplementedError, ExtractionEngine

HANG_FOREVER = "hang_forever"
SLEEP_THEN_SUCCEED = "sleep_then_succeed"
INSTANT_SUCCESS = "instant_success"
RAISE_ERROR = "raise_error"
UNAVAILABLE = "unavailable"
HANG_DURING_WARMUP = "hang_during_warmup"
SLOW_WARMUP_THEN_SUCCEED = "slow_warmup_then_succeed"


class FakeEngine(ExtractionEngine):
    name = "fake"

    def __init__(self, behavior: str = INSTANT_SUCCESS, sleep_seconds: float = 0.0):
        self.behavior = behavior
        self.sleep_seconds = sleep_seconds

    def check_availability(self) -> EngineAvailability:
        if self.behavior == UNAVAILABLE:
            return EngineAvailability(available=False, reason="simulated unavailable", version=None)
        return EngineAvailability(available=True, reason=None, version="fake-1.0.0")

    def warmup(self) -> EngineAvailability:
        if self.behavior == HANG_DURING_WARMUP:
            while True:
                time.sleep(1)
        if self.behavior == SLOW_WARMUP_THEN_SUCCEED:
            time.sleep(self.sleep_seconds)
        return self.check_availability()

    def analyse(self, file_path: str, mime_type: str) -> dict:
        if self.behavior == HANG_FOREVER:
            # No cooperative cancellation here on purpose: the whole point
            # of this fixture is to prove the supervisor can terminate a
            # worker that will never voluntarily return.
            while True:
                time.sleep(1)
        if self.behavior == SLEEP_THEN_SUCCEED:
            time.sleep(self.sleep_seconds)
        elif self.behavior == RAISE_ERROR:
            raise EngineNotImplementedError("fake", "simulated failure")
        elif self.behavior == UNAVAILABLE:
            raise EngineNotImplementedError("fake", "simulated unavailable")

        return {
            "pages": [{"pageNumber": 1, "widthPx": 100, "heightPx": 100, "nativeTextPresent": True}],
            "textBlocks": [
                {
                    "text": "fake engine output",
                    "page": 1,
                    "readingOrder": 0,
                    "boundingBox": None,
                    "section": None,
                    "engine": "fake",
                    "engineConfidence": None,
                }
            ],
            "tables": [],
            "images": [],
            "readingOrderApplied": True,
            "engineVersion": "fake-1.0.0",
        }

    def preprocess(self, file_path: str, mime_type: str, job_temp_dir: str) -> list[dict]:
        """Same behaviour switch as analyse(), shaped like
        PreprocessorEngine.preprocess() instead -- used when this fake
        stands in for the "preprocessor" engine key rather than "docling"."""
        if self.behavior == HANG_FOREVER:
            while True:
                time.sleep(1)
        if self.behavior == SLEEP_THEN_SUCCEED:
            time.sleep(self.sleep_seconds)
        elif self.behavior == RAISE_ERROR:
            raise EngineNotImplementedError("fake", "simulated failure")
        elif self.behavior == UNAVAILABLE:
            raise EngineNotImplementedError("fake", "simulated unavailable")

        return [
            {
                "pageNumber": 1,
                "sourceType": "PHOTOGRAPHED_IMAGE",
                "originalWidthPx": 100,
                "originalHeightPx": 100,
                "outputWidthPx": 100,
                "outputHeightPx": 100,
                "overallQualityScore": 0.9,
                "transformationsApplied": [],
                "warnings": [],
                "qualityDecision": "ACCEPTABLE",
            }
        ]

    def ocr(self, file_path: str, mime_type: str, job_temp_dir: str, language: str = "en") -> list[dict]:
        """Same behaviour switch as analyse()/preprocess(), shaped like
        PaddleOCREngine.ocr() -- used when this fake stands in for the
        "ocr" engine key rather than "docling"/"preprocessor"."""
        if self.behavior == HANG_FOREVER:
            while True:
                time.sleep(1)
        if self.behavior == SLEEP_THEN_SUCCEED:
            time.sleep(self.sleep_seconds)
        elif self.behavior == RAISE_ERROR:
            raise EngineNotImplementedError("fake", "simulated failure")
        elif self.behavior == UNAVAILABLE:
            raise EngineNotImplementedError("fake", "simulated unavailable")

        return [
            {
                "pageNumber": 1,
                "sourceType": "PHOTOGRAPHED_IMAGE",
                "extractionRoute": "OCR_IMAGE",
                "textBlocks": [
                    {
                        "page": 1,
                        "text": "fake ocr output",
                        "readingOrder": 0,
                        "boundingBox": {"page": 1, "x": 0.0, "y": 0.0, "width": 10.0, "height": 10.0},
                        "confidence": 0.95,
                        "engine": "paddleocr",
                        "engineVersion": "fake-ocr-1.0.0",
                        "extractionRoute": "OCR_IMAGE",
                        "preprocessingApplied": [],
                    }
                ],
                "orientation": {
                    "detectedDegrees": 0,
                    "correctionDegrees": 0,
                    "appliedDegrees": 0,
                    "classifierConfidence": 0.99,
                    "uncertain": False,
                    "correctionSource": "fake",
                    "method": "fake",
                },
                "meanConfidence": 0.95,
                "lowConfidence": False,
                "emptyOutput": False,
                "warnings": [],
                "processingDurationMs": 1,
                "preprocessingResult": {
                    "pageNumber": 1,
                    "sourceType": "PHOTOGRAPHED_IMAGE",
                    "originalWidthPx": 100,
                    "originalHeightPx": 100,
                    "outputWidthPx": 100,
                    "outputHeightPx": 100,
                    "overallQualityScore": 0.9,
                    "transformationsApplied": [],
                    "warnings": [],
                    "qualityDecision": "ACCEPTABLE",
                },
            }
        ]
