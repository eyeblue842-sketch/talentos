# Document-processing service (Track B)

Status: **Step 3 scaffold only.** No real extraction engine is wired in yet.
The service validates and echoes back a well-formed, contract-conformant
"not implemented" response for every request. It exists so the HTTP
boundary, security validation, and Node-side adapter (health checks, retry,
circuit breaker, fallback) can be built and tested against something real,
before Docling (Step 4) and PaddleOCR (Step 6) land.

## Why a separate service, not an in-process Python subprocess

Careeriz's backend and worker are Node.js. Docling and PaddleOCR are Python.
This service is a dedicated container (`document-processor/`), matching the
existing `backend`/`worker` container split in `docker-compose.yml`, talking
to the Node worker over HTTP/JSON — not a Python subprocess spawned from
inside the Node worker. See `document-processor/app/security.py`'s module
docstring for why that also means there is no shell-injection surface at all
here: engines are imported Python libraries, never spawned CLI tools.

## Running locally without Docker

Requires Python 3.11-3.12 for a build matching what Steps 4/6 will need
(PaddlePaddle supports 3.8-3.12). This machine's system Python is 3.13/3.14,
so if you don't have 3.11 installed, either install it or accept that local
verification runs on a newer interpreter than production targets — Step 3's
own dependencies (FastAPI/pydantic/uvicorn) have no problem with that; Steps
4/6 will need the real 3.11 target.

```
cd document-processor
python -m venv .venv
.venv/Scripts/activate   # or source .venv/bin/activate on Linux/Mac
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 8081
```

Then, separately:
```
pytest tests/ -v
```

## Running via Docker Compose

```
docker compose up document-processor
```

Exposes `http://localhost:8081`. `DOCUMENT_PROCESSOR_ENABLED` in the
backend/worker containers stays `false` by default — starting this
container alone does not change any resume-import behavior until that flag
is explicitly turned on (and, in a later step, the adapter is actually
called from the import pipeline).

**Not verified in this environment**: no Docker installation was available
during Step 3's implementation, so the container build itself has not been
tested end-to-end here — only the Dockerfile's correctness was reviewed by
hand. Please run `docker compose build document-processor` once Docker is
available and report back if the build fails.

## Enabling the Node adapter (health checks only — nothing calls it yet)

```
DOCUMENT_PROCESSOR_ENABLED=true
DOCUMENT_PROCESSOR_URL=http://127.0.0.1:8081   # or http://document-processor:8081 inside compose
```

`backend/src/services/documentProcessor/documentProcessorClient.js` exports
`checkDocumentProcessorHealth()`, `getDocumentProcessorCapabilities()`, and
`analyseDocumentViaProcessor(...)`. None of these are called from the real
resume-import pipeline yet — `processResumeImportItem` in
`resumeImportService.js` is untouched. Wiring happens once Docling (Step 4)
has something real for the adapter to hand back.

## Contract

`schemaVersion: "1.0.0"`. See `document-processor/app/schemas.py` for the
full `CanonicalDocument` shape. A response with a `schemaVersion` the Node
adapter doesn't recognise is treated as a failure (falls back), never
silently trusted.

## API surface

- `GET /health/live` — process-alive only, no dependencies checked.
- `GET /health/ready` — engine availability + current load.
- `GET /v1/capabilities` — schema/parser versions, supported MIME types,
  engine status (Docling/PaddleOCR both report `available: false` today;
  Surya is listed explicitly as deferred, with the licensing reason, so it's
  never confused with "temporarily down").
- `POST /v1/documents/analyse` — multipart (`file`, `correlationId`,
  `mimeType`, `originalFilename`, `routeHint`). Returns a `CanonicalDocument`
  with `selectedRoute: "SCAFFOLD_NOT_IMPLEMENTED"` today.

## Resource limits

Enforced in both the container (`docker-compose.yml`: `mem_limit: 1g`,
`cpus: 1.5` — a starting point, not measured against a real engine's
footprint yet) and in-process (`MAX_CONCURRENT_REQUESTS`, `MAX_FILE_SIZE_MB`,
`MAX_PAGE_COUNT`, `MAX_PIXEL_DIMENSION`, `MAX_DECOMPRESSED_PIXELS` — see
`document-processor/.env.example`).

## GPU

Not provisioned anywhere today. `GPU_ENABLED` exists in config as a forward
compatibility flag only — it must stay `false` until real GPU infrastructure
exists and is explicitly approved. A GPU build would be a separate Dockerfile
variant (e.g. a CUDA base image + `paddlepaddle-gpu`), never a runtime toggle
on this CPU image.
