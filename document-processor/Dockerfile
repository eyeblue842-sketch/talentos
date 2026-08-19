# Pinned to 3.11 (not the latest available) specifically because PaddleOCR's
# PaddlePaddle dependency (added in Step 6) supports Python 3.8-3.12 —
# verified in the Track B feasibility report. This machine's local Python
# (3.13/3.14) is intentionally NOT what production runs; this image is the
# actual reproducible target.
FROM python:3.11-slim AS base

# CPU-only base image today (see Track B feasibility report: no GPU is
# provisioned anywhere in the current deployment). GPU_ENABLED and any
# CUDA-specific base-image swap are handled by a separate, future Dockerfile
# variant/build-arg — never silently mixed into this one.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# docling's transitive dependency tree pulls in opencv-python (not the
# -headless variant), which dlopen()s libGL.so.1 and libgthread via
# libglib2.0-0 at import time on Debian even though this service never
# opens a window -- python:3.11-slim does not ship either by default, so
# `import cv2` (and therefore `import docling`) fails without them.
# libgomp1 (GNU OpenMP runtime) is needed separately by paddlepaddle's
# compiled libpaddle.so, which dlopen()s it at import time -- confirmed by
# a real ImportError in a clean container during Step 6B CPU-only
# verification (fixed by adding it here, then reproduced working).
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Installs from the hash-locked closure, not the loose requirements.txt --
# every package (including torch/torchvision, pinned to the official
# CPU-only wheels via direct URL+hash in requirements.in) must match a
# recorded SHA-256 or the build fails closed. Verified for real in a clean
# Python 3.11 Linux container during Step 6B (see
# docs/document-processor.md).
COPY requirements-lock.txt ./
RUN pip install --no-cache-dir --require-hashes -r requirements-lock.txt

COPY app ./app

# Non-root: the container never needs root once dependencies are installed.
RUN useradd --create-home --uid 10001 docproc \
    && chown -R docproc:docproc /app
USER docproc

EXPOSE 8081

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=5 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8081/health/live', timeout=3).status == 200 else 1)"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8081", "--workers", "1"]
