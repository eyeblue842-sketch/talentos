import pytest
from pydantic import ValidationError

from app.schemas import (
    CanonicalDocument,
    DocumentMetadata,
    ProcessingDurations,
)


def _minimal_document(**overrides):
    base = dict(
        schemaVersion="1.0.0",
        parserVersion="document-processor-0.1.0",
        correlationId="corr-1",
        engineVersions={"docling": None, "paddleocr": None},
        selectedRoute="SCAFFOLD_NOT_IMPLEMENTED",
        documentMetadata=DocumentMetadata(
            pageCount=1, fileSizeBytes=100, mimeType="application/pdf",
            sniffedMimeType="application/pdf", originalFilename="resume.pdf",
        ),
        processingDurations=ProcessingDurations(totalMs=10, validationMs=5),
    )
    base.update(overrides)
    return base


def test_canonical_document_accepts_a_well_formed_scaffold_payload():
    doc = CanonicalDocument(**_minimal_document())
    assert doc.schemaVersion == "1.0.0"
    assert doc.pages == []
    assert doc.readingOrderApplied is False


def test_canonical_document_rejects_missing_required_fields():
    payload = _minimal_document()
    del payload["documentMetadata"]
    with pytest.raises(ValidationError):
        CanonicalDocument(**payload)


def test_canonical_document_rejects_out_of_range_confidence():
    with pytest.raises(ValidationError):
        CanonicalDocument(**_minimal_document(extractionConfidence=1.5))


def test_document_metadata_requires_file_size_and_mime_type():
    with pytest.raises(ValidationError):
        DocumentMetadata(pageCount=1, mimeType="application/pdf", sniffedMimeType="application/pdf", originalFilename="x.pdf")
