from __future__ import annotations
import re
import json
import uuid
import logging
from pathlib import Path
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

from quiz.ai.examintel.markdown_exam_parser import ParsedQuestion
from quiz.ai.examintel.bilingual_agent import BilingualQuestionPayload
from quiz.ai.examintel.academic_tutor_agent import EnrichedAcademicData

logger = logging.getLogger("quiz.ai.examintel.canonical_v2_assembler")


class CanonicalV2ContentImages(BaseModel):
    url: str
    alt: str = "diagram"


class CanonicalV2Content(BaseModel):
    text: str
    images: Dict[str, CanonicalV2ContentImages] = Field(default_factory=dict)


class CanonicalV2Option(BaseModel):
    id: str
    text: Optional[str] = None
    answer_text_hi: Optional[str] = None
    image_url: Optional[str] = None


class CanonicalV2Answer(BaseModel):
    correct_options: List[str]


class CanonicalV2Explanation(BaseModel):
    text: str = ""
    images: Dict[str, Any] = Field(default_factory=dict)


class CanonicalV2TutorData(BaseModel):
    hints: List[str] = Field(default_factory=list)
    solution_steps: List[str] = Field(default_factory=list)


class CanonicalV2Marking(BaseModel):
    positive: float = 2.5
    negative: float = 0.0
    partial_scheme: Optional[Dict[str, Any]] = None


class CanonicalV2Classification(BaseModel):
    subject: str
    topic: str
    subtopic: str = "General"
    cognitive_level: str = "apply"
    difficulty_label: str = "Medium"
    difficulty_score: Optional[float] = 0.5
    difficulty_source: Optional[str] = "ai_assessed"


class CanonicalV2ExamHistory(BaseModel):
    exam: str
    year: Optional[int] = None
    shift: Optional[str] = None


class CanonicalV2Source(BaseModel):
    book: Optional[str] = None
    page: Optional[int] = None


class CanonicalV2Verification(BaseModel):
    verified: bool = True
    extracted_at: str
    reviewed_by: Optional[str] = None


class CanonicalV2Metadata(BaseModel):
    language: str  # "en" | "hi" | "bilingual"
    translation_group_id: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    ideal_time_seconds: int = 60
    crop_image: Optional[str] = None
    provenance: Optional[str] = None


class CanonicalV2Question(BaseModel):
    id: str
    schema_version: str = "v2"
    origin: str = "pyq_extracted"
    question_type: str = "mcq_single"
    passage_id: Optional[str] = None
    content: CanonicalV2Content
    question_text_hi: Optional[str] = None
    options: List[CanonicalV2Option]
    answer: CanonicalV2Answer
    explanation: CanonicalV2Explanation
    explanation_hi: Optional[str] = None
    tutor_data: CanonicalV2TutorData
    marking: CanonicalV2Marking
    classification: CanonicalV2Classification
    exam_history: List[CanonicalV2ExamHistory]
    source: CanonicalV2Source
    generation_meta: Optional[Dict[str, Any]] = None
    verification: CanonicalV2Verification
    metadata: CanonicalV2Metadata


class CanonicalV2Assembler:
    """
    Assembles, validates, and serializes parsed & enriched exam questions into
    the exact canonical schemamix.json v2 schema specification.
    """

    @classmethod
    def assemble_question(
        cls,
        parsed_q: ParsedQuestion,
        bilingual_data: BilingualQuestionPayload,
        academic_data: EnrichedAcademicData,
        exam_name: str,
        year: Optional[int] = None,
        shift: Optional[str] = None,
        positive_marks: float = 2.5,
        negative_marks: float = 0.0,
        exam_slug: Optional[str] = None,
    ) -> CanonicalV2Question:
        clean_slug = re.sub(r"[^a-zA-Z0-9_]", "_", (exam_slug or exam_name or "exam").lower()).strip("_")[:28]
        if parsed_q.question_id and len(str(parsed_q.question_id)) > 6:
            q_id = f"q_{parsed_q.question_id}"
        else:
            q_id = f"q_{clean_slug}_{parsed_q.global_question_number:04d}"

        # 1. Format content images (deduplicated)
        content_images: Dict[str, CanonicalV2ContentImages] = {}
        seen_fig_urls = set()
        img_idx = 1
        for fig_url in parsed_q.figure_paths:
            if fig_url and fig_url not in seen_fig_urls:
                seen_fig_urls.add(fig_url)
                key = f"IMAGE_{img_idx}"
                content_images[key] = CanonicalV2ContentImages(url=fig_url, alt=f"Figure {img_idx}")
                img_idx += 1

        # 2. Format options
        v2_options: List[CanonicalV2Option] = []
        correct_ids: List[str] = []

        for opt in bilingual_data.options:
            opt_id = opt.option_number
            opt_text_en = opt.text_en or None
            opt_text_hi = opt.text_hi or None
            # Defensive HTML comment stripping
            if opt_text_en:
                opt_text_en = re.sub(r"<!--.*?-->", "", opt_text_en).strip() or None
            if opt_text_hi:
                opt_text_hi = re.sub(r"<!--.*?-->", "", opt_text_hi).strip() or None

            # If option has an image and text is merely a label placeholder like 'छवि (A)' or 'Figure A', clear it
            if opt.image_url:
                if opt_text_en and re.match(r"^\s*(?:छवि|आकृति|चित्र|चित्र\s*संख्या|Figure|Fig\.?|Image|Option|विकल्प)?\s*[\(\[]?\s*[A-Da-d1-4]\s*[\)\]]?\s*$", opt_text_en, re.IGNORECASE):
                    opt_text_en = None
                if opt_text_hi and re.match(r"^\s*(?:छवि|आकृति|चित्र|चित्र\s*संख्या|Figure|Fig\.?|Image|Option|विकल्प)?\s*[\(\[]?\s*[A-Da-d1-4]\s*[\)\]]?\s*$", opt_text_hi, re.IGNORECASE):
                    opt_text_hi = None

            v2_options.append(
                CanonicalV2Option(
                    id=opt_id,
                    text=opt_text_en,
                    answer_text_hi=opt_text_hi,
                    image_url=opt.image_url or None,
                )
            )
            if opt.is_correct:
                correct_ids.append(opt_id)

        # Fallback if no correct option marked
        if not correct_ids and parsed_q.correct_option:
            correct_ids.append(parsed_q.correct_option)
        elif not correct_ids and v2_options:
            correct_ids.append(v2_options[0].id)

        q_type = "mcq_single" if len(correct_ids) <= 1 else "mcq_multi"

        now_iso = datetime.now(timezone.utc).isoformat()
        stem_en = re.sub(r"<!--.*?-->", "", bilingual_data.stem_en or "").strip()
        stem_hi = re.sub(r"<!--.*?-->", "", bilingual_data.stem_hi or "").strip() if bilingual_data.stem_hi else None

        return CanonicalV2Question(
            id=q_id,
            schema_version="v2",
            origin="pyq_extracted",
            question_type=q_type,
            passage_id=None,
            content=CanonicalV2Content(
                text=stem_en,
                images=content_images,
            ),
            question_text_hi=stem_hi,
            options=v2_options,
            answer=CanonicalV2Answer(correct_options=correct_ids),
            explanation=CanonicalV2Explanation(text=academic_data.explanation_en, images={}),
            explanation_hi=academic_data.explanation_hi,
            tutor_data=CanonicalV2TutorData(
                hints=academic_data.hints,
                solution_steps=academic_data.solution_steps,
            ),
            marking=CanonicalV2Marking(
                positive=positive_marks,
                negative=negative_marks,
                partial_scheme=None,
            ),
            classification=CanonicalV2Classification(
                subject=academic_data.subject,
                topic=academic_data.topic,
                subtopic=academic_data.subtopic,
                cognitive_level=academic_data.cognitive_level,
                difficulty_label=academic_data.difficulty_label,
                difficulty_score=academic_data.difficulty_score,
                difficulty_source="ai_assessed",
            ),
            exam_history=[
                CanonicalV2ExamHistory(exam=exam_name, year=year, shift=shift)
            ],
            source=CanonicalV2Source(
                book=f"{exam_name} Official Paper",
                page=parsed_q.global_question_number,
            ),
            generation_meta=None,
            verification=CanonicalV2Verification(
                verified=True,
                extracted_at=now_iso,
                reviewed_by=None,
            ),
            metadata=CanonicalV2Metadata(
                language=bilingual_data.language,
                translation_group_id=f"tg_{uuid.uuid4().hex[:8]}",
                tags=academic_data.tags,
                ideal_time_seconds=academic_data.ideal_time_seconds,
                crop_image=parsed_q.crop_image_path,
                provenance=parsed_q.provenance,
            ),
        )

    @classmethod
    def assemble_exam_package(
        cls,
        questions: List[CanonicalV2Question],
        output_file: Optional[str | Path] = None,
    ) -> List[Dict[str, Any]]:
        payload_list = [q.model_dump() if hasattr(q, "model_dump") else q.dict() for q in questions]
        if output_file:
            out_path = Path(output_file)
            out_path.parent.mkdir(parents=True, exist_ok=True)
            with open(out_path, "w", encoding="utf-8") as f:
                json.dump(payload_list, f, ensure_ascii=False, indent=2)
            logger.info(f"Saved canonical v2 package ({len(questions)} questions) to {out_path}")
        return payload_list
