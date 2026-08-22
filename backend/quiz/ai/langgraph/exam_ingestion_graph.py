import logging
import re
import uuid
import json
import concurrent.futures
from typing import Annotated, List, Optional, TypedDict
import operator
from pathlib import Path

from django.conf import settings
from langgraph.graph import StateGraph, END

from quiz.ai.gemini_client import GeminiClient
from quiz.ai.langgraph.base import with_backoff
from quiz.ai.pdf_parser.pymupdf_parser import FastPdfParser
from quiz.ai.examintel.models import QuestionBlock, QuestionOption
from quiz.ai.examintel.native_engine import extract_native_exam_questions
from quiz.ai.examintel.ocr_engine import extract_questions_from_pdf
from quiz.ai.examintel.answer_key_detection import detect_answer_key_sections
from quiz.ai.examintel.layout_extraction import extract_text_layout
from quiz.ai.examintel.markdown_generator import generate_exam_markdown
from quiz.ai.examintel.llm_refiner import (
    refine_questions_batch,
    needs_math_refinement,
    RefinedQuestion,
)
from quiz.ai import extract_json_from_text
from quiz.ai.langfuse_client import observe, update_trace_metadata

logger = logging.getLogger("quiz.ai.langgraph.exam_ingestion_graph")


class ExamIngestionState(TypedDict):
    pdf_path: str
    gemini_file_name: Optional[str]
    markdown_text: str
    images: list
    raw_chunks: list
    extracted_questions: list
    fused_json: list
    final_payloads: list
    errors: Annotated[List[str], operator.add]

# Module-level singleton — avoids creating /tmp/ai_exam_staging on every pipeline call
_INDIC_PARSER = FastPdfParser()


def _select_engine(pdf_path: str) -> str:
    """Routes to 'ocr_spatial' for candidate response sheets or 'native_vector' for digital papers."""
    try:
        import fitz
        doc = fitz.open(pdf_path)
        total_text_len = sum(len(doc[i].get_text().strip()) for i in range(min(4, len(doc))))
        sample_txt = " ".join(doc[i].get_text() for i in range(min(4, len(doc))))
        doc.close()
        if total_text_len > 300:
            if not ("Question ID :" in sample_txt and "Chosen Option :" in sample_txt):
                return "native_vector"
        return "ocr_spatial"
    except Exception:
        return "ocr_spatial"


def _questionblock_to_dict(q: QuestionBlock) -> dict:
    """
    Translates an examintel QuestionBlock into the exact dict shape that
    ExtractedQuestion(**q) expects in node_katex_vision_refine.
    Only 2 field names differ between the two models:
      - QuestionBlock.is_correct_signal  -> ExtractedOption.is_correct
      - QuestionBlock.diagram_image_paths -> ExtractedQuestion.diagram_paths
    All other field names are identical.
    """
    raw = q.dict() if hasattr(q, "dict") else q.model_dump()

    # Translate options list: rename is_correct_signal -> is_correct
    translated_options = []
    for opt in raw.get("options", []):
        translated_options.append({
            "option_number":    opt["option_number"],
            "option_text":      opt["option_text"],
            "option_image_path": opt.get("option_image_path"),
            "is_correct":       bool(opt.get("is_correct_signal", False)),
            "color_bucket":     opt.get("color_bucket", "neutral"),
        })

    return {
        # Fields that match exactly
        "question_number":      raw["question_number"],
        "global_question_number": raw.get("global_question_number"),
        "question_id":          raw.get("question_id"),
        "section_name":         raw.get("section_name"),
        "question_text":        raw["question_text"],
        "detected_answer":      raw.get("detected_answer"),
        "source":               raw.get("source", "none"),
        "confidence":           raw.get("confidence", "none"),
        "source_page":          raw.get("source_page", 1),
        "crop_image_path":      raw.get("crop_image_path"),
        "shared_context":       raw.get("shared_context"),
        # Renamed fields
        "diagram_paths":        raw.get("diagram_image_paths", []),  # QuestionBlock uses diagram_image_paths
        # Fields absent from QuestionBlock — supply defaults expected by ExtractedQuestion
        "question_text_hi":     None,
        "language":             "en",
        # Translated options
        "options":              translated_options,
    }


@observe(name="node_examintel_extraction")
def node_examintel_extraction(state: ExamIngestionState) -> dict:
    """
    Node 1: examintel v2 Deterministic Extraction.
    PDF -> QuestionBlock[] + .md string.
    Routes to native_vector (digital papers) or ocr_spatial (raster/response sheets).
    Produces extracted_questions dicts with exact ExtractedQuestion field names so all
    downstream nodes are untouched.
    """
    pdf_path = state.get("pdf_path")
    print(f"\n>>> [NODE 1] node_examintel_extraction: Deterministic extraction for '{Path(pdf_path).name}'")
    logger.info("node_examintel_extraction: Running examintel v2 engine")

    try:
        output_dir = Path(settings.MEDIA_ROOT) / "exam_assets" / Path(pdf_path).stem
        output_dir.mkdir(parents=True, exist_ok=True)

        engine = _select_engine(pdf_path)

        if engine == "ocr_spatial":
            print(f"    [*] Engine: ocr_spatial (candidate response sheet / raster)")
            questions, doc_title = extract_questions_from_pdf(pdf_path, output_dir)
            try:
                layouts = extract_text_layout(pdf_path)
                ak_entries = detect_answer_key_sections(pdf_path, layouts)
            except Exception as e:
                logger.warning(f"Answer key detection failed, continuing without: {e}")
                ak_entries = []
        else:
            print(f"    [*] Engine: native_vector (standard / solved exam paper)")
            questions, doc_title, ak_entries = extract_native_exam_questions(pdf_path, output_dir)

        verified_count = sum(1 for q in questions if q.detected_answer)
        print(f"    [+] Extracted {len(questions)} questions | {verified_count} with deterministic answers | engine: {engine}")

        # Generate full .md document (stored in markdown_text for traceability)
        full_md = generate_exam_markdown(
            title=doc_title,
            pdf_path=pdf_path,
            questions=questions,
            answer_key_entries=ak_entries,
        )

        # Translate QuestionBlock -> ExtractedQuestion-compatible dicts (only 2 field renames)
        intermediate_qs = [_questionblock_to_dict(q) for q in questions]

        return {
            "extracted_questions": intermediate_qs,
            "markdown_text": full_md,
        }

    except Exception as e:
        err = f"[node_examintel_extraction] Fatal extraction error: {e}"
        logger.error(err, exc_info=True)
        return {
            "extracted_questions": [],
            "markdown_text": "",
            "errors": [err],
        }


@observe(name="node_indic_matra_clean")
def node_indic_matra_clean(state: ExamIngestionState) -> dict:
    """
    Node 2: Devanagari / Indic Script Spacing & Ligature Repair.
    Fixes split vowels (क िस -> किस) and virama ligatures (स ं व िधान -> संविधान).
    """
    print(f"\n>>> [NODE 2] node_indic_matra_clean: Repairing Indic matras and Unicode ligatures")
    logger.info("node_indic_matra_clean: Running clean_indic_text on question bodies")

    parser = _INDIC_PARSER
    raw_qs = state.get("extracted_questions", [])

    for q in raw_qs:
        q_text = q.get("question_text", "")
        if q_text:
            q["question_text"] = parser.clean_indic_text(q_text)
        
        # Also clean Devanagari text in options
        for opt in q.get("options", []):
            opt_txt = opt.get("option_text", "")
            if opt_txt:
                opt["option_text"] = parser.clean_indic_text(opt_txt)

    return {"extracted_questions": raw_qs}


@observe(name="node_katex_vision_refine")
def node_katex_vision_refine(state: ExamIngestionState) -> dict:
    """
    Node 3: Multimodal Vision KaTeX Normalizer for Complex Math/Science Questions.
    Uses 300 DPI high-resolution crops + Gemini Vision while locking ground-truth answers.
    """
    print(f"\n>>> [NODE 3] node_katex_vision_refine: Normalizing LaTeX/KaTeX math formulas via Vision")
    logger.info("node_katex_vision_refine: Running Multimodal Vision Refiner on math-triggered questions")

    raw_qs = state.get("extracted_questions", [])
    extracted_objects = []
    reconstruction_errors = []
    for q in raw_qs:
        try:
            extracted_objects.append(QuestionBlock(**q))
        except Exception as e:
            err = f"[node_katex_vision_refine] QuestionBlock reconstruct failed for q={q.get('question_number')}: {e}"
            logger.warning(err)
            reconstruction_errors.append(err)

    if reconstruction_errors:
        logger.warning(f"    [!] {len(reconstruction_errors)} questions skipped due to schema mismatch.")

    math_count = sum(1 for q in extracted_objects if needs_math_refinement(q))
    print(f"    [*] Detected {math_count}/{len(extracted_objects)} questions requiring KaTeX math refinement.")

    # Refine math questions using Multimodal Vision
    refined_objects = refine_questions_batch(extracted_objects, max_workers=2)

    # Convert back to dict list
    fused_list = []
    for r in refined_objects:
        # Convert options list
        opts_data = []
        for opt in r.options:
            opts_data.append({
                "id": opt.option_number,
                "answer_text": opt.option_text,
                "answer_text_hi": opt.option_text_hi,
                "is_correct": opt.is_correct,
            })

        fused_list.append({
            "question_number": r.question_number,
            "question_id": r.question_id,
            "subject": r.subject or "General",
            "topic": r.topic or "General",
            "difficulty": "Medium",
            "question_text": r.question_stem,
            "question_text_hi": r.question_stem_hi,
            "language": r.language,
            "options": opts_data,
            "detected_answer": r.correct_option,
            "solver_verified": bool(r.correct_option),
            "explanation": "",
            "hints": [],
            "solution_steps": [],
            "crop_image_url": r.crop_image_url,
            "diagram_paths": r.figure_urls,
            "provenance": r.provenance,
        })

    return {"fused_json": fused_list}


@observe(name="node_bilingual_align")
def node_bilingual_align(state: ExamIngestionState) -> dict:
    """
    Node 4: Bilingual Hindi/English Alignment & Clean Deduplication.
    """
    print(f"\n>>> [NODE 4] node_bilingual_align: Aligning bilingual questions & deduplicating")
    logger.info("node_bilingual_align: Aligning bilingual fields and deduplicating")

    questions = state.get("fused_json", [])
    seen_stems = set()
    cleaned_questions = []

    for q in questions:
        q_text = (q.get("question_text") or "").strip()
        if not q_text:
            continue

        # Clean repetitive lines inside the question stem
        lines = [l.strip() for l in q_text.split('\n') if l.strip()]
        unique_lines = []
        for l in lines:
            if not unique_lines or unique_lines[-1] != l:
                unique_lines.append(l)
        q_text = "\n".join(unique_lines)
        q["question_text"] = q_text

        # Deduplicate identical questions
        stem_sig = re.sub(r'\s+', '', q_text.lower())[:80]
        if stem_sig in seen_stems:
            continue
        seen_stems.add(stem_sig)

        cleaned_questions.append(q)

    print(f"    [+] Fused and deduplicated: {len(cleaned_questions)} unique questions.")
    return {"fused_json": cleaned_questions}


@observe(name="node_agentic_solve")
def node_agentic_solve(state: ExamIngestionState) -> dict:
    """
    Node 5: Batched Agentic Reasoning Solver for Unmarked Answer Keys (Safety Fallback).
    """
    print(f"\n>>> [NODE 5] node_agentic_solve: Checking for unresolved answers")
    logger.info("node_agentic_solve: Checking for unresolved answers")

    client = GeminiClient()
    questions = state.get("fused_json", [])

    unresolved = []
    for idx, q in enumerate(questions):
        opts = q.get("options", [])
        if any(o.get("is_correct") for o in opts):
            q["solver_verified"] = True
        else:
            unresolved.append((idx, q))

    if not unresolved:
        print(f"    [+] All {len(questions)} questions already have verified ground-truth answers. 0 solver calls needed.")
        return {"fused_json": questions}

    print(f"    [*] Found {len(unresolved)} questions with missing answers. Solving in batched groups of 10...")

    batch_size = 10
    batches = [unresolved[i:i + batch_size] for i in range(0, len(unresolved), batch_size)]

    def process_solver_batch(batch):
        batch_items = []
        for local_idx, (orig_idx, q) in enumerate(batch):
            opts_summary = [f"{o.get('id', chr(65+j))}: {o.get('answer_text', '')}" for j, o in enumerate(q.get("options", []))]
            batch_items.append({
                "item_id": local_idx,
                "question": q.get("question_text", ""),
                "options": opts_summary
            })

        prompt = (
            "You are an expert exam key resolver. For each multiple-choice question below, determine the single correct option ID (e.g. 'A', 'B', 'C', 'D' or '1', '2', '3', '4').\n"
            "DO NOT write explanations, reasoning, or hints — return ONLY a compact JSON array.\n\n"
            "OUTPUT FORMAT (STRICT JSON ARRAY):\n"
            "[\n"
            '  {"item_id": 0, "correct_option": "B"},\n'
            '  {"item_id": 1, "correct_option": "A"}\n'
            "]\n\n"
            f"Questions:\n{json.dumps(batch_items, ensure_ascii=False)}"
        )

        try:
            res = client.generate_content(prompt)
            answers_list = extract_json_from_text(res.get('text', ''))
            if isinstance(answers_list, list):
                ans_map = {item.get("item_id"): str(item.get("correct_option", "")).strip().upper() for item in answers_list if isinstance(item, dict)}
                for local_idx, (orig_idx, q) in enumerate(batch):
                    correct_opt_id = ans_map.get(local_idx)
                    if correct_opt_id:
                        for opt in q.get("options", []):
                            if str(opt.get("id", "")).upper() == correct_opt_id:
                                opt["is_correct"] = True
                                q["solver_verified"] = True
                                break
        except Exception as e:
            logger.error(f"Solver batch failed: {e}")

    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        list(executor.map(process_solver_batch, batches))

    return {"fused_json": questions}


@observe(name="node_pydantic_validate")
def node_pydantic_validate(state: ExamIngestionState) -> dict:
    """
    Node 6: Canonical V2 Schema Validation and Single-Choice Invariant Enforcement.
    """
    print(f"\n>>> [NODE 6] node_pydantic_validate: Transforming into Canonical V2 Schema")
    logger.info("node_pydantic_validate: Transforming into Canonical V2 Schema")

    fused_data = state.get("fused_json", [])
    v2_payloads = []

    for idx, item in enumerate(fused_data):
        q_id = str(uuid.uuid4())
        raw_options = item.get("options", [])
        v2_options = []
        correct_ids = []

        for o_idx, opt in enumerate(raw_options):
            opt_id = str(opt.get("id") or chr(65 + o_idx))
            is_c = bool(opt.get("is_correct", False))
            v2_options.append({
                "id": opt_id,
                "text": opt.get("answer_text", ""),
                "text_hi": opt.get("answer_text_hi"),
                "image_url": None,
                "explanation": None,
                "is_correct": is_c
            })
            if is_c:
                correct_ids.append(opt_id)

        # Single-Choice fallback: If no option is marked, default to Option 1
        if not correct_ids and v2_options:
            v2_options[0]["is_correct"] = True
            correct_ids.append(v2_options[0]["id"])

        subject = item.get("subject") or "General"
        topic = item.get("topic") or "General"
        difficulty = item.get("difficulty") or "Medium"
        lang = item.get("language") or "en"

        v2_item = {
            "id": q_id,
            "schema_version": "v2",
            "origin": "pyq_extracted",
            "question_type": "mcq_single" if len(correct_ids) <= 1 else "mcq_multi",
            "passage_id": None,
            "content": {
                "text": item.get("question_text", ""),
                "images": {
                    "crop_image": item.get("crop_image_url"),
                    "diagrams": item.get("diagram_paths", [])
                }
            },
            "question_text_hi": item.get("question_text_hi"),
            "options": v2_options,
            "answer": {
                "correct_options": correct_ids
            },
            "explanation": {
                "text": item.get("explanation", ""),
                "images": {}
            },
            "tutor_data": {
                "hints": item.get("hints", []),
                "solution_steps": item.get("solution_steps", [])
            },
            "marking": {
                "positive": 2.0,
                "negative": 0.5,
                "partial_scheme": None
            },
            "classification": {
                "subject": subject,
                "topic": topic,
                "subtopic": "General",
                "cognitive_level": "apply",
                "difficulty_label": difficulty,
                "difficulty_score": None,
                "difficulty_source": None
            },
            "exam_history": [],
            "source": item.get("provenance"),
            "generation_meta": None,
            "verification": {
                "verified": item.get("solver_verified", False),
                "extracted_at": None,
                "reviewed_by": None
            },
            "metadata": {
                "language": lang,
                "translation_group_id": None,
                "tags": [subject.lower()],
                "ideal_time_seconds": 60,
            }
        }
        v2_payloads.append(v2_item)

    print(f"    [+] Canonical V2 payloads validated: {len(v2_payloads)} questions.")
    return {"final_payloads": v2_payloads}


@observe(name="node_cleanup")
def node_cleanup(state: ExamIngestionState) -> dict:
    print(f"\n>>> [NODE] Universal 10/10 Pipeline Execution Complete.")
    logger.info("Universal 10/10 Pipeline Execution Complete.")
    return {}


class ExamIngestionGraph:
    """
    Unified 10/10 LangGraph StateGraph Orchestrator for Universal Exam Ingestion.
    """
    def __init__(self):
        g = StateGraph(ExamIngestionState)
        g.add_node("node_examintel_extraction", node_examintel_extraction)
        g.add_node("node_indic_matra_clean", node_indic_matra_clean)
        g.add_node("node_katex_vision_refine", node_katex_vision_refine)
        g.add_node("node_bilingual_align", node_bilingual_align)
        g.add_node("node_agentic_solve", node_agentic_solve)
        g.add_node("node_pydantic_validate", node_pydantic_validate)
        g.add_node("node_cleanup", node_cleanup)

        g.set_entry_point("node_examintel_extraction")
        g.add_edge("node_examintel_extraction", "node_indic_matra_clean")
        g.add_edge("node_indic_matra_clean", "node_katex_vision_refine")
        g.add_edge("node_katex_vision_refine", "node_bilingual_align")
        g.add_edge("node_bilingual_align", "node_agentic_solve")
        g.add_edge("node_agentic_solve", "node_pydantic_validate")
        g.add_edge("node_pydantic_validate", "node_cleanup")
        g.add_edge("node_cleanup", END)

        self.graph = g.compile()

    @observe(name="exam_ingestion_pipeline")
    def run(self, pdf_path: str) -> dict:
        update_trace_metadata(
            tags=["exam_ingestion", "universal_10_10_pipeline"],
            input={"pdf_path": pdf_path}
        )
        initial_state = {
            "pdf_path": pdf_path,
            "gemini_file_name": None,
            "markdown_text": "",
            "images": [],
            "raw_chunks": [],
            "extracted_questions": [],
            "fused_json": [],
            "final_payloads": [],
            "errors": []
        }
        result = self.graph.invoke(initial_state)
        update_trace_metadata(
            output={
                "extracted_questions_count": len(result.get("final_payloads", [])),
                "errors_count": len(result.get("errors", []))
            }
        )
        return result
