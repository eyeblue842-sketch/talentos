"""File validation, MIME sniffing, and safe temporary-file handling.

Design note on shell safety: this service never shells out to external CLI
tools. Docling and PaddleOCR are used as in-process Python libraries
(imported and called directly), not spawned as subprocesses. There is
therefore no shell-command construction anywhere in this codebase, and no
filename ever needs to be interpolated into a command string — the class of
vulnerability that guards against is structurally absent here, not merely
escaped. If a future engine genuinely requires shelling out to a CLI binary,
it must use subprocess.run() with an argument list (never shell=True or
string concatenation) and this note should be revisited.
"""
from __future__ import annotations

import os
import re
import shutil
import tempfile
import time
import uuid
from contextlib import contextmanager
from dataclasses import dataclass

from PIL import Image

from app.config import SUPPORTED_MIME_TYPES, settings

# PIL's own decompression-bomb guard (Image.MAX_IMAGE_PIXELS, default
# ~89M) is kept enabled, not disabled -- our own configured limit is
# checked explicitly below (and is normally the tighter of the two), but
# PIL's built-in check stays as defense-in-depth for any code path that
# might decode an image without going through validate_image_dimensions
# first.

# Magic-byte signatures. Deliberately hand-rolled (not python-magic/libmagic)
# to avoid a native-library dependency that complicates Windows dev and
# container builds for a handful of well-known, stable signatures.
_SIGNATURES: dict[str, list[bytes]] = {
    "application/pdf": [b"%PDF-"],
    # DOCX is a ZIP container; a real signature check can only confirm
    # "this is a ZIP" at the byte level — the DOCX-specific internal
    # structure (word/document.xml) is verified separately, in-memory,
    # never via a shell call.
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08"],
    "image/jpeg": [b"\xff\xd8\xff"],
    "image/png": [b"\x89PNG\r\n\x1a\n"],
}


class ValidationError(Exception):
    def __init__(self, code: str, message: str, retryable: bool = False):
        super().__init__(message)
        self.code = code
        self.message = message
        self.retryable = retryable


def sniff_mime_type(head_bytes: bytes) -> str | None:
    for mime_type, signatures in _SIGNATURES.items():
        for signature in signatures:
            if head_bytes.startswith(signature):
                return mime_type
    return None


def validate_declared_mime_type(declared_mime_type: str) -> None:
    if declared_mime_type not in SUPPORTED_MIME_TYPES:
        raise ValidationError(
            "UNSUPPORTED_MIME_TYPE",
            f"MIME type '{declared_mime_type}' is not supported.",
            retryable=False,
        )


def validate_file_signature(declared_mime_type: str, head_bytes: bytes) -> str:
    sniffed = sniff_mime_type(head_bytes)
    if sniffed is None:
        raise ValidationError(
            "FILE_SIGNATURE_UNRECOGNISED",
            "File contents do not match any supported document signature.",
            retryable=False,
        )
    # DOCX and plain ZIP share the same magic bytes at this layer; the
    # declared MIME type is trusted for the DOCX/ZIP ambiguity specifically,
    # matching the same tolerance already used in the existing Node
    # extraction pipeline (resumeImportUtils.js's validateUploadedResumeFile).
    docx_mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    if sniffed == docx_mime and declared_mime_type == docx_mime:
        return sniffed
    if sniffed != declared_mime_type:
        raise ValidationError(
            "FILE_SIGNATURE_MISMATCH",
            "File contents do not match the declared MIME type.",
            retryable=False,
        )
    return sniffed


def validate_file_size(size_bytes: int) -> None:
    max_bytes = settings.max_file_size_mb * 1024 * 1024
    if size_bytes <= 0:
        raise ValidationError("EMPTY_FILE", "Uploaded file is empty.", retryable=False)
    if size_bytes > max_bytes:
        raise ValidationError(
            "FILE_TOO_LARGE",
            f"File exceeds the {settings.max_file_size_mb}MB limit.",
            retryable=False,
        )


_SAFE_FILENAME_PATTERN = re.compile(r"[^A-Za-z0-9._-]+")


def sanitize_filename_for_storage(original_filename: str) -> str:
    """Never used to build a shell command (see module docstring) — this
    exists purely so a stored temp-file name can't escape its directory
    (path traversal) or collide with another concurrent request."""
    base = os.path.basename(original_filename)
    safe = _SAFE_FILENAME_PATTERN.sub("_", base).strip("._") or "upload"
    return f"{uuid.uuid4().hex}-{safe[:120]}"


@dataclass
class IsolatedTempDir:
    path: str


@contextmanager
def isolated_temp_dir():
    """A per-request temp directory, always removed on exit (success or
    error) — nothing from one request's processing can leak into another's,
    and nothing survives a crash mid-request beyond normal OS temp cleanup."""
    directory = tempfile.mkdtemp(prefix=settings.temp_dir_prefix)
    try:
        yield IsolatedTempDir(path=directory)
    finally:
        shutil.rmtree(directory, ignore_errors=True)


def write_temp_file(temp_dir: IsolatedTempDir, original_filename: str, content: bytes) -> str:
    safe_name = sanitize_filename_for_storage(original_filename)
    full_path = os.path.join(temp_dir.path, safe_name)
    # os.path.join with a sanitized, basename-only, traversal-free filename
    # guarantees full_path stays inside temp_dir.path.
    with open(full_path, "wb") as handle:
        handle.write(content)
    return full_path


def validate_image_dimensions(file_path: str) -> tuple[int, int]:
    """Step 5: opens the file with Image.open() (which only reads the
    header -- it does NOT decode pixel data until .load()/.getdata() is
    called) and checks width/height/total-pixel limits BEFORE any
    expensive decode. This is what actually stops a decompression-bomb
    style image (a tiny file that declares an enormous pixel grid) from
    ever being decoded in the first place, rather than decoding first and
    discovering the problem after paying the memory cost.

    Also rejects animated/multi-frame images (n_frames > 1) unless a
    future step deliberately adds support -- a resume upload has no
    legitimate use for an animated GIF/WEBP, and multi-frame handling
    is a distinct feature this step does not implement.
    """
    try:
        with Image.open(file_path) as image:
            width, height = image.size
            total_pixels = width * height

            if width > settings.max_pixel_dimension or height > settings.max_pixel_dimension:
                raise ValidationError(
                    "IMAGE_DIMENSION_TOO_LARGE",
                    f"Image dimensions exceed the {settings.max_pixel_dimension}px limit.",
                    retryable=False,
                )
            if total_pixels > settings.max_decompressed_pixels:
                raise ValidationError(
                    "IMAGE_PIXEL_COUNT_TOO_LARGE",
                    f"Image exceeds the {settings.max_decompressed_pixels}-pixel limit.",
                    retryable=False,
                )
            if width <= 0 or height <= 0:
                raise ValidationError("IMAGE_INVALID_DIMENSIONS", "Image reports zero or negative dimensions.", retryable=False)

            try:
                is_animated = getattr(image, "n_frames", 1) > 1
            except Exception:  # pragma: no cover - some formats raise probing n_frames
                is_animated = False
            if is_animated:
                raise ValidationError("IMAGE_ANIMATED_NOT_SUPPORTED", "Animated/multi-frame images are not supported.", retryable=False)

            return width, height
    except ValidationError:
        raise
    except Image.DecompressionBombError as error:
        raise ValidationError("IMAGE_DECOMPRESSION_BOMB", "Image rejected by decompression-bomb protection.", retryable=False) from error
    except Exception as error:
        raise ValidationError("IMAGE_CORRUPT_OR_UNREADABLE", "Image could not be read.", retryable=False) from error


def validate_pdf_for_preprocessing(file_path: str) -> None:
    """A lighter-weight, preprocessing-specific PDF sanity check,
    independent of Docling's own parsing -- catches password-protection
    and structural corruption before any page is rendered. Page count
    against settings.max_page_count is already enforced by the existing
    analyse.py route-level check; not duplicated here."""
    import pypdfium2 as pdfium

    try:
        pdf = pdfium.PdfDocument(file_path)
    except pdfium.PdfiumError as error:
        message = str(error).lower()
        if "password" in message:
            raise ValidationError("PDF_PASSWORD_PROTECTED", "PDF is password-protected.", retryable=False) from error
        raise ValidationError("PDF_CORRUPT_OR_UNREADABLE", "PDF could not be opened.", retryable=False) from error
    else:
        pdf.close()


def sweep_abandoned_temp_dirs(max_age_minutes: int) -> int:
    """Removes directories under the OS temp root matching this
    service's temp_dir_prefix that are older than max_age_minutes.

    Every NORMAL request's temp directory is already guaranteed cleaned
    up by isolated_temp_dir()'s own finally clause, regardless of
    success/failure/timeout -- that guarantee does not depend on this
    function at all. This exists only for the one scenario that
    guarantee can't cover: the PARENT process itself being killed (not
    just the worker) mid-request, bypassing even the finally clause.
    Called at startup and periodically (see main.py).

    Path validation, not just prefix matching: only ever deletes an
    entry that is (a) a direct child of the real system temp root, (b)
    a directory, not a symlink, and (c) name-prefixed with this
    service's own temp_dir_prefix -- never recurses into or deletes
    anything else, and never follows a symlink that could redirect the
    delete outside the temp root.
    """
    removed = 0
    temp_root = os.path.abspath(tempfile.gettempdir())
    now = time.time()
    threshold_seconds = max_age_minutes * 60

    try:
        entries = os.listdir(temp_root)
    except OSError:
        return 0

    for name in entries:
        if not name.startswith(settings.temp_dir_prefix):
            continue
        full_path = os.path.join(temp_root, name)
        if os.path.islink(full_path):
            continue
        if os.path.dirname(os.path.abspath(full_path)) != temp_root:
            continue  # pragma: no cover - os.path.join under a listdir result cannot escape, defensive only
        if not os.path.isdir(full_path):
            continue
        try:
            age_seconds = now - os.path.getmtime(full_path)
        except OSError:
            continue
        if age_seconds >= threshold_seconds:
            shutil.rmtree(full_path, ignore_errors=True)
            removed += 1

    return removed
