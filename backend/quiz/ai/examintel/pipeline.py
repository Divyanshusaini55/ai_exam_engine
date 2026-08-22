from typing import List, Dict, Optional, Set
import re
from pydantic import BaseModel, Field

from quiz.ai.examintel.models import (
    PageLayout,
    StyledSpan,
    OcrBox,
    AnswerKeyEntry,
    AnswerSignal,
)
from quiz.ai.examintel.layout_extraction import extract_text_layout
from quiz.ai.examintel.style_extraction import (
    extract_style_signals,
    extract_style_signals_from_raster,
)
from quiz.ai.examintel.answer_key_detection import detect_answer_key_sections
from quiz.ai.examintel.fusion import fuse_answer_signals


class ExtractionResult(BaseModel):
    page_layouts: List[PageLayout] = Field(
        ..., description="Stage 1: Page-level structured text layouts"
    )
    styled_spans: List[StyledSpan] = Field(
        ..., description="Stage 2: Styled & color-classified spans"
    )
    answer_key_entries: List[AnswerKeyEntry] = Field(
        ..., description="Stage 3: Extracted answer-key table entries"
    )
    answer_signals: Dict[str, AnswerSignal] = Field(
        ..., description="Fused deterministic answer signal per question number"
    )


def _segment_questions_and_options(
    styled_spans: List[StyledSpan],
) -> Dict[str, List[StyledSpan]]:
    questions: Dict[str, List[StyledSpan]] = {}
    current_q: Optional[str] = None
    in_options_mode = False

    for span in styled_spans:
        text = span.text.strip()
        if not text:
            continue

        # Check for Question number start: e.g. "Q1.", "Q.1", "1.", "Question 1:"
        q_match = re.match(
            r"^(?:Q(?:uestion)?\.?\s*(\d{1,4})[\.\:\-\)\s]|(\d{1,4})\.\s+[A-Z])",
            text,
            re.IGNORECASE,
        )
        if q_match:
            q_num = q_match.group(1) or q_match.group(2)
            current_q = str(int(q_num))
            questions.setdefault(current_q, [])
            in_options_mode = True
            # If the span also contains an option, add it
            if re.search(r"\([A-Ea-e1-5]\)", text):
                questions[current_q].append(span)
            continue

        # Check if span looks like an option: "(A)", "A.", "[A]"
        opt_match = re.match(r"^\(?([A-Ea-e1-5])[\.\)\:\-\]]", text)
        if opt_match and current_q is not None:
            in_options_mode = True
            questions[current_q].append(span)
        elif in_options_mode and current_q is not None:
            # Continuation span within options
            questions[current_q].append(span)

    return questions


def run_deterministic_extraction(
    pdf_path: str,
    ocr_boxes: Optional[List[OcrBox]] = None,
    question_option_spans_by_q: Optional[Dict[str, List[StyledSpan]]] = None,
) -> ExtractionResult:

    # Stage 1: Layout Extraction
    layouts = extract_text_layout(pdf_path)

    # Stage 2: Style & Color Extraction
    total_text_spans = sum(len(pl.spans) for pl in layouts)
    if total_text_spans > 0:
        styled_spans = extract_style_signals(pdf_path)
    elif ocr_boxes:
        # Stage 2b fallback for scanned pages with no native text layer
        styled_spans = extract_style_signals_from_raster(pdf_path, ocr_boxes)
    else:
        styled_spans = []

    # Stage 3: Answer Key Detection
    answer_key_entries = detect_answer_key_sections(pdf_path, layouts)

    # Prepare question option spans
    if question_option_spans_by_q is None:
        q_spans_map = _segment_questions_and_options(styled_spans)
    else:
        q_spans_map = question_option_spans_by_q

    # Collect all question numbers to process (from segmented spans and answer key)
    all_q_numbers: Set[str] = set(q_spans_map.keys())
    for ak in answer_key_entries:
        all_q_numbers.add(ak.question_number)

    # Fusion Step: Compute AnswerSignal per question
    fused_signals: Dict[str, AnswerSignal] = {}

    for q_num in sorted(all_q_numbers, key=lambda x: int(x) if x.isdigit() else 9999):
        opt_spans = q_spans_map.get(q_num, [])
        signal = fuse_answer_signals(
            question_number=q_num,
            question_option_spans=opt_spans,
            answer_key_entries=answer_key_entries,
        )
        fused_signals[q_num] = signal

    # TODO: wire into main pipeline after Stage 3
    # At this integration point, each question's AnswerSignal is attached to the
    # question chunk payload before passing to the downstream LLM structuring stage.
    # The LLM receives the deterministic ground truth (source, detected_value, confidence, conflict)
    # and only confirms/transcribes rather than deriving the answer from scratch.

    return ExtractionResult(
        page_layouts=layouts,
        styled_spans=styled_spans,
        answer_key_entries=answer_key_entries,
        answer_signals=fused_signals,
    )
