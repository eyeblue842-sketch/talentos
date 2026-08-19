"""Worker-facing adapter for the Step 5 image/scanned-document
preprocessing pipeline. Same shape as DoclingEngine (check_availability,
warmup) plus a `preprocess()` method instead of `analyse()` -- kept
separate from ExtractionEngine's abstract interface deliberately (that
interface's `analyse(file_path, mime_type) -> dict` doesn't have room
for the per-job isolated temp directory this engine needs to write its
output images into), not because the two engines are unrelated.

Never claims to have parsed candidate information: this returns cleaned
images and quality metadata only.
"""
from __future__ import annotations

from app.config import settings
from app.engines.base import EngineAvailability
from app.preprocessing import pdf_routing, pipeline
from app.security import ValidationError, validate_image_dimensions, validate_pdf_for_preprocessing


class PreprocessorEngine:
    name = "preprocessor"

    def check_availability(self) -> EngineAvailability:
        if not settings.preprocessing_enabled:
            return EngineAvailability(available=False, reason="PREPROCESSING_ENABLED is false", version=None)
        try:
            from importlib.metadata import version as pkg_version

            import cv2
            import PIL
            import pypdfium2  # noqa: F401 - import-availability check only
        except ImportError as error:
            return EngineAvailability(available=False, reason=f"missing dependency: {error.name}", version=None)
        pypdfium2_version = pkg_version("pypdfium2")
        return EngineAvailability(
            available=True, reason=None,
            version=f"opencv={cv2.__version__},pillow={PIL.__version__},pypdfium2={pypdfium2_version}",
        )

    def warmup(self) -> EngineAvailability:
        """Unlike Docling, there is no large model to load -- OpenCV and
        Pillow have no first-use cost comparable to torch's. This still
        exercises a real, tiny operation (not just an import check) so a
        genuinely broken native install (e.g. a missing OpenCV shared
        library) is caught at warm-up, not on the first real request."""
        availability = self.check_availability()
        if not availability.available:
            return availability
        try:
            import cv2
            import numpy as np

            dummy = np.zeros((16, 16, 3), dtype=np.uint8)
            cv2.cvtColor(dummy, cv2.COLOR_BGR2GRAY)
        except Exception as error:  # noqa: BLE001 - any warm-up failure must report DEGRADED, never crash the worker
            return EngineAvailability(available=False, reason=type(error).__name__, version=availability.version)
        return availability

    def preprocess(self, file_path: str, mime_type: str, job_temp_dir: str) -> list[dict]:
        if mime_type in ("image/jpeg", "image/png"):
            return self._preprocess_image(file_path, job_temp_dir)
        if mime_type == "application/pdf":
            return self._preprocess_pdf(file_path, job_temp_dir)
        raise ValidationError("UNSUPPORTED_MIME_TYPE", f"MIME type '{mime_type}' is not supported for preprocessing.", retryable=False)

    def _preprocess_image(self, file_path: str, job_temp_dir: str) -> list[dict]:
        validate_image_dimensions(file_path)
        image_bgr = pipeline.load_image_file(file_path)
        page = pipeline.preprocess_page(
            image_bgr,
            page_number=1,
            source_type="PHOTOGRAPHED_IMAGE",
            output_dir=job_temp_dir,
            min_resolution_dimension=900,
            apply_geometry_correction=True,
        )
        return [page]

    def _preprocess_pdf(self, file_path: str, job_temp_dir: str) -> list[dict]:
        validate_pdf_for_preprocessing(file_path)
        assessments = pdf_routing.assess_pdf_pages(
            file_path, settings.preprocessing_render_dpi, settings.preprocessing_max_rendered_pixels_per_document,
        )
        pages: list[dict] = []
        for assessment in assessments:
            if not assessment["renderPerformed"]:
                pages.append(
                    {
                        "pageNumber": assessment["pageNumber"],
                        "sourceType": "PDF_NATIVE_TEXT",
                        "textQuality": assessment["textQuality"],
                        "plannedRoute": assessment["plannedRoute"],
                        "rotationDegrees": assessment["rotationDegrees"],
                        "warnings": assessment["warnings"],
                    }
                )
                continue

            image_bgr = pdf_routing.render_pdf_page_to_bgr(file_path, assessment["pageNumber"], settings.preprocessing_render_dpi)
            page_result = pipeline.preprocess_page(
                image_bgr,
                page_number=assessment["pageNumber"],
                source_type="PDF_RENDERED",
                output_dir=job_temp_dir,
                min_resolution_dimension=900,
                apply_geometry_correction=False,
            )
            page_result["textQuality"] = assessment["textQuality"]
            page_result["plannedRoute"] = assessment["plannedRoute"]
            page_result["rotationDegrees"] = assessment["rotationDegrees"]
            page_result["warnings"] = list(dict.fromkeys(page_result["warnings"] + assessment["warnings"]))
            pages.append(page_result)
        return pages
