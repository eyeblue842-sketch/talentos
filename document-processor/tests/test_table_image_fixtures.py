"""Step 4 closure: real table/image extraction fixtures.

Scope is deliberately narrow, matching what Step 4 owns: verify real
Docling conversion maps correctly into CanonicalDocument structure --
tables preserve rows/cells, images are enumerated with page/bbox metadata
where available, and reading order is stable. No image is activated as a
candidate profile photo here (every image's classification must stay
NOT_CLASSIFIED) -- photo classification/activation is explicitly a later
step, not this one.

All fixtures are synthetic and privacy-safe: invented names, .invalid
email domains, geometric placeholder images (no real photos, logos, QR
codes or signatures). Generated with pdfkit (PDF) and python-docx (DOCX)
so tables and images are genuine PDF/OOXML structures, not text that
merely looks table-shaped.
"""

import os

import pytest

from app.engines.docling_engine import DoclingEngine

engine = DoclingEngine()
availability = engine.check_availability()

pytestmark = pytest.mark.skipif(
    not availability.available,
    reason=f"docling not available: {availability.reason}",
)

FIXTURES_DIR = os.path.join(os.path.dirname(__file__), "fixtures")


def _fixture_path(name: str) -> str:
    return os.path.join(FIXTURES_DIR, name)


def _assert_reading_order_is_stable(text_blocks):
    for i, block in enumerate(text_blocks):
        assert block["readingOrder"] == i


def _assert_no_image_is_classified_as_a_photo(images):
    for image in images:
        assert image["classification"] == "NOT_CLASSIFIED", (
            "Step 4 must never activate an image as a candidate profile photo -- that classification/activation is explicitly a later step."
        )


# --- PDF table ----------------------------------------------------------


def test_pdf_table_preserves_rows_and_cells():
    result = engine.analyse(_fixture_path("fixture-12-pdf-table.pdf"), "application/pdf")

    assert len(result["tables"]) == 1
    table = result["tables"][0]
    assert table["rows"] == [
        ["Certification", "Year", "Issuer", "Status"],
        ["CFA Level II", "2022", "CFA Institute", "Active"],
        ["FRM Part I", "2020", "GARP", "Active"],
        ["Excel Expert", "2019", "Microsoft", "Active"],
    ]
    assert table["page"] == 1
    assert table["boundingBox"]["page"] == 1
    assert table["boundingBox"]["width"] > 0
    assert table["boundingBox"]["height"] > 0
    _assert_reading_order_is_stable(result["textBlocks"])


# --- DOCX table -----------------------------------------------------------


def test_docx_table_preserves_rows_and_cells():
    result = engine.analyse(
        _fixture_path("fixture-13-docx-table.docx"),
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )

    assert len(result["tables"]) == 1
    table = result["tables"][0]
    assert table["rows"] == [
        ["Skill", "Years", "Level"],
        ["SQL", "6", "Expert"],
        ["Python", "4", "Advanced"],
        ["Tableau", "3", "Intermediate"],
    ]
    # DOCX has no fixed pagination -- bounding boxes are genuinely absent.
    assert table["boundingBox"] is None
    _assert_reading_order_is_stable(result["textBlocks"])


# --- PDF embedded portrait-like image --------------------------------


def test_pdf_embedded_image_is_enumerated_with_page_and_bbox():
    result = engine.analyse(_fixture_path("fixture-14-pdf-portrait-image.pdf"), "application/pdf")

    assert len(result["images"]) == 1
    image = result["images"][0]
    assert image["page"] == 1
    assert image["boundingBox"]["page"] == 1
    assert image["boundingBox"]["width"] > 0
    assert image["boundingBox"]["height"] > 0
    _assert_no_image_is_classified_as_a_photo(result["images"])
    _assert_reading_order_is_stable(result["textBlocks"])
    all_text = " ".join(b["text"] for b in result["textBlocks"])
    assert "David Okoro" in all_text


# --- DOCX embedded portrait-like image --------------------------------


def test_docx_embedded_image_is_enumerated():
    result = engine.analyse(
        _fixture_path("fixture-15-docx-portrait-image.docx"),
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )

    assert len(result["images"]) == 1
    image = result["images"][0]
    assert image["page"] == 1
    # DOCX images have no fixed page geometry either.
    assert image["boundingBox"] is None
    _assert_no_image_is_classified_as_a_photo(result["images"])
    _assert_reading_order_is_stable(result["textBlocks"])


# --- Logo, QR-like and signature-like images in one document ---------


def test_logo_qr_and_signature_images_are_all_enumerated_and_unclassified():
    result = engine.analyse(_fixture_path("fixture-16-logo-qr-signature.pdf"), "application/pdf")

    # Three distinct embedded images placed in the fixture: a logo, a
    # QR-like pattern and a signature-like scribble.
    assert len(result["images"]) == 3
    for image in result["images"]:
        assert image["page"] == 1
        assert image["boundingBox"]["width"] > 0
        assert image["boundingBox"]["height"] > 0
    _assert_no_image_is_classified_as_a_photo(result["images"])
    _assert_reading_order_is_stable(result["textBlocks"])


# --- Multi-page document with repeated header/footer ------------------


def test_multipage_document_has_stable_reading_order_across_pages():
    result = engine.analyse(_fixture_path("fixture-17-repeated-header-footer.pdf"), "application/pdf")

    # Built with 3 explicit page breaks, but this fixture's body content
    # (the publications list) overflows a single page under pdfkit's own
    # auto-pagination, so the real PDF has more physical pages than that --
    # asserting >= 3 (not an exact count) is what's actually true of the
    # generated file, verified by direct inspection of this real run.
    assert len(result["pages"]) >= 3
    assert len(result["textBlocks"]) >= 1
    _assert_reading_order_is_stable(result["textBlocks"])
    all_text = " ".join(b["text"] for b in result["textBlocks"])
    assert "Elena Petrova" in all_text
    # the repeated footer text appears (reading order picked it up on
    # more than one page, not just once)
    assert all_text.count("Page") >= 2


# --- More realistic two-column resume ----------------------------------


def test_two_column_resume_does_not_pollute_the_name_with_sidebar_content():
    result = engine.analyse(_fixture_path("fixture-18-two-column-resume.pdf"), "application/pdf")

    assert len(result["textBlocks"]) >= 1
    _assert_reading_order_is_stable(result["textBlocks"])
    first_block_text = result["textBlocks"][0]["text"]
    assert "Amara Osei" in first_block_text
    # the sidebar's contact/skills content must not bleed into the same
    # block as the candidate's name
    assert "Supply Chain" not in first_block_text
