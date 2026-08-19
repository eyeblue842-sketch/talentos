# document-processor: dependencies, licensing and resource footprint

Step 4 closure reference doc. Covers the questions the Step 4 closure
review asked to have answered with real data rather than left implicit:
what's in the dependency tree, what it costs to install and run, and
what's licensed how.

## Dependency lock

`requirements.txt` stays the readable, top-level source of truth (5
direct pins). `requirements-lock.txt` is the full transitive closure --
105 packages, hash-pinned, `pip install --require-hashes` compatible.
See the header comment in that file for provenance and the two packages
(numpy, scipy) whose locked version had to be pinned down from what this
dev machine resolved (Python 3.14) to the newest version that still
publishes a Python 3.11 wheel.

**Not yet verified end-to-end on real Python 3.11 / Linux.** Local
verification was blocked by two real constraints, not skipped for
convenience:
- No Docker available in this environment.
- pip's cross-platform resolution (`--python-version 3.11 --platform
  manylinux_2_28_x86_64`) evaluates `sys_platform`/`platform_system`
  environment markers using the *host* OS, not the `--platform`
  override -- confirmed by reproduction: a resolve targeting Linux still
  pulled in `pywin32` (a Windows-only dependency of one transitive
  package) and failed, because the marker `sys_platform == "win32"`
  evaluated true on this Windows host regardless of the target platform
  requested.

The `document-processor` job in `.github/workflows/ci-cd.yml` (added
this closure) is the authoritative verification: it runs on a real
`ubuntu-latest` runner with actual Python 3.11, installs
`requirements-dev.txt`, lints, and runs the full test suite twice (once
with Docling disabled -- the default -- and once with it explicitly
enabled). As of this writing that job has not yet had a real CI run;
treat every claim in this document tagged "pending CI" as
verified-by-metadata-and-local-testing only, not fully confirmed.

## License audit

Direct dependencies (from `requirements.txt`):

| Package | Version | License |
|---|---|---|
| fastapi | 0.141.1 | MIT |
| uvicorn | 0.52.1 | BSD-3-Clause |
| pydantic | 2.13.4 | MIT |
| python-multipart | 0.0.32 | Apache-2.0 |
| docling | 2.119.0 | MIT |

Full transitive tree (105 packages, matching `requirements-lock.txt`):
checked automatically against PyPI's `license_expression` / `license` /
license classifiers. **104 of 105 are unambiguously permissive** (MIT,
BSD, Apache-2.0, PSF, HPND or similar) -- no copyleft (GPL/LGPL/AGPL)
found anywhere in the tree. The one exception is `fsspec` (2026.7.0),
which does not publish structured license metadata on PyPI at all
(neither the classic `license` field nor the newer SPDX
`license_expression`); it's widely known and documented in its own
GitHub repository as BSD-3-Clause, but that is not independently
confirmable from PyPI metadata alone -- flagged here rather than
asserted with the same confidence as the SPDX-declared entries.

Notable dependencies by license, for visibility (all permissive):
torch (BSD-3-Clause + Apache-2.0 + BSL-1.0 + MIT, a composite -- no
single restrictive term), transformers (Apache-2.0), opencv-python
(Apache-2.0), pandas/numpy/scipy (BSD-3-Clause), Pillow (MIT-derived
"Pillow license" a.k.a. HPND-style), rapidocr (Apache-2.0).

## Resource footprint (measured, not estimated)

One controlled real conversion, `DoclingEngine.analyse()` against a real
2-page synthetic PDF fixture, measured directly (`psutil`, RSS, wall
clock) rather than assumed:

| Metric | Value |
|---|---|
| Process RSS before any docling import | 18.3 MB |
| Process RSS after module import | 20.5 MB |
| **Cold** conversion duration (first call -- model weights load from disk) | **102.5 s** |
| Peak RSS during cold conversion | 1090.1 MB |
| **Warm** conversion duration (second call, models already resident) | **9.3 s** |
| Peak RSS during warm conversion | 1517.9 MB |
| **Peak RSS overall** | **1517.9 MB (~1.5 GB)** |
| Output payload size (this fixture) | 1970 bytes |
| New top-level temp files created | 1 file, 0 bytes |
| Installed dependency size (`site-packages`) | **1.5 GB** |
| Total download size (105 locked wheels, summed from PyPI metadata) | **~736 MB** |

**Container memory limit corrected**: `docker-compose.yml`'s
`document-processor` service was `mem_limit: 1g` -- already below the
measured 1.52 GB peak for a single conversion of a *tiny* fixture, which
would very likely OOM-kill on any real-world resume. Changed to `3g`
(headroom above the measured peak for `MAX_CONCURRENT_REQUESTS=2` and
larger real documents than the fixture this was measured against).
`cpus` raised from 1.5 to 2 to match. **Re-measure against
production-scale documents (larger PDFs, embedded images, multi-column
layouts) before treating 3g as final** -- this was measured against one
small synthetic fixture, not a representative corpus.

### Critical finding from Step 4 closure (now fixed in Step 4.5)

The measured 102.5s cold-start duration exceeded both
`REQUEST_TIMEOUT_SECONDS` (Python, was unenforced) and
`DOCUMENT_PROCESSOR_RESPONSE_TIMEOUT_MS` (Node, was 30s), and
`docling.analyse()` was a synchronous call directly inside an `async def`
route handler, blocking the entire event loop -- including
`/health/live` -- for the full duration of every conversion. See "Step
4.5: runtime isolation, warm-up and enforceable timeout" below for the
fix and the real measurements proving it works.

## Step 4.5: runtime isolation, warm-up and enforceable timeout

### Architecture

Docling conversion now runs in a dedicated, persistent child process
(`multiprocessing`, "spawn" context everywhere for cross-platform
consistency), supervised by `app/worker/supervisor.py`. The FastAPI
process never imports `docling`/`torch` itself and never calls
`DocumentConverter.convert()` directly -- it sends a job over a
`multiprocessing.Queue`, waits for the result via a bounded
`Queue.get(timeout=...)` offloaded through `asyncio.to_thread` (so the
event loop is never blocked, and the wait is genuinely time-bounded, not
just cancelled-on-the-asyncio-side while a thread leaks in the
background), and terminates the process (SIGTERM, escalating to SIGKILL)
if that timeout is exceeded.

A thread executor was considered and rejected as the final timeout
boundary per the review's explicit instruction: Python cannot reliably
terminate a stuck native/ML thread (no safe cross-platform
`thread.kill()`), so only process-level isolation gives a real, provable
hard boundary. Threads are still used, but only to make an
*already-bounded* blocking call (`Queue.get(timeout=X)`) not block the
event loop -- the timeout enforcement itself is process-level.

### Startup / warm-up flow

1. `main.py`'s lifespan spawns the worker process (only if
   `DOCLING_ENABLED=true` -- stays `UNAVAILABLE`, no process at all,
   otherwise).
2. The worker signals liveness via a `multiprocessing.Event` the moment
   its own loop starts polling for jobs (`STARTING` -> event set).
3. The supervisor sends a `WarmupJob`. The engine's `warmup()` method
   runs -- for `DoclingEngine` this is a **real conversion** against a
   bundled fixture (`app/assets/warmup.pdf`), not just an import check.
   This was a real bug caught during implementation: the first version
   of `warmup()` only called `check_availability()` (`import docling`
   succeeding), which completed in ~0.3s and loaded no ML models at all
   -- confirmed by comparing warm-up duration before/after the fix (0.3s
   -> ~30-40s once it was actually forcing a real conversion).
4. `WARMING` until that resolves; `READY` on success, `DEGRADED` (with a
   reason) on failure or warm-up timeout.

### Health-state semantics

- `/health/live`: process-alive only, unchanged, and **proven to stay
  responsive during a conversion** (`test_health_live_responds_while_a_conversion_is_hanging`,
  a real concurrent-request test using `httpx.AsyncClient` +
  `ASGITransport`, not a hypothetical claim).
- `/health/ready`: a new `docling` object reports the worker's actual
  lifecycle state (`STARTING`/`WARMING`/`READY`/`BUSY`/`DEGRADED`/
  `RESTARTING`/`SHUTTING_DOWN`/`STOPPED`). Overall `status` stays `ready`
  (200) in scaffold-only mode (`DOCLING_ENABLED=false`, the default,
  unchanged from Step 3/4 -- not an outage). When Docling *is* enabled,
  the HTTP status drops to 503 while not in `READY`/`BUSY`.
- `/v1/capabilities`: `engines.docling.workerState` carries the same
  state, no host-sensitive detail (no PIDs, paths, or hostnames).

### Hard timeout, queue and backpressure

- `DOCLING_CONVERSION_TIMEOUT_SECONDS` (default **45s**): ~5x the
  measured warm baseline (9.3s), comfortably under the measured cold
  baseline (102.5s, which warm-up now avoids paying at request time).
- `DOCLING_QUEUE_CAPACITY` (default **1**): concurrency is exactly 1 (the
  ~1.5GB-per-conversion memory footprint doesn't fit two at once); one
  additional request may wait its turn. Anything beyond that (2 total in
  flight) is rejected immediately with 503 `SERVICE_BUSY` -- proven by a
  real timing assertion (`test_queue_overflow_is_rejected_immediately_not_queued`)
  that the rejection takes <200ms, not "wait then time out".
- On timeout: the worker process is SIGTERM'd (3s grace,
  `DOCLING_TERMINATE_GRACE_SECONDS`), then SIGKILL'd if still alive, then
  a fresh worker is spawned and re-warmed. `submit()` does not return
  until the terminate call itself completes, so a caller never observes
  "timed out" while the old process might still be consuming CPU/memory
  in the background -- proven directly
  (`test_timed_out_work_does_not_continue_after_the_call_returns` asserts
  `not old_process.is_alive()` immediately after `submit()` raises).
- The request-scoped temp directory (`isolated_temp_dir()`) is
  parent-owned and always cleaned up in the route's `finally` clause
  regardless of success/failure/timeout -- proven across all three
  outcomes in `test_request_temp_dir_is_removed_after_success_failure_and_timeout`.
  Caveat: Docling/torch's own internal OS-temp-dir usage (not something
  this service controls) is not independently redirected per-request, so
  a hard-killed conversion could in principle leave a transient artifact
  there; this is a known, accepted limitation, not verified clean.

### Node/Python deadline alignment

- Python's hard per-conversion deadline: 45s.
- Node's `DOCUMENT_PROCESSOR_RESPONSE_TIMEOUT_MS`: raised from 30000ms to
  **60000ms** = 45s (Python's hard deadline) + 15s transport/queue
  margin. Not an arbitrary increase -- if `DOCLING_CONVERSION_TIMEOUT_SECONDS`
  or `DOCLING_QUEUE_CAPACITY` change, this must be revisited (worst-case
  wait for an admitted-but-queued request is bounded by roughly
  `queue_capacity x conversion_timeout`, i.e. ~45s more per queued slot
  in the pathological case).
- Node now calls `GET /health/ready` (`checkDoclingEngineReadiness()`)
  *before* uploading, and does not send work while the state is
  `STARTING`/`WARMING`/`RESTARTING` (transient, retryable, does not trip
  the circuit breaker) vs `DEGRADED`/`UNAVAILABLE` (real problem,
  retryable only if `DEGRADED`, does trip the circuit breaker). See
  `backend/src/services/documentProcessor/documentProcessorClient.js`'s
  `checkDoclingEngineReadiness` and the 23 tests in
  `document-processor-client.test.js`.

### Real measurement: process isolation and memory (Step 4.5)

One controlled real run: real `DoclingEngine`, real warm-up, 5 sequential
real conversions, real termination + recreation, real shutdown --
`psutil`-measured, not estimated.

| Metric | Value |
|---|---|
| Parent (FastAPI) RSS before worker start | 28.0 MB |
| Parent RSS after warm-up | 28.9 MB |
| Parent RSS after worker termination + recreation | 29.0 MB |
| Parent RSS after shutdown | 29.0 MB |
| Worker RSS immediately after warm-up | 1045.7 MB |
| Warm-up duration (real conversion, not just import check) | ~42s (varies 30-40s run to run) |
| 5 sequential conversion durations | 9.81s, 9.78s, 9.3s, 8.77s, 8.64s |
| Worker RSS after each of the 5 conversions | 1199.5, 1223.6, 1237.7, 1250.4, 1265.0 MB |
| Peak worker RSS observed during the 5 conversions | 1574.5 MB |
| Worker PID after `_terminate_and_recreate()` | different PID; old PID confirmed **not running** |
| Worker RSS after recreation + re-warm | 1049.5 MB (matches the *first* worker's baseline) |
| Worker PID after `shutdown()` | confirmed **not running** (no orphan) |

**What this proves:**
- **Isolation is real**: the parent process stays flat at ~28-29MB through the entire lifecycle regardless of what the worker does -- a stuck/crashed/memory-heavy worker cannot touch the HTTP process's own footprint.
- **The model loads once, not per request**: all 5 conversion durations stay in the 8.6-9.8s warm-band: none pay anything close to the 102.5s cold cost, confirming warm-up genuinely persists across requests within one worker's lifetime.
- **Memory genuinely grows across repeated conversions**: +15-19MB per conversion in this run (1199.5 -> 1265.0MB over 4 conversions). This is exactly why `DOCLING_WORKER_MAX_DOCUMENTS` (default 50) and `DOCLING_WORKER_MAX_RSS_MB` (default 2200) recycling exists -- at this growth rate, an unrecycled worker would cross 2200MB in roughly (2200-1046)/17 ≈ 68 documents. 50 is a conservative document-count cap that fires before the RSS cap in the typical case.
- **Termination and recreation genuinely reset memory**, they don't just change the PID while leaking: the recreated worker's post-warm-up RSS (1049.5MB) matches the original worker's (1045.7MB) almost exactly.
- **No orphans**: both the killed-on-timeout worker and the worker present at `shutdown()` are confirmed gone (`psutil.pid_exists() == False`) by the time the supervisor call returns.

**Container memory limit, revised again with this data**: worker peak
observed 1.57GB; the conversion that trips the 2200MB recycle threshold
could itself peak several hundred MB above that before the check runs,
estimated worst-case ~2.6-2.7GB for the worker alone. `docker-compose.yml`
raised from `3g` to **`4g`** to keep real headroom above that plus the
~30MB parent and container/OS overhead. Concurrency is 1 by default, so
this is not multiplied by concurrent conversions. Still only measured
against small synthetic fixtures -- re-measure against production-scale
documents before finalizing.

## Known limitations carried forward

- `ruff format --check` finds pre-existing style drift (mainly: no blank
  line after module docstrings) across ~13 files predating this closure.
  Not fixed here (would be a large, unrelated-content diff); `ruff
  check` (lint, not format) is clean. Recommended as a separate,
  low-risk follow-up.
- The backend's default `npm test` script correctly returns a non-zero
  exit code when tests genuinely fail (verified directly, non-chained,
  this closure) -- the earlier concern was a shell-chaining artifact in
  how a command was run, not a real CI gap.

## Step 5: image/scanned-document preprocessing

### Architecture

Reuses the Step 4.5 worker process unchanged -- the supervisor now hosts
two engines (`docling`, `preprocessor`) in one persistent child process,
each warmed and reported independently
(`app/worker/protocol.py`'s `EngineWarmupOutcome`, keyed by engine
name). One engine failing warm-up does not degrade the other: proven by
`test_one_engine_failing_does_not_degrade_the_whole_worker`. A request
only ever invokes the engine its job names -- routing an image to the
preprocessor never touches torch; routing a digital PDF to Docling never
touches OpenCV. Concurrency, the bounded queue, the hard per-job timeout,
and worker recycling are all the same shared mechanism as Step 4.5,
unchanged, now covering both engines' jobs through one admission gate.

### Dependencies and licences

No new dependencies. `opencv-python==5.0.0.93` (Apache-2.0),
`pillow==12.3.0` (MIT-CMU), `pypdfium2==5.12.1` (BSD-3-Clause/Apache-2.0)
were already transitive dependencies of docling at these exact versions
(verified via `pip show`), already hash-pinned in `requirements-lock.txt`
with confirmed cp311/manylinux wheels from the Step 4 closure audit --
pinned explicitly in `requirements.txt` now that `app/preprocessing/`
code imports them directly, so a future docling dependency change can't
silently remove them. Zero installed-size delta (nothing new installed).
No PaddleOCR, no Surya, no cloud image-processing provider added.

### Security limits (enforced for the first time this step)

`MAX_PIXEL_DIMENSION` (6000px) and `MAX_DECOMPRESSED_PIXELS` (40M) were
declared in Step 3's config scaffold but never actually enforced
anywhere until now (`validate_image_dimensions` in `app/security.py`,
checked via `Image.open()`'s lazy header read -- before any pixel
decode). Also new: animated/multi-frame image rejection, PDF
password-protection/corruption detection independent of Docling
(`validate_pdf_for_preprocessing`), and a real decompression-bomb
fixture (a 7500x7500 solid-colour PNG, 178KB on disk, 56.25M pixels
decoded) proven rejected before decode.

### Transformation pipeline (real, OpenCV/Pillow, measured not assumed)

Implemented and tested: EXIF orientation correction + full metadata/GPS
strip (Pillow), page-boundary detection + perspective correction (Canny
edges + contour approximation + 4-point warp), deskew (Otsu threshold +
minAreaRect angle, small-angle correction only), blur/contrast/
illumination/glare/resolution scoring (Laplacian variance, RMS contrast,
block-brightness evenness, connected-component highlight fraction,
pixel-dimension proxy), conservative CLAHE contrast enhancement with a
real measured before/after rollback (proven by
`test_enhancement_is_rolled_back_when_it_would_worsen_quality`, which
forces a worse post-enhancement score and asserts the original is kept).

**Not implemented**: gross 90/180/270-degree orientation detection for
an image with no EXIF tag (a photographed page rotated a quarter-turn
with no camera-supplied orientation hint). The deskew stage only
corrects small-angle tilt (±45°) by design -- confirmed by
`03-rotated-90.jpg` in the benchmark, which reports `skewAngleDegrees:
0.0` despite being genuinely rotated 90°. Real content-orientation
detection (e.g. text-line direction analysis) is a materially different,
larger problem than deskew and was not built this step.

**Real bug found and fixed during this step's own benchmarking**: the
first glare-scoring implementation ("fraction of near-white pixels")
flagged nearly every clean white-background document page as glare,
since a normal document page is legitimately near-white across most of
its area. Fixed by excluding the largest connected bright region when it
covers most of the frame (treated as page background, not glare) --
`measure_glare` in `app/preprocessing/quality.py`. A second, less
significant limitation surfaced by the fix: the synthetic glare fixture
built for this benchmark places its highlight directly over the (already
pure-white) synthetic page background, so it merges into that same
excluded "background" blob and the algorithm under-reports glare
specifically for that fixture -- a fixture-design artifact of using an
unrealistically flat synthetic background, not necessarily evidence
against the algorithm on a real photograph (where a page background is
rarely pixel-perfect uniform white).

**Contrast metric calibration**: the RMS-contrast score used here reads
low (~0.15-0.24) even for clean, genuinely readable synthetic document
pages, because a normal document page is mostly flat background with
sparse text -- inherently low pixel-value variance regardless of actual
readability. The quality thresholds in `quality_policy.py` are
explicitly NOT claimed as final for this reason; real benchmarking
against a representative document corpus (not just this step's synthetic
fixtures) is needed before treating them as production-calibrated,
exactly as the review instructed.

### Page-level PDF routing

`app/preprocessing/pdf_routing.py` assesses every page via pypdfium2
independently of Docling (own text-extraction check, not reused from
Docling's output): pages with >=200 extracted characters are
`GOOD_DIGITAL_TEXT` -> `NATIVE_DOCLING` (never rendered to an image --
proven by `test_good_digital_pdf_is_never_rendered_to_an_image`, which
asserts no `blurScore` key exists for such a page); pages with <40 are
`IMAGE_ONLY` -> `RENDER_FOR_OCR` (rendered via pypdfium2 and run through
the same pipeline as a direct image upload); the range between is
`LOW_QUALITY_NATIVE_TEXT` -> `NATIVE_WITH_OCR_BACKUP`. Rendering is
bounded by `PREPROCESSING_MAX_RENDERED_PIXELS_PER_DOCUMENT` (default
100M) -- pages beyond that budget are marked `RENDER_BUDGET_EXCEEDED`
and left unrendered rather than silently growing memory/disk use. PDF
preprocessing is opt-in (`PREPROCESSING_ENABLED`) and additive to
whatever Docling already did for that document, so a PDF request pays no
extra worker round-trip unless this was deliberately turned on.

### Canonical output

`CanonicalDocument.preprocessing: list[PagePreprocessingResult]` is
purely additive (empty for documents that never needed preprocessing).
Never contains: filesystem paths, raw image bytes, candidate contact
data, extracted resume text, or EXIF/GPS/device metadata (stripped
before scoring, not just before the response). `artifactRef` is always
`None` in this step: the preprocessed image is written to the request's
own per-job temp directory, which is deleted (same `isolated_temp_dir()`
guarantee as the uploaded file) before the response returns -- there is
no persistent artifact for a later step to reference yet. **Step 6
(PaddleOCR) will need to decide whether/how to extend job-scoped storage
if it needs to reuse this image rather than reprocessing from the
original upload** -- this is the "how does OCR access the artifact"
question the review asked to have defined; the answer for this step is
"it currently doesn't persist past the request," which Step 6 must
address deliberately rather than assume.

### Temp isolation and cleanup

The preprocessed image is written under a subdirectory of the SAME
per-request `isolated_temp_dir()` used for the uploaded file -- no
separate isolation mechanism was needed: the existing Step 4 guarantee
(the parent's `with` block always runs `shutil.rmtree` in `finally`,
regardless of success/failure/timeout, since the worker process is
killed and the route function returns before that block exits) already
covers preprocessing output for free. Proven directly across all three
outcomes in `test_request_temp_dir_is_removed_after_success_failure_and_timeout`
(Step 4.5) and confirmed again for preprocessing specifically in the
resource measurement below. New for this step: a startup + 15-minute
periodic sweep (`sweep_abandoned_temp_dirs`) for the one scenario that
guarantee can't cover -- the PARENT process itself being killed (not
just the worker) mid-request. Path-validated (direct child of the real
temp root, matching prefix, not a symlink) before any delete.

### Real measurement (preprocessing-only worker, Docling disabled to isolate the cost)

| Metric | Value |
|---|---|
| Parent RSS before/after all work | 28.0 MB / 30.9 MB (flat) |
| Worker RSS after warm-up (OpenCV/Pillow/pypdfium2 only, no torch) | **56.5 MB** (vs Docling's ~1.05GB) |
| Warm-up duration | 0.74s (no model to load) |
| Single clean-image processing duration | 0.73s |
| Peak worker RSS during single-image processing | 180.7 MB |
| Scanned-PDF render + preprocess duration | 0.91s |
| Peak worker RSS during PDF rendering | 151.5 MB |
| Worker RSS across 10 repeated images | 68.0 -> 68.6 MB (**no measurable growth**) |
| Output image file size (one page) | 162,930 bytes |
| Temp dir existed + had output during the request, removed after | confirmed all three |
| Worker process alive after shutdown | confirmed not alive |

**What this proves**: the multi-engine "don't load unnecessary engines"
design works -- with Docling disabled, the worker never pays any of its
~1GB footprint, confirming isolation between engines is real, not just
documented. Preprocessing's memory profile is also qualitatively
different from Docling's: **no measurable growth across 10 repeated
conversions** (68.0MB -> 68.6MB), unlike Docling's steady +15-19MB per
conversion measured in Step 4.5 -- OpenCV/Pillow operations don't
appear to retain state across calls the way Docling's model pipeline
does. `DOCLING_WORKER_MAX_RSS_MB`/`DOCLING_WORKER_MAX_DOCUMENTS`
recycling still applies to the shared worker regardless (a
preprocessing-heavy workload benefits less from it, but it costs nothing
extra to leave enabled).

**Reassessed against this data**: the 4g container limit (set in Step
4.5, driven by Docling's footprint) has ample headroom for preprocessing
on top -- peak preprocessing RSS (180.7MB) is small relative to that
budget. Queue capacity (1), pixel limits (6000px/40M), and the shared
per-job timeout (45s, vs preprocessing's own sub-1s real durations) all
have comfortable headroom for this workload as measured; none needed
adjustment for Step 5 specifically. Only measured against small
synthetic fixtures and one real scanned-PDF fixture -- re-measure
against production-scale, higher-resolution real documents before
treating any of this as final.

## Step 6: PaddleOCR integration

### Architecture

Docling and OCR now run as **two independent worker pools**, each its own
isolated `multiprocessing` child process, supervised by its own
`DoclingWorkerSupervisor` instance (that class name predates this split
and is generic -- "supervises a worker process hosting one or more
engines" -- not literally Docling-specific):

- `docling_supervisor` (`app/worker/instance.py`): hosts only `docling`.
  Never imports OpenCV/PaddleOCR.
- `ocr_supervisor`: hosts `preprocessor` (moved out of the old shared
  pool) and `ocr` together, per the spec ("OCR worker: preprocessing +
  PaddleOCR"). Never imports torch/docling.

A Docling timeout/crash/recycle terminates and restarts only
`docling_supervisor`'s own OS process; `ocr_supervisor`'s process, PID,
and RSS are provably untouched, and vice versa -- proven directly (not
just asserted) by `test_ocr_timeout_and_restart_does_not_affect_docling`
and `test_docling_timeout_and_restart_does_not_affect_ocr` in
`tests/test_ocr_worker_pools.py`, and by a real measurement
(`measure_two_pools.py`, see Resource measurement below) showing two
genuinely distinct PIDs whose RSS is unaffected by the other's crash.

Preprocessing calls happen **in-process, inside the OCR worker**, not
via a second queued job: `PaddleOCREngine` imports
`app.preprocessing.pipeline`/`pdf_routing` directly (the same functions
`PreprocessorEngine` uses) and hands the cleaned image straight to
PaddleOCR within one `OcrJob`/one worker-process function call. No
filesystem path is ever returned in an HTTP response, and the
intermediate image never leaves the request's own per-job temp
directory (a subdirectory of the same `isolated_temp_dir()` used
throughout this service), which is deleted before the response returns.

Readiness is reported **per capability**, not per pool: `/health/ready`
and `/v1/capabilities` each expose `docling`, `preprocessor`, and `ocr`
as independent entries (`engineAvailability` keyed per engine, not one
flag for the whole pool). Route admission checks the SPECIFIC engine a
request needs (`ocr_supervisor.is_engine_available("ocr")`), never
infers usability from the pool merely being READY -- proven by
`test_pool_ready_but_specific_engine_unavailable_falls_back_correctly`,
which puts the OCR pool in a state where `preprocessor` is READY but
`ocr` specifically is not, and confirms the route falls back to
preprocessing-only rather than claiming OCR happened.

### Dependencies and licences

| Package | Version | Licence (code) | Licence (models) |
|---|---|---|---|
| `paddlepaddle` | 3.3.1 | Apache-2.0 | n/a (framework) |
| `paddlex` | 3.7.2 | Apache-2.0 | n/a (pipeline/model-management layer) |
| `paddleocr` | 3.7.0 | Apache-2.0 | n/a (thin wrapper) |
| PP-OCRv5 model weights (det/rec/cls) | current default | n/a | Apache-2.0, confirmed independently via the `PaddlePaddle/PP-OCRv5_mobile_det` Hugging Face model card's `license: apache-2.0` frontmatter -- code licence and model-weight licence were checked as two SEPARATE artifacts, unlike Docling where a single code-licence check was sufficient |

`paddlepaddle` publishes a real Linux CPU wheel for cp311
(`paddlepaddle-3.3.1-cp311-cp311-manylinux1_x86_64.whl`) -- confirmed by
an actual `pip download` in this session (not metadata alone), size
**194,813,574 bytes**, sha256 computed directly from the downloaded file
with Python's `hashlib` (not relayed through any summarising tool -- one
early attempt to fetch a hash via a web-summarisation tool produced a
digest for `paddlex` that did NOT match the real downloaded file's hash,
confirming that path is untrustworthy for anything hash-pinning depends
on; every hash actually used in `requirements-lock.txt` was independently
recomputed from bytes on disk). `paddleocr` (146,750 bytes) and `paddlex`
(2,239,708 bytes) are small, pure-Python `py3-none-any` wheels.

No PaddleOCR-adjacent package requires a native compiler at install time
(pre-built wheels for all three). Matches the `python:3.11-slim` base
image already used, same as Docling.

`requirements-lock.txt` gained hash entries for these three DIRECT
dependencies only (see that file's "Step 6" section header) --
NOT their full transitive tree (opencv-contrib-python, shapely,
pyclipper, protobuf, and paddlepaddle's own native dependencies).
Unlike Docling's full 105-package closure, that remainder was judged not
worth hand-resolving one PyPI query at a time; a real `pip-compile
--generate-hashes` run inside the actual Python 3.11 Linux container (the
CI job) would produce it mechanically and correctly. Flagged as a known
limitation, not silently incomplete.

### Model acquisition and cache strategy

PaddleX (PaddleOCR's inference layer) downloads model weights on first
use to a cache directory it manages (`PADDLEX_HOME`), from one of several
hosting platforms selectable via `PADDLE_PDX_MODEL_SOURCE`
(huggingface/aistudio/bos/modelscope). A single Careeriz-owned env var,
`PADDLEOCR_MODEL_DIR`, is set before any paddlex import
(`app/config.py`) and controls this cache location -- unset, it falls
through to PaddleX's own default.

**Never during a user request**: `PaddleOCREngine._get_ocr()` constructs
the `PaddleOCR(...)` pipeline object exactly once and caches it on the
engine instance; every subsequent OCR call reuses that instance.
Construction (the only operation that could trigger a model
load/download) happens in `warmup()`, which the supervisor runs BEFORE
the worker is admitted into `READY`/`BUSY` (the states that accept
requests) -- structurally, not by convention, a request cannot reach the
OCR engine until warm-up has already completed. Proven directly by
`test_paddleocr_engine_constructs_the_pipeline_only_once`, which
monkeypatches a fake `paddleocr` module (via `sys.modules`, since the
real package can't be installed in this dev sandbox -- see below) and
asserts the constructor runs exactly once across a warm-up call plus
three subsequent OCR calls.

`OCR_WARMUP_TIMEOUT_SECONDS` defaults to 300s specifically to
accommodate a cold model download over the network at service startup --
if a deployment wants to guarantee zero network dependency at startup
(a locked-down/air-gapped environment), pre-bake `PADDLEOCR_MODEL_DIR`
into the image during the Docker build and warm-up will find the models
already cached.

**Known gap, stated plainly**: PaddleX has a documented real-world issue
(public GitHub issue #16620/#16639 against `PaddleOCR`) where some
versions attempt a network reachability check for model hosting
platforms even when a valid model is already cached locally, which can
fail loudly in an air-gapped deployment. This was found via research,
not reproduced locally (paddleocr cannot run in this sandbox --
see below). If `PADDLEOCR_MODEL_DIR` is pre-baked and warm-up still fails
in a genuinely air-gapped deployment, this is the first thing to check.

### Verification status -- what could and could not be run for real

**Could verify**: Python 3.11/Linux CPU wheel existence and exact size
(via a real `pip download`, not metadata alone), code and model-weight
licensing (Apache-2.0 throughout, checked as two separate artifacts),
the full architecture/isolation/timeout/readiness/reconciliation logic
(all real code, all tested with a configurable `FakeEngine` standing in
for PaddleOCR -- see Tests below), and the pure decision functions
(`app/ocr/orientation.py`, `reading_order.py`, `quality_policy.py`,
`reconciliation.py`) against real, hand-constructed inputs.

**Could NOT verify**: actually running PaddleOCR. `paddlepaddle`
publishes wheels only for cp39-cp313; this dev sandbox's only local
Python is 3.14 (confirmed: `py -0p` shows a stale/broken 3.13
registration pointing at a non-existent path), and no Docker/Linux
environment is available here either. This means:

- The exact PaddleOCR 3.x `PaddleOCR.predict()` result shape
  (`rec_texts`/`rec_scores`/`rec_polys`, `doc_preprocessor_res` for
  orientation) that `app/engines/paddleocr_engine.py`'s
  `_parse_ocr_result`/`_parse_orientation_result` assume is based on
  general knowledge of the PaddleX 3.x unified pipeline API, NOT a real
  execution. Written defensively: an unrecognised shape raises
  `OcrResultParseError` (fails warm-up -> DEGRADED) rather than silently
  returning wrong or empty data -- a shape mismatch will be loud, not
  silent, on first real deployment.
- If the orientation classifier's result doesn't expose a confidence
  score the way assumed (`doc_preprocessor_res["score"]`), every
  orientation result will come back `uncertain=true` (the safe default,
  not a crash) until this is corrected against the real API.
- **No real OCR accuracy, latency, or memory numbers exist in this
  report.** Every number in the earlier resource-measurement sections
  used `FakeEngine`, which proves the ARCHITECTURE (process isolation,
  timeout, readiness) is real, but says nothing about PaddleOCR's own
  cost or correctness. This is the same category of gap Docling had in
  the Step 4 closure (Python 3.11/Docker unverifiable then either), and
  is called out with the same explicitness rather than papered over with
  fabricated numbers -- the Step 6 request was explicit that "recruiter
  grade" claims must not come from synthetic fixtures alone; here they
  cannot come from ANY real execution at all yet, which is a stronger
  and more important caveat to state plainly.
- **Recommendation**: the very first thing to do in the Python 3.11
  Linux CI container (before trusting this in any real deployment) is
  set `PADDLEOCR_ENABLED=true` and run the existing skipped-by-default
  real-engine smoke test pattern (matching `DoclingEngine`'s
  `test_real_docling_conversion_through_the_full_supervisor_stack`) --
  none exists yet for OCR because writing one against an unverified API
  would risk encoding wrong assumptions as if they were confirmed;
  add it once the real API shape is confirmed in that environment.

### OCR flow (as implemented)

- **Image upload**: security validation -> preprocessing (in-process) ->
  orientation classification (PaddleOCR's own
  `use_doc_orientation_classify=True` submodule, NOT a "rotate and see if
  OCR finds more text" heuristic -- that comparison was explicitly
  rejected per the spec) -> PaddleOCR text detection/recognition ->
  duplicate/overlap suppression (IoU-based) -> reading-order
  reconstruction (row/column-aware, real two-column detection) ->
  canonical `OcrTextBlock` entries. `selectedRoute="OCR_EXTRACTED"`.
- **Scanned/hybrid PDF**: `pdf_routing.assess_pdf_pages` classifies every
  page independently (reused from Step 5, unchanged); only
  `IMAGE_ONLY`/`RENDER_FOR_OCR` and `LOW_QUALITY_NATIVE_TEXT`/
  `NATIVE_WITH_OCR_BACKUP` pages are rendered and OCR'd -- a
  `GOOD_DIGITAL_TEXT` page is never rendered to an image, matching Step
  5's existing guarantee. Bounded by `OCR_MAX_PAGES_PER_DOCUMENT`
  (default 30); truncation is logged and surfaced as a warning on the
  last processed page, never silent.
- **Low-quality native-text PDF**: Docling's native `textBlocks` (already
  produced by the Docling pool, independently) and the OCR pool's
  candidate blocks for the SAME page are compared in
  `app/ocr/reconciliation.py`'s `reconcile_page()` -- see Reconciliation
  below. Both extraction pools genuinely run, independently, for this
  case: proven by `test_pdf_reconciliation_appears_for_low_quality_native_text_page`,
  which starts both fake pools and confirms both contributed real,
  distinguishable data to the reconciliation decision (not a stub always
  returning the same canned answer).

### Reconciliation rules (native vs. OCR)

Implemented in `app/ocr/reconciliation.py`, unit-tested across all five
branches (`tests/test_ocr_policy.py`):

1. No OCR candidate at all -> `OCR_NOT_ATTEMPTED`.
2. No native text exists (page was `IMAGE_ONLY`) -> OCR is the only
   source; `OCR_USED` if it clears `OCR_MIN_CONFIDENCE` (default 0.5),
   else `OCR_LOW_CONFIDENCE_REVIEW_REQUIRED`.
3. Native text is already substantial (>=200 chars) -> `NATIVE_RETAINED`
   regardless of OCR's own confidence -- OCR was only ever a backup
   candidate for genuinely uncertain pages, never a routine second
   opinion on text that's already good. Proven by
   `test_reconcile_substantial_native_text_is_retained_even_if_ocr_ran`
   (OCR given near-perfect confidence and a huge char count still loses).
4. Sparse native text AND OCR clears its confidence bar AND finds a REAL
   margin of extra content (>=1.5x the native char count, not "one extra
   character") -> `OCR_USED`. A marginal OCR gain (proven by
   `test_reconcile_marginal_ocr_gain_does_not_override_native`) does
   NOT trigger this.
5. Neither source is confidently good -> `BOTH_RETAINED_LOW_CONFIDENCE`;
   both `textBlocks` (native) and `ocrTextBlocks` (OCR) stay in the
   response, neither is asserted as authoritative, and a human reviewer
   has both pieces of evidence.

`textBlocks` (Docling's output) is never mutated or overwritten by this
process -- the reconciliation decision is exposed as evidence
(`CanonicalDocument.reconciliation`), and it is left to a later
consumer to act on it, consistent with "this step produces document
text/layout evidence only."

### Orientation

`app/ocr/orientation.py`'s `decide_orientation()` is a pure decision
function over the classifier's raw output: confident (>=
`OCR_ORIENTATION_CONFIDENCE_THRESHOLD`, default 0.85) results are
applied; anything else (low confidence, missing result, an invalid
degree value) is left un-rotated with `uncertain=true` recorded --
never fabricated, never inferred from OCR output quality. All four
paths (confident, low-confidence, missing, invalid) are directly unit
tested. The real classifier call itself (PaddleOCR's
`use_doc_orientation_classify=True` submodule) could not be exercised
end-to-end for the same reason as the rest of PaddleOCR -- see
Verification status above.

### Quality policy

`app/ocr/quality_policy.py`: `mean_confidence()` (average of all
detected lines' confidence, `None` if none), `is_empty_output()` (zero
blocks, or every block's text is blank after stripping), and
`is_low_confidence_page()` (mean confidence below `OCR_MIN_CONFIDENCE`).
A page with empty or low-confidence output is never silently dropped --
`PaddleOCREngine._build_page_result` appends an explicit warning
("OCR produced no readable text for this page." /
"OCR confidence is below the minimum threshold... review recommended.")
and sets `emptyOutput`/`lowConfidence` flags, rather than returning a
page that merely happens to have zero blocks with no explanation.
Page-level failure isolation: `worker_process.py`'s `OcrJob` handling
catches any per-document exception and reports a structured
`OcrResult(success=False, ...)`, matching the existing
Convert/PreprocessResult pattern -- one bad document can never crash the
worker loop or take down other in-flight/future jobs.

### Tests

67 new Step 6 tests, all passing (`test_ocr_policy.py`: 32,
`test_ocr_worker_pools.py`: 10, plus adjustments to 5 existing files for
the pool split) -- full suite: **128 passed, 13 skipped** (skips are the
pre-existing Docling-gated real-engine smoke test plus tests that only
run meaningfully with `DOCLING_ENABLED=true`; none newly skipped for
Step 6, since no Step 6 test depends on the real paddleocr package being
importable -- every Step 6 test uses either pure functions or
`FakeEngine`). `ruff check` clean.

Security/reliability matrix (all 10 items from the spec), each with a
real passing test in `tests/test_ocr_worker_pools.py`:

| # | Requirement | Test |
|---|---|---|
| 1 | `/health/live` responsive during OCR | `test_health_live_responds_while_ocr_is_hanging` |
| 2 | Hard timeout kills the actual OCR process | `test_ocr_hard_timeout_terminates_the_worker_process` |
| 3 | Timed-out work does not continue | same test -- asserts `not old_process.is_alive()` immediately after the timeout |
| 4 | OCR recreated without affecting Docling | `test_ocr_timeout_and_restart_does_not_affect_docling` |
| 5 | Docling restart does not affect OCR | `test_docling_timeout_and_restart_does_not_affect_ocr` |
| 6 | Queue overflow -> prompt `SERVICE_BUSY` | `test_ocr_queue_overflow_over_http_returns_503` |
| 7 | Capability-specific readiness | `test_pool_ready_but_specific_engine_unavailable_falls_back_correctly` |
| 8 | Temp cleanup on success/failure/timeout | `test_ocr_request_temp_dir_is_removed_after_success_failure_and_timeout` |
| 9 | No filenames/PII/paths in logs | `test_no_filename_or_path_in_logs_for_ocr_request` |
| 10 | No uncontrolled model download during a request | `test_paddleocr_engine_constructs_the_pipeline_only_once` |

### Resource measurement

**Real measurement performed** (`measure_two_pools.py`, `FakeEngine` for
both pools -- proves the TWO-PROCESS ARCHITECTURE's own overhead and
isolation, not real Paddle model memory):

| Metric | Value |
|---|---|
| Parent RSS before starting either pool | 28.1 MB |
| Both pools spawned + warmed (parallel) | 0.28s |
| Docling pool PID / OCR pool PID | genuinely distinct (39860 / 36784 in one run) |
| Parent RSS after both pools started | 29.0 MB |
| Docling pool PID/RSS after the OCR pool's own timeout+crash+restart | **unchanged** |
| OCR pool PID after a separate crash-recovery cycle | unchanged from its own baseline |
| All processes confirmed dead after shutdown | yes |

**What this proves**: the two-pool split is real isolation, not just a
config label -- two genuinely separate OS processes, and one crashing
provably does not touch the other's PID or memory. **What this does NOT
prove**: real PaddleOCR memory usage, which requires the actual package
(see Verification status above).

### Combined resource decision

Could not measure real combined Docling+OCR memory (same constraint).
Decision made from the best available evidence:

- Docling's real, measured worst case (Step 4/4.5): ~2.6-2.7GB before
  recycling.
- PaddleOCR's estimated ceiling (NOT measured): paddlepaddle's own
  ~195MB installed wheel plus commonly-reported CPU inference RSS
  for PaddleOCR's full pipeline in public issue trackers/discussions
  (several hundred MB to ~1.5GB) -- treated as a rough upper bound.
- Step 6 changed the sizing question itself: Docling and OCR are now
  independent pools that can genuinely be busy AT THE SAME TIME (a real
  request could hit Docling while another hits OCR), unlike Step 5's
  single shared pool where only one heavy job ever ran across every
  engine -- so the container must now budget for BOTH peaks
  simultaneously, not the max of the two.

**Recommendation, made explicitly per the spec's requirement to choose
one**: keep the two pools in ONE container for now (`mem_limit: 6g`,
`cpus: 3` in `docker-compose.yml`, up from 4g/2 -- a provisional
estimate, not a measurement) since the code-level isolation (separate
processes, separate timeouts, separate recycling) already delivers the
crash/resource-containment properties that would otherwise motivate
separate containers, and splitting containers is a deployment change
with no code implications either way (the process boundary is already
there). **If real Linux/3.11 measurement shows the combined footprint is
large relative to available host memory, or the two pools need
independently tunable limits/scaling policies, prefer separate
containers over continuing to grow one shared limit** -- this is
flagged as the concrete trigger for revisiting the decision, not left
implicit.

### Canonical schema additions (additive only)

`OrientationAssessment`, `OcrTextBlock`, `OcrPageResult`,
`PageReconciliationDecision` (all new, `app/schemas.py`).
`CanonicalDocument` gained `ocrTextBlocks`, `ocrPages`, `reconciliation`
(all default to empty lists). No existing field's meaning changed. Never
includes filesystem paths, raw bytes, EXIF/GPS, or candidate PII --
`preprocessingResult` embedded in each OCR page dict is stripped of
`_`-prefixed internal keys (`_artifactPath`) before it reaches the
response, same pattern as Step 5.

### Known limitations

- **PaddleOCR's real API/result shape is unverified** (see Verification
  status above) -- the single most important thing to confirm before any
  real deployment.
- **`requirements-lock.txt`'s Step 6 addition is partial** -- three
  direct dependencies hash-pinned from real downloads, not their full
  transitive tree.
- **`OCR_WORKER_MAX_RSS_MB` (1800) and the 6g/3cpu container limit are
  estimates**, not measurements.
- **No real accuracy/latency benchmark exists** -- the spec's requested
  CER/WER, field-accuracy, and orientation-accuracy numbers against the
  20-category fixture set could not be produced without a working
  PaddleOCR install; producing FABRICATED numbers instead was
  deliberately avoided per the spec's own instruction not to claim
  results synthetic fixtures alone couldn't support, which applies with
  even more force when there is no real execution at all.
- **The known PaddleX offline-mode/network-check issue** (see Model
  acquisition above) was found via research, not reproduced -- worth a
  deliberate air-gapped-startup test once the real package can run.
- **`ruff format --check` style drift** carried forward unchanged from
  every prior step (pre-existing, not touched, to keep this diff scoped).
- Multilingual/Indian-name OCR accuracy (the spec's benchmark request)
  is entirely unverified for the same reason -- PaddleOCR's `lang="en"`
  default was kept; multi-language support exists in the package per its
  published documentation but was not exercised.
