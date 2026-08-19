"""EXIF orientation correction and metadata stripping. Pillow's own
exif_transpose already implements the EXIF orientation-tag rotation
correctly (all 8 possible tag values) -- reused rather than
hand-rolling the same rotation table again.
"""
from __future__ import annotations

from PIL import Image, ImageOps


def apply_exif_orientation(image: Image.Image) -> tuple[Image.Image, bool]:
    """Returns (possibly-rotated image, whether a rotation was applied).
    A camera photo with EXIF orientation 1 (normal) legitimately needs no
    change -- that is reported as applied=False, not treated as a
    failure."""
    original_size = image.size
    corrected = ImageOps.exif_transpose(image)
    applied = corrected.size != original_size or _pixels_differ(image, corrected)
    return corrected, applied


def _pixels_differ(a: Image.Image, b: Image.Image) -> bool:
    # exif_transpose can also apply a same-size rotation (e.g. a 180
    # degree flip) that a size comparison alone wouldn't catch -- a
    # cheap content check catches that case without a full pixel diff.
    if a.size != b.size:
        return True
    return a.tobytes() != b.tobytes()


def strip_metadata(image: Image.Image) -> Image.Image:
    """Returns a new image with EXIF/ICC/GPS and all other metadata
    chunks removed -- rebuilt from raw pixel data only, the standard
    reliable way to guarantee nothing metadata-shaped survives (safer
    than trying to enumerate and delete every known metadata tag)."""
    data = list(image.getdata())
    clean = Image.new(image.mode, image.size)
    clean.putdata(data)
    return clean
