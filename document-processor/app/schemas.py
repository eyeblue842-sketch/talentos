"""Versioned request/response contract between the Node worker and this
service. Any breaking change to these shapes must bump schema_version in
config.py — the Node adapter checks this and refuses to trust a response
whose schemaVersion it does not recognise, rather than guessing.
"""
from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


class RequestedOperation(str, Enum):
    STRUCTURE = "structure"
    OCR = "ocr"
    PHOTO_EXTRACTION = "photo_extraction"


class RouteHint(str, Enum):
    AUTO = "auto"
    NATIVE_TEXT = "native_text"
    SCANNED = "scanned"
    IMAGE = "image"


class AnalyseRequestMeta(BaseModel):
    correlationId: str = Field(..., min_length=1, max_length=200)
    originalFilename: str = Field(..., min_length=1, max_length=512)
    mimeType: str = Field(..., min_length=1, max_length=200)
    parserVersion: str | None = None
    requestedOperations: list[RequestedOperation] = Field(default_factory=lambda: [RequestedOperation.STRUCTURE])
    routeHint: RouteHint = RouteHint.AUTO
    deadlineMs: int | None = Field(default=None, ge=1000, le=300_000)


class BoundingBox(BaseModel):
    page: int
    x: float
    y: float
    width: float
    height: float


class TextBlock(BaseModel):
    text: str
    page: int
    readingOrder: int
    boundingBox: BoundingBox | None = None
    section: str | None = None
    engine: str
    engineConfidence: float | None = Field(default=None, ge=0.0, le=1.0)


class TableBlock(BaseModel):
    page: int
    boundingBox: BoundingBox | None = None
    rows: list[list[str]] = Field(default_factory=list)
    engine: str


class ImageCandidate(BaseModel):
    page: int
    boundingBox: BoundingBox | None = None
    widthPx: int | None = None
    heightPx: int | None = None
    mimeType: str | None = None
    engine: str
    # Classification is intentionally NOT performed in Step 3 — photo
    # extraction/classification is its own later step (Step 10).
    classification: str = "NOT_CLASSIFIED"


class PageMetadata(BaseModel):
    pageNumber: int
    widthPx: int | None = None
    heightPx: int | None = None
    nativeTextPresent: bool | None = None


class DocumentMetadata(BaseModel):
    pageCount: int | None = None
    fileSizeBytes: int
    mimeType: str
    sniffedMimeType: str
    originalFilename: str


class ProcessingDurations(BaseModel):
    totalMs: int
    validationMs: int
    extractionMs: int | None = None


class ErrorClassification(BaseModel):
    code: str
    message: str
    retryable: bool


class PagePreprocessingResult(BaseModel):
    """Step 5: cleaned-image + quality metadata for one page. Never
    contains extracted text, candidate contact data, filesystem paths,
    raw image bytes, or EXIF/GPS/device metadata -- see
    docs/document-processor.md for the full "what this does not return"
    list. `artifactRef` is None in this step: the preprocessed image is
    written to the request's own isolated temp directory, which is
    deleted before the response is returned (same lifecycle as the
    uploaded file) -- there is no persistent artifact for a later step to
    reference yet. Step 6 (PaddleOCR) will need to decide whether/how to
    extend job-scoped storage if it needs to reuse this image rather than
    reprocessing from the original upload.
    """
    pageNumber: int
    sourceType: str  # PHOTOGRAPHED_IMAGE | PDF_RENDERED | PDF_NATIVE_TEXT
    textQuality: str | None = None  # PDF pages only: GOOD_DIGITAL_TEXT | LOW_QUALITY_NATIVE_TEXT | IMAGE_ONLY
    plannedRoute: str | None = None  # NATIVE_DOCLING | NATIVE_WITH_OCR_BACKUP | RENDER_FOR_OCR
    rotationDegrees: int | None = None
    originalWidthPx: int | None = None
    originalHeightPx: int | None = None
    outputWidthPx: int | None = None
    outputHeightPx: int | None = None
    colorMode: str | None = None
    skewAngleDegrees: float | None = None
    cropApplied: bool = False
    perspectiveCorrectionApplied: bool = False
    blurScore: float | None = None
    contrastScore: float | None = None
    illuminationScore: float | None = None
    glareScore: float | None = None
    resolutionScore: float | None = None
    overallQualityScore: float | None = Field(default=None, ge=0.0, le=1.0)
    transformationsApplied: list[str] = Field(default_factory=list)
    enhancementApplied: bool = False
    warnings: list[str] = Field(default_factory=list)
    qualityDecision: str | None = None  # ACCEPTABLE | PREPROCESSING_RECOMMENDED | MANUAL_REVIEW_REQUIRED | UNUSABLE
    processingDurationMs: int | None = None
    artifactRef: str | None = None


class OrientationAssessment(BaseModel):
    """Step 6. `detectedDegrees` is the winning class from PaddleOCR's own
    dedicated document-orientation classifier (a real 4-way 0/90/180/270
    model, not a "rotate and see if OCR finds more text" heuristic --
    that comparison method was explicitly rejected: it would rotate an
    image because OCR produced slightly more text, not because the
    orientation is actually known). `appliedDegrees` is 0 whenever
    `uncertain` is true -- an uncertain page is left in its original
    orientation, never guessed."""
    detectedDegrees: int = Field(..., ge=0, le=270)
    appliedDegrees: int = Field(..., ge=0, le=270)
    confidence: float | None = Field(default=None, ge=0.0, le=1.0)
    uncertain: bool = False
    method: str = "paddleocr_doc_orientation_classifier"


class OcrTextBlock(BaseModel):
    page: int
    text: str
    readingOrder: int
    boundingBox: BoundingBox | None = None
    confidence: float = Field(..., ge=0.0, le=1.0)
    engine: str = "paddleocr"
    engineVersion: str | None = None
    # OCR_IMAGE (direct JPG/PNG upload) | OCR_RENDERED_PDF_PAGE (an
    # IMAGE_ONLY PDF page rendered then OCR'd) | OCR_LOW_QUALITY_FALLBACK
    # (a LOW_QUALITY_NATIVE_TEXT PDF page -- native extraction exists too;
    # see `reconciliation` on CanonicalDocument for which one was selected).
    extractionRoute: str
    preprocessingApplied: list[str] = Field(default_factory=list)


class OcrPageResult(BaseModel):
    """Page-level OCR outcome and quality signals -- separate from the
    individual OcrTextBlock entries so a page with zero/low-confidence
    text still reports *why*, not just an empty block list."""
    pageNumber: int
    sourceType: str  # PHOTOGRAPHED_IMAGE | PDF_RENDERED
    extractionRoute: str
    orientation: OrientationAssessment | None = None
    meanConfidence: float | None = Field(default=None, ge=0.0, le=1.0)
    lowConfidence: bool = False
    emptyOutput: bool = False
    warnings: list[str] = Field(default_factory=list)
    processingDurationMs: int | None = None


class PageReconciliationDecision(BaseModel):
    """Step 6 native-vs-OCR reconciliation. Records a *decision*, never
    silently overwrites `textBlocks` (Docling's native output) -- a
    downstream consumer decides how to merge `ocrTextBlocks` in, using
    this as evidence. `NATIVE_RETAINED`/`OCR_USED` are confident
    decisions; `BOTH_RETAINED_LOW_CONFIDENCE` means neither source cleared
    its confidence bar and both are exposed for manual review rather than
    either being asserted as authoritative."""
    page: int
    decision: str  # NATIVE_RETAINED | OCR_USED | BOTH_RETAINED_LOW_CONFIDENCE | OCR_NOT_ATTEMPTED | OCR_LOW_CONFIDENCE_REVIEW_REQUIRED
    reason: str
    nativeCharCount: int | None = None
    ocrMeanConfidence: float | None = None


class CanonicalDocument(BaseModel):
    schemaVersion: str
    parserVersion: str
    correlationId: str
    engineVersions: dict[str, str | None]
    selectedRoute: str
    fallbackReasons: list[str] = Field(default_factory=list)
    documentMetadata: DocumentMetadata
    pages: list[PageMetadata] = Field(default_factory=list)
    textBlocks: list[TextBlock] = Field(default_factory=list)
    tables: list[TableBlock] = Field(default_factory=list)
    images: list[ImageCandidate] = Field(default_factory=list)
    readingOrderApplied: bool = False
    extractionConfidence: float | None = Field(default=None, ge=0.0, le=1.0)
    qualityWarnings: list[str] = Field(default_factory=list)
    processingDurations: ProcessingDurations
    error: ErrorClassification | None = None
    # Step 5, purely additive: populated when any page went through the
    # image-preprocessing pipeline (a direct image upload, or a
    # scanned/hybrid PDF page). Empty for documents that never needed it
    # (e.g. a clean digital PDF/DOCX handled entirely by Docling).
    preprocessing: list[PagePreprocessingResult] = Field(default_factory=list)
    # Step 6, purely additive: populated for image uploads, OCR-routed
    # scanned/hybrid PDF pages, and low-quality-native-text PDF pages OCR'd
    # as a candidate alongside Docling's native extraction. Empty for
    # documents that never needed OCR.
    ocrTextBlocks: list[OcrTextBlock] = Field(default_factory=list)
    ocrPages: list[OcrPageResult] = Field(default_factory=list)
    reconciliation: list[PageReconciliationDecision] = Field(default_factory=list)


class HealthLiveResponse(BaseModel):
    status: str = "live"


class EngineReadiness(BaseModel):
    available: bool
    reason: str | None = None
    version: str | None = None
    # Populated only for docling (Step 4.5): the isolated worker's
    # lifecycle state (WARMING/READY/BUSY/DEGRADED/...). None for engines
    # that don't run in a supervised worker process.
    workerState: str | None = None


class DoclingWorkerStatus(BaseModel):
    # One of the DoclingWorkerSupervisor WorkerState values (Step 4.5):
    # UNAVAILABLE, STARTING, WARMING, READY, BUSY, DEGRADED, RESTARTING,
    # SHUTTING_DOWN, STOPPED. Kept as a plain str here (not a pydantic
    # Enum) so the schema doesn't need to import the worker module.
    state: str
    engineVersion: str | None = None
    degradedReason: str | None = None
    activeConversions: int
    queuedRequests: int
    queueCapacity: int


class PreprocessingEngineStatus(BaseModel):
    # Step 5: originally shared Docling's worker process. Step 6 moved
    # preprocessing into the OCR worker pool instead (it now shares the
    # SAME STARTING/WARMING/READY/BUSY/DEGRADED lifecycle reported in
    # `ocr` below, not `docling`) -- but keeps its own independent
    # warm-up outcome regardless: one engine failing in that pool does not
    # imply the other did.
    available: bool
    version: str | None = None
    reason: str | None = None


class OcrWorkerStatus(BaseModel):
    # Step 6: the OCR worker pool's own lifecycle -- a SEPARATE process
    # from `docling` above (see app/worker/instance.py). Same shape as
    # DoclingWorkerStatus deliberately: both are "one supervised worker
    # process" snapshots, just of different pools.
    state: str
    engineVersion: str | None = None
    degradedReason: str | None = None
    activeConversions: int
    queuedRequests: int
    queueCapacity: int


class HealthReadyResponse(BaseModel):
    status: str
    engines: dict[str, EngineReadiness]
    docling: DoclingWorkerStatus
    preprocessing: PreprocessingEngineStatus
    ocr: OcrWorkerStatus
    activeRequests: int
    maxConcurrentRequests: int


class CapabilitiesResponse(BaseModel):
    schemaVersion: str
    parserVersion: str
    supportedMimeTypes: list[str]
    engines: dict[str, EngineReadiness]
    gpuEnabled: bool
    limits: dict[str, int | float]


class SafeErrorResponse(BaseModel):
    code: str
    message: str
    retryable: bool
    correlationId: str | None = None
