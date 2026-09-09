import logging
import re
import uuid
import json
import concurrent.futures
from typing import Annotated, List, Optional, TypedDict, Dict, Any
import operator
from pathlib import Path

from django.conf import settings
from langgraph.graph import StateGraph, END

from quiz.ai.gemini_client import GeminiClient
from quiz.ai.langgraph.base import with_backoff
from quiz.ai.pdf_parser.pymupdf_parser import FastPdfParser
from quiz.ai.examintel.models import QuestionBlock, QuestionOption
from quiz.ai.examintel.native_engine import extract_native_exam_questions
from quiz.ai.examintel.candidate_sheet_engine import (
    extract_candidate_response_questions,
    is_candidate_response_sheet,
)
from quiz.ai.examintel.tcs_cbt_engine import (
    extract_tcs_cbt_questions,
    is_tcs_cbt_paper,
    detect_exam_marking_scheme,
)
from quiz.ai.examintel.ocr_engine import extract_questions_from_pdf
from quiz.ai.examintel.answer_key_detection import detect_answer_key_sections
from quiz.ai.examintel.layout_extraction import extract_text_layout
from quiz.ai.examintel.markdown_generator import generate_exam_markdown
from quiz.ai.examintel.llm_refiner import (
    refine_questions_batch,
    needs_math_refinement,
    RefinedQuestion,
)
from quiz.ai.examintel.audit import (
    StageReport,
    get_pipeline_stages_dir,
    save_stage_artifact,
    audit_stage1_layout,
    audit_stage2_markdown,
    audit_stage3_chunks,
    audit_stage4_indic,
    audit_stage5_katex,
    audit_stage6_bilingual,
    audit_stage7_solved,
    audit_stage8_canonical_v2,
    generate_pipeline_audit_report,
)
from quiz.ai.examintel.pipeline_monitor import (
    PipelineStage,
    set_pipeline_stage,
    is_pipeline_aborted,
)
from quiz.ai import extract_json_from_text
from quiz.ai.langfuse_client import observe, update_trace_metadata

logger = logging.getLogger("quiz.ai.langgraph.exam_ingestion_graph")


class ExamIngestionState(TypedDict):
    pdf_path: str
    pipeline_run_id: Optional[str]
    stages_dir: Optional[str]
    gemini_file_name: Optional[str]
    markdown_text: str
    images: list
    raw_chunks: list
    extracted_questions: list
    fused_json: list
    final_payloads: list
    stage_reports: list
    errors: Annotated[List[str], operator.add]


# Module-level singleton for fast regex/matra operations
_INDIC_PARSER = FastPdfParser()


def _select_engine(pdf_path: str) -> str:
    """Routes to 'tcs_cbt', 'candidate_sheet', 'native_vector', or 'ocr_spatial'."""
    try:
        if is_tcs_cbt_paper(pdf_path):
            return "tcs_cbt"
        if is_candidate_response_sheet(pdf_path):
            return "candidate_sheet"

        import fitz
        doc = fitz.open(pdf_path)
        total_text_len = sum(len(doc[i].get_text().strip()) for i in range(min(5, len(doc))))
        doc.close()
        if total_text_len > 150:
            return "native_vector"
        return "ocr_spatial"
    except Exception:
        return "ocr_spatial"


def _questionblock_to_dict(q: QuestionBlock) -> dict:
    raw = q.dict() if hasattr(q, "dict") else q.model_dump()

    translated_options = []
    for opt in raw.get("options", []):
        translated_options.append({
            "option_number": opt["option_number"],
            "option_text": opt["option_text"],
            "option_image_path": opt.get("option_image_path"),
            "is_correct": bool(opt.get("is_correct_signal", False)),
            "color_bucket": opt.get("color_bucket", "neutral"),
        })

    return {
        "question_number": raw["question_number"],
        "global_question_number": raw.get("global_question_number"),
        "question_id": raw.get("question_id"),
        "section_name": raw.get("section_name"),
        "question_text": raw["question_text"],
        "detected_answer": raw.get("detected_answer"),
        "source": raw.get("source", "none"),
        "confidence": raw.get("confidence", "none"),
        "source_page": raw.get("source_page", 1),
        "crop_image_path": raw.get("crop_image_path"),
        "shared_context": raw.get("shared_context"),
        "diagram_paths": raw.get("diagram_image_paths", []),
        "question_text_hi": None,
        "language": "en",
        "options": translated_options,
    }


@observe(name="node_examintel_extraction")
def node_examintel_extraction(state: ExamIngestionState) -> dict:
    """
    Node 1 & 2: examintel v2 Deterministic Extraction & Markdown Generation.
    Saves:
      - stage1_layout_extraction.json
      - stage2_raw_exam.md
      - stage3_question_chunks.json
    """
    run_id = state.get("pipeline_run_id")
    if is_pipeline_aborted(run_id) or state.get("errors"):
        if is_pipeline_aborted(run_id):
            set_pipeline_stage(run_id, PipelineStage.ABORTED, error="Pipeline manually aborted.")
            return {"errors": ["Pipeline manually aborted."]}
        return {}

    pdf_path = state.get("pdf_path")
    stages_dir = Path(state.get("stages_dir") or get_pipeline_stages_dir(pdf_path, getattr(settings, "MEDIA_ROOT", None)))
    reports = list(state.get("stage_reports", []))

    print(f"\n=======================================================")
    print(f">>> [STAGE 1 & 2] Extraction & Markdown Generation for '{Path(pdf_path).name}'")
    print(f"    [*] Local Artifacts Directory: {stages_dir}")
    print(f"=======================================================")

    try:
        output_dir = stages_dir.parent
        engine = _select_engine(pdf_path)

        # Stage 1: Layout & Text Extraction
        set_pipeline_stage(
            run_id,
            PipelineStage.LAYOUT_EXTRACTION,
            progress=0.10,
            details={"pdf": Path(pdf_path).name, "engine": engine}
        )

        sr1 = StageReport(1, "Layout & Text Extraction")
        layouts = extract_text_layout(pdf_path)
        spans_count = sum(len(pl.spans) for pl in layouts)
        audit_stage1_layout(layouts, spans_count, sr1)
        sr1.artifact_path = save_stage_artifact(stages_dir, "stage1_layout_extraction.json", [l.model_dump() if hasattr(l, "model_dump") else l.dict() for l in layouts])
        sr1.complete()
        reports.append(sr1)
        print(f"    [+] Saved Stage 1: {sr1.artifact_path}")

        if is_pipeline_aborted(run_id):
            set_pipeline_stage(run_id, PipelineStage.ABORTED, error="Pipeline manually aborted after layout extraction.")
            return {"stages_dir": str(stages_dir), "errors": ["Pipeline manually aborted."]}

        # Stage 2: Markdown Generation
        set_pipeline_stage(
            run_id,
            PipelineStage.MARKDOWN_GENERATION,
            progress=0.20,
            details={"pages": len(layouts), "spans": spans_count, "engine": engine}
        )

        if engine == "tcs_cbt":
            print(f"    [*] Engine: tcs_cbt (high-speed TCS iON / RRB / SSC CBT extraction)")
            questions, doc_title = extract_tcs_cbt_questions(pdf_path, output_dir)
            ak_entries = []
        elif engine == "candidate_sheet":
            print(f"    [*] Engine: candidate_sheet (high-speed response sheet extraction)")
            questions, doc_title = extract_candidate_response_questions(pdf_path, output_dir)
            ak_entries = []
        elif engine == "ocr_spatial":
            print(f"    [*] Engine: ocr_spatial (scanned / raster PDF)")
            questions, doc_title = extract_questions_from_pdf(pdf_path, output_dir)
            try:
                ak_entries = detect_answer_key_sections(pdf_path, layouts)
            except Exception as e:
                logger.warning(f"Answer key detection failed: {e}")
                ak_entries = []
        else:
            print(f"    [*] Engine: native_vector (standard / solved exam paper)")
            questions, doc_title, ak_entries = extract_native_exam_questions(pdf_path, output_dir)

        sr2 = StageReport(2, "Markdown Document Generation")
        full_md = generate_exam_markdown(
            title=doc_title,
            pdf_path=pdf_path,
            questions=questions,
            answer_key_entries=ak_entries,
        )
        audit_stage2_markdown(full_md, sr2)
        sr2.artifact_path = save_stage_artifact(stages_dir, "stage2_raw_exam.md", full_md)
        sr2.complete()
        reports.append(sr2)
        print(f"    [+] Saved Stage 2: {sr2.artifact_path}")

        if is_pipeline_aborted(run_id):
            set_pipeline_stage(run_id, PipelineStage.ABORTED, error="Pipeline manually aborted after markdown generation.")
            return {"stages_dir": str(stages_dir), "errors": ["Pipeline manually aborted."]}

        # Stage 3: Question Chunking
        intermediate_qs = [_questionblock_to_dict(q) for q in questions]
        set_pipeline_stage(
            run_id,
            PipelineStage.QUESTION_CHUNKING,
            progress=0.30,
            details={"chunks_count": len(intermediate_qs), "engine": engine}
        )

        sr3 = StageReport(3, "Question Chunking & Boundary Segmentation")
        audit_stage3_chunks(intermediate_qs, sr3)
        sr3.artifact_path = save_stage_artifact(stages_dir, "stage3_question_chunks.json", intermediate_qs)
        sr3.complete()
        reports.append(sr3)
        print(f"    [+] Saved Stage 3: {sr3.artifact_path} ({len(intermediate_qs)} questions)")

        return {
            "stages_dir": str(stages_dir),
            "extracted_questions": intermediate_qs,
            "markdown_text": full_md,
            "stage_reports": reports,
        }

    except Exception as e:
        err = f"[node_examintel_extraction] Fatal extraction error: {e}"
        logger.error(err, exc_info=True)
        set_pipeline_stage(run_id, PipelineStage.FAILED, error=err)
        return {
            "stages_dir": str(stages_dir),
            "extracted_questions": [],
            "markdown_text": "",
            "stage_reports": reports,
            "errors": [err],
        }


@observe(name="node_indic_matra_clean")
def node_indic_matra_clean(state: ExamIngestionState) -> dict:
    """
    Node 4: Devanagari / Indic Script Spacing & Ligature Repair.
    Saves: stage4_indic_matra_cleaned.json
    """
    run_id = state.get("pipeline_run_id")
    if is_pipeline_aborted(run_id) or state.get("errors"):
        if is_pipeline_aborted(run_id):
            set_pipeline_stage(run_id, PipelineStage.ABORTED, error="Pipeline manually aborted.")
            return {"errors": ["Pipeline manually aborted."]}
        return {}

    raw_qs = state.get("extracted_questions", [])
    set_pipeline_stage(
        run_id,
        PipelineStage.INDIC_FONT_REPAIR,
        progress=0.45,
        details={"questions_count": len(raw_qs)}
    )

    print(f"\n>>> [STAGE 4] Indic Matra & Ligature Repair")
    stages_dir = Path(state.get("stages_dir"))
    reports = list(state.get("stage_reports", []))

    sr4 = StageReport(4, "Indic Matra & Ligature Repair")
    parser = _INDIC_PARSER

    for q in raw_qs:
        q_text = q.get("question_text", "")
        if q_text:
            q["question_text"] = parser.clean_indic_text(q_text)

        for opt in q.get("options", []):
            opt_txt = opt.get("option_text", "")
            if opt_txt:
                opt["option_text"] = parser.clean_indic_text(opt_txt)

    audit_stage4_indic(raw_qs, sr4)
    sr4.artifact_path = save_stage_artifact(stages_dir, "stage4_indic_matra_cleaned.json", raw_qs)
    sr4.complete()
    reports.append(sr4)
    print(f"    [+] Saved Stage 4: {sr4.artifact_path}")

    return {
        "extracted_questions": raw_qs,
        "stage_reports": reports,
    }


@observe(name="node_katex_vision_refine")
def node_katex_vision_refine(state: ExamIngestionState) -> dict:
    """
    Node 5: Multimodal Vision KaTeX Normalizer for Complex Math/Science Questions.
    Saves: stage5_katex_vision_refined.json
    """
    run_id = state.get("pipeline_run_id")
    if is_pipeline_aborted(run_id) or state.get("errors"):
        if is_pipeline_aborted(run_id):
            set_pipeline_stage(run_id, PipelineStage.ABORTED, error="Pipeline manually aborted.")
            return {"errors": ["Pipeline manually aborted."]}
        return {}

    print(f"\n>>> [STAGE 5] KaTeX Math & Multimodal Vision Refine")
    stages_dir = Path(state.get("stages_dir"))
    reports = list(state.get("stage_reports", []))

    sr5 = StageReport(5, "KaTeX Math & Multimodal Vision Refine")
    raw_qs = state.get("extracted_questions", [])
    extracted_objects = []

    for q in raw_qs:
        try:
            extracted_objects.append(QuestionBlock(**q))
        except Exception:
            pass

    math_count = sum(1 for q in extracted_objects if needs_math_refinement(q))
    print(f"    [*] Detected {math_count}/{len(extracted_objects)} questions requiring KaTeX math refinement.")

    set_pipeline_stage(
        run_id,
        PipelineStage.KATEX_VISION_REFINE,
        progress=0.60,
        details={"math_questions_count": math_count, "total_questions": len(extracted_objects)}
    )

    # Refine questions concurrently
    output_dir = stages_dir.parent
    refined_objects = refine_questions_batch(extracted_objects, max_workers=8, output_dir=output_dir)

    fused_list = []
    for r in refined_objects:
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

    audit_stage5_katex(fused_list, sr5)
    sr5.artifact_path = save_stage_artifact(stages_dir, "stage5_katex_vision_refined.json", fused_list)
    sr5.complete()
    reports.append(sr5)
    print(f"    [+] Saved Stage 5: {sr5.artifact_path}")

    return {
        "fused_json": fused_list,
        "stage_reports": reports,
    }


@observe(name="node_bilingual_align")
def node_bilingual_align(state: ExamIngestionState) -> dict:
    """
    Node 6: Bilingual Hindi/English Alignment & Clean Deduplication.
    Ensures that for bilingual exams:
      - question_text has clean English text
      - question_text_hi has clean Hindi text
      - options have separated text and text_hi
    Saves: stage6_bilingual_aligned.json
    """
    run_id = state.get("pipeline_run_id")
    if is_pipeline_aborted(run_id) or state.get("errors"):
        if is_pipeline_aborted(run_id):
            set_pipeline_stage(run_id, PipelineStage.ABORTED, error="Pipeline manually aborted.")
            return {"errors": ["Pipeline manually aborted."]}
        return {}

    questions = state.get("fused_json", [])
    set_pipeline_stage(
        run_id,
        PipelineStage.BILINGUAL_ALIGNMENT,
        progress=0.75,
        details={"input_questions": len(questions)}
    )

    print(f"\n>>> [STAGE 6] Bilingual Alignment & Language Separation")
    stages_dir = Path(state.get("stages_dir"))
    reports = list(state.get("stage_reports", []))

    sr6 = StageReport(6, "Bilingual Alignment & Separation")
    cleaned_questions = []
    seen_stems = set()

    for q in questions:
        raw_en = (q.get("question_text") or "").strip()
        raw_hi = (q.get("question_text_hi") or "").strip()

        if not raw_en and not raw_hi:
            continue

        # If question_text contains both English and Hindi lines, split them
        if not raw_hi and "\n" in raw_en:
            lines = [l.strip() for l in raw_en.split("\n") if l.strip()]
            en_lines = [l for l in lines if not any("\u0900" <= c <= "\u097f" for c in l)]
            hi_lines = [l for l in lines if any("\u0900" <= c <= "\u097f" for c in l)]
            if en_lines and hi_lines:
                raw_en = "\n".join(en_lines).strip()
                raw_hi = "\n".join(hi_lines).strip()

        # Split option text if combined
        for opt in q.get("options", []):
            o_text = opt.get("answer_text") or opt.get("text") or ""
            o_hi = opt.get("answer_text_hi") or opt.get("text_hi") or ""
            if not o_hi and "\n" in o_text:
                o_lines = [l.strip() for l in o_text.split("\n") if l.strip()]
                o_en_l = [l for l in o_lines if not any("\u0900" <= c <= "\u097f" for c in l)]
                o_hi_l = [l for l in o_lines if any("\u0900" <= c <= "\u097f" for c in l)]
                if o_en_l and o_hi_l:
                    opt["answer_text"] = "\n".join(o_en_l).strip()
                    opt["answer_text_hi"] = "\n".join(o_hi_l).strip()

        q["question_text"] = raw_en
        q["question_text_hi"] = raw_hi or (raw_en if any("\u0900" <= c <= "\u097f" for c in raw_en) else None)

        stem_sig = re.sub(r"\s+", "", (raw_en or raw_hi).lower())[:80]
        if stem_sig in seen_stems:
            continue
        seen_stems.add(stem_sig)

        cleaned_questions.append(q)

    audit_stage6_bilingual(cleaned_questions, sr6)
    sr6.artifact_path = save_stage_artifact(stages_dir, "stage6_bilingual_aligned.json", cleaned_questions)
    sr6.complete()
    reports.append(sr6)
    print(f"    [+] Saved Stage 6: {sr6.artifact_path} ({len(cleaned_questions)} unique questions)")

    return {
        "fused_json": cleaned_questions,
        "stage_reports": reports,
    }


@observe(name="node_agentic_solve")
def node_agentic_solve(state: ExamIngestionState) -> dict:
    """
    Node 7: Batched Agentic Reasoning Solver for Unmarked Answer Keys (Safety Fallback).
    Saves: stage7_agentic_solved.json
    """
    run_id = state.get("pipeline_run_id")
    if is_pipeline_aborted(run_id) or state.get("errors"):
        if is_pipeline_aborted(run_id):
            set_pipeline_stage(run_id, PipelineStage.ABORTED, error="Pipeline manually aborted.")
            return {"errors": ["Pipeline manually aborted."]}
        return {}

    print(f"\n>>> [STAGE 7] Answer Key Resolution & Ground-Truth Verification")
    stages_dir = Path(state.get("stages_dir"))
    reports = list(state.get("stage_reports", []))

    sr7 = StageReport(7, "Answer Key Resolution & Solver")
    client = GeminiClient()
    questions = state.get("fused_json", [])

    unresolved = []
    for idx, q in enumerate(questions):
        opts = q.get("options", [])
        if any(o.get("is_correct") for o in opts):
            q["solver_verified"] = True
        else:
            unresolved.append((idx, q))

    set_pipeline_stage(
        run_id,
        PipelineStage.AGENTIC_SOLVE,
        progress=0.85,
        details={"unresolved_count": len(unresolved), "total_questions": len(questions)}
    )

    if unresolved:
        print(f"    [*] Found {len(unresolved)} questions with missing answers. Solving in batched groups of 10...")
        batch_size = 10
        batches = [unresolved[i:i + batch_size] for i in range(0, len(unresolved), batch_size)]

        def process_solver_batch(batch):
            if is_pipeline_aborted(run_id):
                return
            batch_items = []
            for local_idx, (orig_idx, q) in enumerate(batch):
                opts_summary = [f"{o.get('id', chr(65+j))}: {o.get('answer_text', '')}" for j, o in enumerate(q.get("options", []))]
                batch_items.append({
                    "item_id": local_idx,
                    "question": q.get("question_text", ""),
                    "options": opts_summary
                })

            prompt = (
                "You are an expert exam key resolver. Determine the single correct option ID (e.g. 'A', 'B', 'C', 'D').\n"
                "Return ONLY a strict JSON array: [{\"item_id\": 0, \"correct_option\": \"B\"}]\n\n"
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

    audit_stage7_solved(questions, sr7)
    sr7.artifact_path = save_stage_artifact(stages_dir, "stage7_agentic_solved.json", questions)
    sr7.complete()
    reports.append(sr7)
    print(f"    [+] Saved Stage 7: {sr7.artifact_path}")

    return {
        "fused_json": questions,
        "stage_reports": reports,
    }


@observe(name="node_pydantic_validate")
def node_pydantic_validate(state: ExamIngestionState) -> dict:
    """
    Node 8: Canonical V2 Schema Validation and Pipeline Audit Report Generation.
    Saves:
      - stage8_canonical_v2_payloads.json
      - pipeline_audit_report.json
      - pipeline_audit_report.md
    """
    run_id = state.get("pipeline_run_id")
    if is_pipeline_aborted(run_id) or state.get("errors"):
        if is_pipeline_aborted(run_id):
            set_pipeline_stage(run_id, PipelineStage.ABORTED, error="Pipeline manually aborted.")
            return {"errors": ["Pipeline manually aborted."]}
        return {}

    pdf_path = state.get("pdf_path")
    stages_dir = Path(state.get("stages_dir"))
    reports = list(state.get("stage_reports", []))

    print(f"\n>>> [STAGE 8] Canonical V2 Validation & Full Pipeline Audit Report")

    fused_data = state.get("fused_json", [])
    set_pipeline_stage(
        run_id,
        PipelineStage.CANONICAL_V2_ASSEMBLY,
        progress=0.95,
        details={"canonical_candidates": len(fused_data)}
    )

    sr8 = StageReport(8, "Canonical V2 Schema Validation")
    v2_payloads = []
    pos_marks, neg_marks = detect_exam_marking_scheme(pdf_path)

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
                "text": opt.get("answer_text") or opt.get("text") or "",
                "text_hi": opt.get("answer_text_hi") or opt.get("text_hi"),
                "image_url": None,
                "explanation": None,
                "is_correct": is_c
            })
            if is_c:
                correct_ids.append(opt_id)

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
                "positive": pos_marks,
                "negative": neg_marks,
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
                "verified": item.get("solver_verified", True),
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

    audit_stage8_canonical_v2(v2_payloads, sr8)
    sr8.artifact_path = save_stage_artifact(stages_dir, "stage8_canonical_v2_payloads.json", v2_payloads)
    sr8.complete()
    reports.append(sr8)
    print(f"    [+] Saved Stage 8: {sr8.artifact_path} ({len(v2_payloads)} canonical questions)")

    # Generate Final Audit Report
    report_json_path, report_md_path = generate_pipeline_audit_report(pdf_path, reports, stages_dir)
    print(f"\n=======================================================")
    print(f"🎉 PIPELINE AUDIT REPORT GENERATED SUCCESSFULLY!")
    print(f"    📄 Markdown Report: {report_md_path}")
    print(f"    📊 JSON Metrics:    {report_json_path}")
    print(f"=======================================================")

    return {
        "final_payloads": v2_payloads,
        "stage_reports": reports,
    }


@observe(name="node_cleanup")
def node_cleanup(state: ExamIngestionState) -> dict:
    run_id = state.get("pipeline_run_id")
    errors = state.get("errors", [])
    if is_pipeline_aborted(run_id):
        set_pipeline_stage(run_id, PipelineStage.ABORTED, progress=1.0, error="Pipeline execution aborted by user.")
        logger.warning(f"Pipeline {run_id} aborted by user.")
    elif errors:
        set_pipeline_stage(run_id, PipelineStage.FAILED, progress=1.0, error="; ".join(errors))
        logger.error(f"Pipeline {run_id} failed: {errors}")
    else:
        payloads = state.get("final_payloads", [])
        set_pipeline_stage(
            run_id,
            PipelineStage.COMPLETED,
            progress=1.0,
            details={"canonical_questions": len(payloads)}
        )
        logger.info(f"Pipeline {run_id} execution and audit completed successfully.")
    return {}


class ExamIngestionGraph:
    """
    Unified LangGraph StateGraph Orchestrator with Multi-Stage Auditing, Stage Monitoring, and Disk Persistence.
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
    def run(self, pdf_path: str, run_id: Optional[str] = None) -> dict:
        stages_dir = str(get_pipeline_stages_dir(pdf_path, getattr(settings, "MEDIA_ROOT", None)))
        update_trace_metadata(
            tags=["exam_ingestion", "universal_audited_pipeline"],
            input={"pdf_path": pdf_path, "stages_dir": stages_dir, "run_id": run_id}
        )
        initial_state = {
            "pdf_path": pdf_path,
            "pipeline_run_id": run_id,
            "stages_dir": stages_dir,
            "gemini_file_name": None,
            "markdown_text": "",
            "images": [],
            "raw_chunks": [],
            "extracted_questions": [],
            "fused_json": [],
            "final_payloads": [],
            "stage_reports": [],
            "errors": []
        }
        result = self.graph.invoke(initial_state)
        update_trace_metadata(
            output={
                "extracted_questions_count": len(result.get("final_payloads", [])),
                "stages_dir": stages_dir,
                "errors_count": len(result.get("errors", []))
            }
        )
        return result
