"""Step 6: pure-function unit tests for the OCR decision policies
(orientation, reading order, quality, reconciliation) and the PaddleOCR
result-parsing helpers. None of these need the real paddleocr/paddlepaddle
package installed -- they operate on plain dicts, exactly the shape the
real engine is expected to produce/consume (see the verification-status
note in app/engines/paddleocr_engine.py for what IS NOT covered by these
tests: the real PaddleOCR.predict() call itself).
"""
from __future__ import annotations

import pytest

from app.engines.paddleocr_engine import OcrResultParseError, PaddleOCREngine, _parse_ocr_result, _parse_orientation_result
from app.ocr import orientation as orientation_policy
from app.ocr import quality_policy, reconciliation
from app.ocr.reading_order import deduplicate_overlapping_lines, reconstruct_reading_order

# --- orientation.decide_orientation --------------------------------------


def test_orientation_confident_result_is_applied():
    decision = orientation_policy.decide_orientation({"degrees": 90, "confidence": 0.95}, confidence_threshold=0.85)
    assert decision.detected_degrees == 90
    assert decision.correction_degrees == 270
    assert decision.applied_degrees == 270
    assert decision.uncertain is False
    assert decision.correction_source == "careeriz_manual_postprocess"


def test_orientation_low_confidence_is_not_applied_but_reported():
    decision = orientation_policy.decide_orientation({"degrees": 180, "confidence": 0.4}, confidence_threshold=0.85)
    assert decision.detected_degrees == 180
    assert decision.correction_degrees == 180
    assert decision.applied_degrees == 0, "an untrusted rotation must never be applied"
    assert decision.uncertain is True


def test_orientation_missing_result_is_uncertain_never_fabricated():
    decision = orientation_policy.decide_orientation(None, confidence_threshold=0.85)
    assert decision.detected_degrees == 0
    assert decision.correction_degrees == 0
    assert decision.applied_degrees == 0
    assert decision.classifier_confidence is None
    assert decision.uncertain is True


def test_orientation_invalid_degrees_value_is_uncertain():
    decision = orientation_policy.decide_orientation({"degrees": 45, "confidence": 0.99}, confidence_threshold=0.85)
    assert decision.uncertain is True
    assert decision.applied_degrees == 0


def test_orientation_zero_degrees_confident_applies_cleanly():
    decision = orientation_policy.decide_orientation({"degrees": 0, "confidence": 0.99}, confidence_threshold=0.85)
    assert decision.correction_degrees == 0
    assert decision.applied_degrees == 0
    assert decision.uncertain is False


def test_orientation_internal_paddle_correction_is_recorded_even_without_exposed_confidence():
    decision = orientation_policy.decide_orientation(
        {"degrees": 90, "confidence": None, "internallyCorrected": True},
        confidence_threshold=0.85,
    )
    assert decision.detected_degrees == 90
    assert decision.correction_degrees == 270
    assert decision.applied_degrees == 270
    assert decision.classifier_confidence is None
    assert decision.uncertain is True
    assert decision.correction_source == "paddle_internal_doc_preprocessor"


def test_rotate_degrees_cv_rejects_unsupported_value():
    import numpy as np

    image = np.zeros((10, 10, 3), dtype="uint8")
    with pytest.raises(ValueError):
        orientation_policy.rotate_degrees_cv(image, 45)


def test_rotate_degrees_cv_swaps_dimensions_for_90():
    import numpy as np

    image = np.zeros((20, 40, 3), dtype="uint8")  # height=20, width=40
    rotated = orientation_policy.rotate_degrees_cv(image, 90)
    assert rotated.shape[0] == 40
    assert rotated.shape[1] == 20


# --- reading_order --------------------------------------------------------


def _line(x0, y0, x1, y1, confidence=0.9, text="x"):
    return {"box": [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], "confidence": confidence, "text": text}


def test_reading_order_single_column_top_to_bottom():
    lines = [_line(0, 100, 50, 120, text="second"), _line(0, 0, 50, 20, text="first")]
    ordered = reconstruct_reading_order(lines)
    assert [line["text"] for line in ordered] == ["first", "second"]
    assert [line["readingOrder"] for line in ordered] == [0, 1]


def test_reading_order_detects_two_column_layout():
    # Left column: two lines, x in [0, 50]. Right column: two lines, x in
    # [300, 350]. A resume-shaped page, 400 wide.
    lines = [
        _line(0, 0, 50, 20, text="left-1"),
        _line(0, 100, 50, 120, text="left-2"),
        _line(300, 0, 350, 20, text="right-1"),
        _line(300, 100, 350, 120, text="right-2"),
    ]
    ordered = reconstruct_reading_order(lines)
    texts = [line["text"] for line in ordered]
    # Left column fully before right column.
    assert texts.index("left-2") < texts.index("right-1")
    assert texts == ["left-1", "left-2", "right-1", "right-2"]


def test_reading_order_single_column_not_misdetected_as_two_column():
    lines = [_line(0, 0, 200, 20, text="a"), _line(10, 30, 210, 50, text="b"), _line(5, 60, 205, 80, text="c")]
    ordered = reconstruct_reading_order(lines)
    assert [line["text"] for line in ordered] == ["a", "b", "c"]


def test_reading_order_empty_input():
    assert reconstruct_reading_order([]) == []


def test_deduplicate_overlapping_lines_keeps_higher_confidence():
    lines = [_line(0, 0, 100, 20, confidence=0.5, text="low"), _line(2, 1, 98, 19, confidence=0.9, text="high")]
    kept = deduplicate_overlapping_lines(lines)
    assert len(kept) == 1
    assert kept[0]["text"] == "high"


def test_deduplicate_overlapping_lines_keeps_distinct_lines():
    lines = [_line(0, 0, 50, 20, text="a"), _line(200, 200, 250, 220, text="b")]
    kept = deduplicate_overlapping_lines(lines)
    assert len(kept) == 2


# --- quality_policy ---------------------------------------------------------


def test_mean_confidence_averages_present_scores():
    blocks = [{"confidence": 0.8}, {"confidence": 0.6}]
    assert quality_policy.mean_confidence(blocks) == pytest.approx(0.7)


def test_mean_confidence_none_when_no_scores():
    assert quality_policy.mean_confidence([]) is None


def test_is_empty_output_true_for_blank_text():
    assert quality_policy.is_empty_output([{"text": "   "}]) is True
    assert quality_policy.is_empty_output([]) is True


def test_is_empty_output_false_when_real_text_present():
    assert quality_policy.is_empty_output([{"text": "hello"}]) is False


def test_is_low_confidence_page():
    assert quality_policy.is_low_confidence_page(None, 0.5) is True
    assert quality_policy.is_low_confidence_page(0.3, 0.5) is True
    assert quality_policy.is_low_confidence_page(0.6, 0.5) is False


# --- reconciliation ---------------------------------------------------------


def test_reconcile_no_ocr_attempted():
    result = reconciliation.reconcile_page(
        page=1, native_char_count=500, native_text_present=True, ocr_text_blocks=[], ocr_min_confidence=0.5,
    )
    assert result["decision"] == "OCR_NOT_ATTEMPTED"


def test_reconcile_substantial_native_text_is_retained_even_if_ocr_ran():
    ocr_blocks = [{"text": "x" * 1000, "confidence": 0.99}]
    result = reconciliation.reconcile_page(
        page=1, native_char_count=500, native_text_present=True, ocr_text_blocks=ocr_blocks, ocr_min_confidence=0.5,
    )
    assert result["decision"] == "NATIVE_RETAINED", "good native text must never be swapped out just because OCR ran"


def test_reconcile_ocr_used_when_it_clears_confidence_and_margin():
    ocr_blocks = [{"text": "x" * 100, "confidence": 0.9}]
    result = reconciliation.reconcile_page(
        page=1, native_char_count=20, native_text_present=True, ocr_text_blocks=ocr_blocks, ocr_min_confidence=0.5,
    )
    assert result["decision"] == "OCR_USED"


def test_reconcile_marginal_ocr_gain_does_not_override_native():
    # OCR found only slightly more text than native -- not a real margin
    # (must clear _MEANINGFUL_CONTENT_MARGIN = 1.5x).
    ocr_blocks = [{"text": "x" * 25, "confidence": 0.9}]
    result = reconciliation.reconcile_page(
        page=1, native_char_count=20, native_text_present=True, ocr_text_blocks=ocr_blocks, ocr_min_confidence=0.5,
    )
    assert result["decision"] == "BOTH_RETAINED_LOW_CONFIDENCE"


def test_reconcile_both_low_confidence_flags_for_review_never_picks_one():
    ocr_blocks = [{"text": "x" * 5, "confidence": 0.2}]
    result = reconciliation.reconcile_page(
        page=1, native_char_count=3, native_text_present=True, ocr_text_blocks=ocr_blocks, ocr_min_confidence=0.5,
    )
    assert result["decision"] == "BOTH_RETAINED_LOW_CONFIDENCE"


def test_reconcile_no_native_text_ocr_used_if_confident():
    ocr_blocks = [{"text": "x" * 50, "confidence": 0.9}]
    result = reconciliation.reconcile_page(
        page=1, native_char_count=0, native_text_present=False, ocr_text_blocks=ocr_blocks, ocr_min_confidence=0.5,
    )
    assert result["decision"] == "OCR_USED"
    assert result["nativeCharCount"] is None


def test_reconcile_no_native_text_low_confidence_ocr_flags_review():
    ocr_blocks = [{"text": "x" * 50, "confidence": 0.1}]
    result = reconciliation.reconcile_page(
        page=1, native_char_count=0, native_text_present=False, ocr_text_blocks=ocr_blocks, ocr_min_confidence=0.5,
    )
    assert result["decision"] == "OCR_LOW_CONFIDENCE_REVIEW_REQUIRED"


# --- PaddleOCREngine result-parsing helpers (defensive, dict-shaped) -------


def test_parse_ocr_result_extracts_lines():
    raw = {
        "rec_texts": ["hello", "world"],
        "rec_scores": [0.9, 0.8],
        "rec_polys": [[[0, 0], [10, 0], [10, 5], [0, 5]], [[0, 10], [10, 10], [10, 15], [0, 15]]],
    }
    lines = _parse_ocr_result(raw)
    assert [line["text"] for line in lines] == ["hello", "world"]
    assert lines[0]["confidence"] == pytest.approx(0.9)
    assert lines[0]["box"] == [[0.0, 0.0], [10.0, 0.0], [10.0, 5.0], [0.0, 5.0]]


def test_parse_ocr_result_falls_back_to_dt_polys():
    raw = {"rec_texts": ["a"], "rec_scores": [0.5], "dt_polys": [[[0, 0], [1, 0], [1, 1], [0, 1]]]}
    lines = _parse_ocr_result(raw)
    assert len(lines) == 1


def test_parse_ocr_result_raises_on_missing_keys_rather_than_guessing():
    with pytest.raises(OcrResultParseError):
        _parse_ocr_result({"unexpected_shape": True})


def test_parse_ocr_result_raises_on_mismatched_lengths():
    with pytest.raises(OcrResultParseError):
        _parse_ocr_result({"rec_texts": ["a", "b"], "rec_scores": [0.5], "rec_polys": [[[0, 0], [1, 0], [1, 1], [0, 1]]]})


def test_parse_orientation_result_extracts_angle_and_confidence():
    raw = {"doc_preprocessor_res": {"angle": 90, "score": 0.92}}
    result = _parse_orientation_result(raw)
    assert result == {
        "degrees": 90,
        "confidence": pytest.approx(0.92),
        "correctionDegrees": 270,
        "internallyCorrected": False,
    }


def test_parse_orientation_result_detects_internal_correction_from_output_image():
    raw = {"doc_preprocessor_res": {"angle": 270, "output_img": [[1]]}}
    result = _parse_orientation_result(raw)
    assert result == {
        "degrees": 270,
        "confidence": None,
        "correctionDegrees": 90,
        "internallyCorrected": True,
    }


def test_parse_orientation_result_none_when_submodule_absent():
    assert _parse_orientation_result({}) is None


def test_parse_orientation_result_none_when_angle_missing():
    assert _parse_orientation_result({"doc_preprocessor_res": {"score": 0.9}}) is None


def test_ocr_pdf_preserves_successful_pages_when_a_later_page_fails(monkeypatch, tmp_path):
    engine = object.__new__(PaddleOCREngine)
    pdf_path = str(tmp_path / "fixture.pdf")
    job_temp_dir = str(tmp_path / "job-temp")

    monkeypatch.setattr("app.engines.paddleocr_engine.validate_pdf_for_preprocessing", lambda path: None)
    monkeypatch.setattr(
        "app.engines.paddleocr_engine.pdf_routing.assess_pdf_pages",
        lambda *args, **kwargs: [
            {"pageNumber": 1, "plannedRoute": "RENDER_FOR_OCR"},
            {"pageNumber": 2, "plannedRoute": "RENDER_FOR_OCR"},
        ],
    )
    monkeypatch.setattr(
        "app.engines.paddleocr_engine.pdf_routing.render_pdf_page_to_bgr",
        lambda *args, **kwargs: "image-bgr",
    )
    monkeypatch.setattr(
        engine,
        "_preprocessed_array",
        lambda image_bgr, **kwargs: ("cleaned", {"pageNumber": kwargs["page_number"]}),
    )

    def build_page_result(**kwargs):
        if kwargs["page_number"] == 2:
            raise RuntimeError("simulated page failure")
        return {
            "pageNumber": kwargs["page_number"],
            "sourceType": "PDF_RENDERED",
            "extractionRoute": kwargs["extraction_route"],
            "textBlocks": [{"text": "ok"}],
            "orientation": None,
            "meanConfidence": 0.99,
            "lowConfidence": False,
            "emptyOutput": False,
            "warnings": [],
            "processingDurationMs": 1,
        }

    monkeypatch.setattr(engine, "_build_page_result", build_page_result)

    pages = engine._ocr_pdf(pdf_path, job_temp_dir)

    assert [page["pageNumber"] for page in pages] == [1, 2]
    assert pages[0]["textBlocks"] == [{"text": "ok"}]
    assert pages[0]["emptyOutput"] is False
    assert pages[1]["textBlocks"] == []
    assert pages[1]["emptyOutput"] is True
    assert any("page 2" in warning for warning in pages[1]["warnings"])


def test_ocr_pdf_raises_when_no_usable_page_remains(monkeypatch, tmp_path):
    engine = object.__new__(PaddleOCREngine)
    pdf_path = str(tmp_path / "fixture.pdf")
    job_temp_dir = str(tmp_path / "job-temp")

    monkeypatch.setattr("app.engines.paddleocr_engine.validate_pdf_for_preprocessing", lambda path: None)
    monkeypatch.setattr(
        "app.engines.paddleocr_engine.pdf_routing.assess_pdf_pages",
        lambda *args, **kwargs: [{"pageNumber": 1, "plannedRoute": "RENDER_FOR_OCR"}],
    )
    monkeypatch.setattr(
        "app.engines.paddleocr_engine.pdf_routing.render_pdf_page_to_bgr",
        lambda *args, **kwargs: "image-bgr",
    )
    monkeypatch.setattr(
        engine,
        "_preprocessed_array",
        lambda image_bgr, **kwargs: ("cleaned", {"pageNumber": kwargs["page_number"]}),
    )
    monkeypatch.setattr(
        engine,
        "_build_page_result",
        lambda **kwargs: (_ for _ in ()).throw(RuntimeError("simulated page failure")),
    )

    with pytest.raises(RuntimeError, match="simulated page failure"):
        engine._ocr_pdf(pdf_path, job_temp_dir)
