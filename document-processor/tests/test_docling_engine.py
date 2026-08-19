"""Real Docling extraction tests. These are slow (model loading, real
conversion) and require the actual `docling` package installed -- skipped
cleanly (not failed) if it isn't, matching DoclingEngine.check_availability()
so this file behaves the same whether run against the full dependency set or
just the Step 3 scaffold dependencies.

Uses the same synthetic, privacy-safe fixture set built for the Step 2
parser benchmark (backend of Careeriz, not this repo) rather than generating
new PDFs here -- no PDF-writing dependency needed, and these fixtures are
already the ones the baseline comparison in the Step 4 report is measured
against.
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

FIXTURES_DIR = os.environ.get(
    "BENCHMARK_FIXTURES_DIR",
    r"C:\Users\vinoj\AppData\Local\Temp\claude\C--Users-vinoj-Desktop-sivanta-website-New-folder-Careeriz\ed47ce71-72ad-44ad-ae23-d0d9d0ffd0c7\scratchpad\benchmark\fixtures",
)

pytestmark = [
    pytestmark,
    pytest.mark.skipif(not os.path.isdir(FIXTURES_DIR), reason=f"benchmark fixtures directory not found: {FIXTURES_DIR}"),
]


def _fixture_path(name: str) -> str:
    return os.path.join(FIXTURES_DIR, name)


def test_check_availability_reports_a_real_version_string():
    assert availability.available is True
    assert availability.version is not None
    assert availability.version.count(".") >= 1  # looks like a real semver, not a placeholder


def test_analyse_extracts_text_blocks_with_page_and_reading_order():
    result = engine.analyse(_fixture_path("fixture-01-clean-senior.pdf"), "application/pdf")

    assert result["readingOrderApplied"] is True
    assert len(result["pages"]) == 2  # this fixture is built as a 2-page PDF
    assert len(result["textBlocks"]) >= 1
    for i, block in enumerate(result["textBlocks"]):
        assert block["engine"] == "docling"
        assert block["readingOrder"] == i  # strictly increasing, matches iteration order
    all_text = " ".join(b["text"] for b in result["textBlocks"])
    assert "Ananya Sharma" in all_text


def test_analyse_reports_bounding_boxes_for_pdf_text():
    result = engine.analyse(_fixture_path("fixture-02-clean-fresher.pdf"), "application/pdf")

    assert len(result["textBlocks"]) >= 1
    boxes = [b["boundingBox"] for b in result["textBlocks"] if b["boundingBox"]]
    assert len(boxes) >= 1
    box = boxes[0]
    assert box["page"] == 1
    assert box["width"] > 0
    assert box["height"] > 0


def test_analyse_extracts_docx_text_without_page_or_bbox():
    result = engine.analyse(
        _fixture_path("fixture-03-docx-table.docx"),
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )

    assert len(result["textBlocks"]) >= 1
    all_text = " ".join(b["text"] for b in result["textBlocks"])
    assert "Rahul Verma" in all_text
    # DOCX has no fixed pagination -- every block anchors to the same
    # logical page (1), and bounding boxes are genuinely absent, not zeroed.
    assert all(b["page"] == 1 for b in result["textBlocks"])
    assert all(b["boundingBox"] is None for b in result["textBlocks"])


def test_analyse_does_not_reproduce_the_baseline_multicolumn_name_pollution_bug():
    # The Step 2 baseline (native pdf-parse extraction, no layout awareness)
    # produced fullName="Ben Okafor Experience" on this exact fixture --
    # a second column's section heading bleeding into the first column's
    # name line. Docling's layout-aware reading order must not reproduce
    # that specific failure, even if it doesn't perfectly separate every
    # line in this synthetic (not a real resume template) two-column layout.
    result = engine.analyse(_fixture_path("fixture-11-multicolumn.pdf"), "application/pdf")

    assert len(result["textBlocks"]) >= 1
    first_block_text = result["textBlocks"][0]["text"]
    assert "Experience" not in first_block_text, (
        "the first (name-containing) block must not have the second column's section heading bleed into it, "
        f"got: {first_block_text!r}"
    )
    assert "Ben Okafor" in first_block_text
