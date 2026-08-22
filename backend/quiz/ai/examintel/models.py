
from __future__ import annotations
from typing import Literal, Optional, Tuple, List
from pydantic import BaseModel, Field


class Span(BaseModel):
    text: str = Field(..., description="Raw text content of the span")
    bbox: Tuple[float, float, float, float] = Field(
        ..., description="Bounding box in PDF points: (x0, y0, x1, y1)"
    )
    page_number: int = Field(..., description="1-indexed page number where span appears")
    span_id: str = Field(
        ..., description="Stable deterministic ID, e.g. 'p1_b0_l0_s0'"
    )


class PageLayout(BaseModel):

    page_number: int = Field(..., description="1-indexed page number")
    spans: List[Span] = Field(default_factory=list, description="Ordered list of text spans")


ColorBucketType = Literal["green_family", "red_family", "neutral", "other"]


class StyledSpan(BaseModel):

    span_id: str = Field(..., description="Deterministic span ID joining back to Stage 1 Span")
    text: str = Field(..., description="Raw text content of the span")
    page_number: int = Field(..., description="1-indexed page number")
    bbox: Tuple[float, float, float, float] = Field(
        ..., description="Bounding box in PDF points: (x0, y0, x1, y1)"
    )
    rgb: Tuple[int, int, int] = Field(
        ..., description="RGB color tuple: (red, green, blue) in range 0-255"
    )
    color_bucket: ColorBucketType = Field(
        ..., description="HSV-classified color category: 'green_family', 'red_family', 'neutral', 'other'"
    )
    bold: bool = Field(..., description="True if font flags or font family indicate bold weight")
    italic: bool = Field(..., description="True if font flags or font family indicate italic posture")
    font_size: float = Field(..., description="Font size in PDF points")


class OcrBox(BaseModel):
    
    text: str = Field(default="", description="OCR transcribed text (if available)")
    bbox: Tuple[float, float, float, float] = Field(
        ..., description="Bounding box in PDF points: (x0, y0, x1, y1)"
    )
    page_number: int = Field(..., description="1-indexed page number")
    box_id: Optional[str] = Field(default=None, description="Optional identifier for the OCR box")


AnswerKeyConfidence = Literal["high", "medium"]


class AnswerKeyEntry(BaseModel):

    question_number: str = Field(..., description="Normalized question number (e.g. '1', '42')")
    answer_value: str = Field(
        ..., description="Option letter ('A', 'B', etc.) or numeric value for NAT-style questions"
    )
    source_page: int = Field(..., description="1-indexed page number where the answer key was found")
    confidence: AnswerKeyConfidence = Field(
        ..., description="'high' if matched clear header + table/pattern, 'medium' if matched via density heuristic"
    )


AnswerSignalSource = Literal[
    "both_agree",
    "inline_color_marker",
    "answer_key_section",
    "conflict",
    "none",
]

AnswerSignalConfidence = Literal["high", "medium", "low", "none"]


class AnswerSignal(BaseModel):

    question_number: str = Field(..., description="Normalized question identifier")
    detected_value: Optional[str] = Field(
        default=None,
        description="Detected answer option ('A', 'B', etc.) or None if conflicted/unresolved",
    )
    source: AnswerSignalSource = Field(
        ..., description="Provenance source of the detected answer signal"
    )
    confidence: AnswerSignalConfidence = Field(
        ..., description="Confidence level: 'high', 'medium', 'low', 'none'"
    )
    conflict: bool = Field(
        ..., description="True if inline marker and answer key disagree or signals contradict"
    )
    notes: Optional[str] = Field(
        default=None,
        description="Detailed provenance explanation, conflict details, or ambiguity reason",
    )


class QuestionOption(BaseModel):

    option_number: str = Field(..., description="Option label ('1', '2', '3', '4' or 'A', 'B', 'C', 'D')")
    option_text: str = Field(default="", description="Text body of the option")
    option_image_path: Optional[str] = Field(default=None, description="Relative path to embedded option image/diagram")
    color_bucket: ColorBucketType = Field(default="neutral", description="Color bucket detected for this option marker")
    is_correct_signal: bool = Field(default=False, description="True if highlighted in green or eliminated as correct")


class QuestionBlock(BaseModel):

    question_number: str = Field(..., description="Question number in section/paper (e.g. '1', '14')")
    global_question_number: Optional[int] = Field(default=None, description="Sequential 1..N index across the entire exam")
    question_id: Optional[str] = Field(default=None, description="Unique system Question ID if present (e.g. '26433067336')")
    section_name: Optional[str] = Field(default=None, description="Section / Subject name (e.g. 'General Intelligence and Reasoning')")
    shared_context: Optional[str] = Field(default=None, description="Shared reading comprehension passage or cloze test text")
    question_text: str = Field(..., description="Stem / body text of the question")
    options: List[QuestionOption] = Field(default_factory=list, description="List of MCQ options")
    diagram_image_paths: List[str] = Field(default_factory=list, description="Extracted diagram images for the question body")
    detected_answer: Optional[str] = Field(default=None, description="Ground truth answer value ('1', '2', 'A', 'B', etc.)")
    source: AnswerSignalSource = Field(default="none", description="Signal provenance source")
    confidence: AnswerSignalConfidence = Field(default="none", description="Confidence level")
    status: Optional[str] = Field(default=None, description="Candidate response status ('Answered', 'Not Answered')")
    chosen_option: Optional[str] = Field(default=None, description="Candidate chosen option if present")
    source_page: int = Field(default=1, description="1-indexed page number where question appears")
    crop_image_path: Optional[str] = Field(default=None, description="Relative path to max-resolution cropped image of the full question bounding box")
    raw_markdown: Optional[str] = Field(default=None, description="Formatted Markdown snippet for this question")
    raw_latex: Optional[str] = Field(default=None, description="Refined KaTeX/LaTeX formatted stem if processed")


class ExamDocument(BaseModel):

    title: str = Field(default="Exam Paper", description="Title of the examination paper")
    source_pdf: str = Field(..., description="Path to the original PDF file")
    total_pages: int = Field(..., description="Total page count")
    sections: List[str] = Field(default_factory=list, description="List of unique section names")
    questions: List[QuestionBlock] = Field(default_factory=list, description="Ordered list of extracted questions")
    answer_key_entries: List[AnswerKeyEntry] = Field(default_factory=list, description="Global answer key entries if detected")
    full_markdown: str = Field(default="", description="Complete rendered Markdown for the exam paper")
