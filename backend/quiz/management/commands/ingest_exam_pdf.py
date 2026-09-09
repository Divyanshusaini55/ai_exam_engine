from __future__ import annotations
import sys
import time
import re
from pathlib import Path
from typing import List, Dict, Any, Optional

from django.core.management.base import BaseCommand, CommandError
from django.conf import settings
from django.utils.text import slugify

from quiz.ai.examintel.tcs_cbt_engine import (
    extract_tcs_cbt_questions,
    is_tcs_cbt_paper,
    detect_exam_marking_scheme,
)
from quiz.ai.examintel.candidate_sheet_engine import (
    extract_candidate_response_questions,
    is_candidate_response_sheet,
)
from quiz.ai.examintel.native_engine import extract_native_exam_questions
from quiz.ai.examintel.ocr_engine import extract_questions_from_pdf
from quiz.ai.examintel.answer_key_detection import detect_answer_key_sections
from quiz.ai.examintel.layout_extraction import extract_text_layout
from quiz.ai.examintel.indic_font_repair import repair_indic_text
from quiz.ai.examintel.llm_refiner import refine_questions_batch
from quiz.ai.examintel.markdown_generator import (
    generate_exam_markdown,
    generate_refined_exam_markdown,
)
from quiz.ai.examintel.markdown_exam_parser import MarkdownExamParser
from quiz.ai.examintel.asset_storage_agent import AssetStorageAgent
from quiz.ai.examintel.bilingual_agent import BilingualAgent
from quiz.ai.examintel.academic_tutor_agent import AcademicTutorAgent
from quiz.ai.examintel.canonical_v2_assembler import CanonicalV2Assembler
from quiz.ai.examintel.db_ingestion_service import DBIngestionService
from quiz.ai.examintel.audit import (
    StageReport,
    get_pipeline_stages_dir,
    save_stage_artifact,
    audit_stage1_layout,
    audit_stage2_markdown,
    generate_pipeline_audit_report,
)
from quiz.ai.examintel.pipeline_monitor import (
    PipelineStage,
    set_pipeline_stage,
    is_pipeline_aborted,
)


def _route_pdf_engine(pdf_path: str) -> str:
    """
    Selects the optimal extraction engine for any given exam PDF format:
      1. tcs_cbt: TCS iON CBT papers (SSC CGL 2024, RRB NTPC) with Q.<num> and 16x16 green tick icons
      2. candidate_sheet: UP Police SI response sheets with 'Question No. X', '(Correct Answer)'
      3. native_vector: Standard digital mock/sample papers with vector text
      4. ocr_spatial: Scanned/raster booklet papers requiring computer vision OCR
    """
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


class Command(BaseCommand):
    help = "Universal PDF-to-DB Exam Ingestion Pipeline: extracts, refines, and persists any exam PDF into canonical V2 DB."

    def add_arguments(self, parser):
        parser.add_argument(
            "pdf_file",
            type=str,
            help="Path to the exam PDF file (e.g. media/pdfs/SSC-CGL-Tier-1-Question-Paper-9-September-2024-Shift-1.pdf)",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            default=False,
            help="Run extraction, refinement, and canonical assembly without writing to the database.",
        )
        parser.add_argument(
            "--enrich",
            action="store_true",
            default=False,
            help="Run Gemini LLM for deep academic classification, Bloom levels, and solution hints (default: fast heuristic path).",
        )
        parser.add_argument(
            "--refine",
            action="store_true",
            default=True,
            help="Run multimodal LLM refinement (Gemini 2.5 Flash) for questions with complex math, KaTeX formulas, tables, and vision-verified diagrams (default: True).",
        )
        parser.add_argument(
            "--no-refine",
            dest="refine",
            action="store_false",
            help="Skip multimodal LLM refinement (fast deterministic path only).",
        )
        parser.add_argument(
            "--refine-workers",
            type=int,
            default=8,
            help="Number of parallel worker threads for multimodal LLM refinement (default: 8).",
        )
        parser.add_argument(
            "--no-upload-assets",
            action="store_true",
            default=False,
            help="Skip uploading visual assets to Object Storage (keeps local relative paths).",
        )
        parser.add_argument(
            "--publish",
            action="store_true",
            default=True,
            help="Mark the ingested exam as active/published (default: True).",
        )
        parser.add_argument(
            "--slug",
            type=str,
            default=None,
            help="Custom slug for the exam (defaults to auto-generated from title or filename).",
        )
        parser.add_argument(
            "--title",
            type=str,
            default=None,
            help="Custom title for the exam (defaults to detected title).",
        )
        parser.add_argument(
            "--category",
            type=str,
            default=None,
            help="Custom category name (e.g. 'SSC', 'Police Exams', 'Railway Exams').",
        )
        parser.add_argument(
            "--subcategory",
            type=str,
            default=None,
            help="Custom subcategory name (e.g. 'SSC CGL', 'UP Police SI', 'RRB NTPC').",
        )
        parser.add_argument(
            "--duration",
            type=int,
            default=None,
            help="Exam duration in minutes (auto-inferred if not specified: 60 for SSC Tier 1, 90 for RRB NTPC, 120 for Police).",
        )
        parser.add_argument(
            "--positive-marks",
            type=float,
            default=None,
            help="Override positive marks per question.",
        )
        parser.add_argument(
            "--negative-marks",
            type=float,
            default=None,
            help="Override negative marks per question.",
        )
        parser.add_argument(
            "--output-dir",
            type=str,
            default=None,
            help="Custom output directory for pipeline stages and local asset artifacts.",
        )
        parser.add_argument(
            "--run-id",
            type=str,
            default=None,
            help="Optional pipeline tracking run ID for real-time monitoring and abort checks.",
        )

    def handle(self, *args, **options):
        pdf_path = Path(options["pdf_file"])
        if not pdf_path.exists():
            raise CommandError(f"Exam PDF file does not exist: {pdf_path}")

        run_id = options.get("run_id")
        dry_run = options["dry_run"]
        do_enrich = options["enrich"]
        do_refine = options["refine"]
        refine_workers = options.get("refine_workers", 8)
        upload_assets = not options["no_upload_assets"]
        is_publish = options["publish"]

        start_time = time.time()
        self.stdout.write(self.style.NOTICE("\n======================================================="))
        self.stdout.write(self.style.NOTICE(f">>> [ExamIntel Universal Ingestion] Ingesting '{pdf_path.name}'"))
        self.stdout.write(self.style.NOTICE(f"    Mode: {'DRY RUN (No DB Write)' if dry_run else 'LIVE DATABASE INGESTION'}"))
        self.stdout.write(self.style.NOTICE(f"    Multimodal Refinement: {'ENABLED (Gemini 3.8 Flash)' if do_refine else 'FAST DETERMINISTIC PATH'}"))
        self.stdout.write(self.style.NOTICE(f"    Enrichment LLM: {'ENABLED' if do_enrich else 'HEURISTIC FAST PATH'}"))
        self.stdout.write(self.style.NOTICE(f"    Object Storage Upload: {'ENABLED' if upload_assets else 'SKIPPED'}"))
        if run_id:
            self.stdout.write(self.style.NOTICE(f"    Pipeline Run ID: {run_id}"))
        self.stdout.write(self.style.NOTICE("======================================================="))

        if is_pipeline_aborted(run_id):
            self.stdout.write(self.style.WARNING(f"[-] Pipeline {run_id} aborted before initiation."))
            set_pipeline_stage(run_id, PipelineStage.ABORTED, error="Pipeline manually aborted.")
            return

        # 1. Route Engine & Detect Dynamic Marking Scheme
        engine = _route_pdf_engine(str(pdf_path))
        self.stdout.write(self.style.HTTP_INFO(f"\n[1/7] Engine Router: Selected '{engine}' engine for '{pdf_path.name}'"))

        detected_pos, detected_neg = detect_exam_marking_scheme(str(pdf_path))
        pos_marks = options["positive_marks"] if options["positive_marks"] is not None else detected_pos
        neg_marks = options["negative_marks"] if options["negative_marks"] is not None else detected_neg

        self.stdout.write(self.style.SUCCESS(
            f"    [+] Detected Marking Scheme: +{pos_marks} / -{neg_marks} marks"
        ))

        # 2. Configure output directories
        raw_slug = options.get("slug") or slugify(pdf_path.stem).lower()
        if options.get("output_dir"):
            stages_dir = Path(options["output_dir"])
        else:
            stages_dir = Path(get_pipeline_stages_dir(str(pdf_path), getattr(settings, "MEDIA_ROOT", None)))

        stages_dir.mkdir(parents=True, exist_ok=True)
        assets_dir = stages_dir.parent / "assets"
        assets_dir.mkdir(parents=True, exist_ok=True)
        (assets_dir / "crops").mkdir(parents=True, exist_ok=True)

        stage_reports: List[StageReport] = []

        # Stage 1: Layout Extraction & Text Analysis
        set_pipeline_stage(
            run_id,
            PipelineStage.LAYOUT_EXTRACTION,
            progress=0.10,
            details={"pdf": pdf_path.name, "engine": engine}
        )

        sr1 = StageReport(1, "Layout & Text Extraction")
        layouts = extract_text_layout(str(pdf_path))
        spans_count = sum(len(pl.spans) for pl in layouts)
        audit_stage1_layout(layouts, spans_count, sr1)
        sr1.artifact_path = save_stage_artifact(
            stages_dir,
            "stage1_layout_extraction.json",
            [l.model_dump() if hasattr(l, "model_dump") else l.dict() for l in layouts],
        )
        sr1.complete()
        stage_reports.append(sr1)

        if is_pipeline_aborted(run_id):
            self.stdout.write(self.style.WARNING("[-] Pipeline manually aborted after layout extraction."))
            set_pipeline_stage(run_id, PipelineStage.ABORTED, error="Aborted after layout extraction.")
            return

        # Stage 2: Question Extraction via Selected Engine
        self.stdout.write(self.style.HTTP_INFO(f"\n[2/7] Extracting questions with '{engine}' engine..."))
        output_dir = stages_dir.parent

        if engine == "tcs_cbt":
            questions, doc_title = extract_tcs_cbt_questions(str(pdf_path), output_dir)
            ak_entries = []
        elif engine == "candidate_sheet":
            questions, doc_title = extract_candidate_response_questions(str(pdf_path), output_dir)
            ak_entries = []
        elif engine == "ocr_spatial":
            questions, doc_title = extract_questions_from_pdf(str(pdf_path), output_dir)
            try:
                ak_entries = detect_answer_key_sections(str(pdf_path), layouts)
            except Exception as e:
                self.stdout.write(self.style.WARNING(f"    [!] Answer key detection fallback: {e}"))
                ak_entries = []
        else:
            questions, doc_title, ak_entries = extract_native_exam_questions(str(pdf_path), output_dir)

        # Clean corrupted legacy Indic font encodings deterministically across all questions
        set_pipeline_stage(
            run_id,
            PipelineStage.INDIC_FONT_REPAIR,
            progress=0.25,
            details={"questions_extracted": len(questions)}
        )
        for q in questions:
            q.question_text = repair_indic_text(q.question_text)
            if q.shared_context:
                q.shared_context = repair_indic_text(q.shared_context)
            for opt in q.options:
                opt.option_text = repair_indic_text(opt.option_text)

        exam_title = options.get("title") or doc_title or pdf_path.stem.replace("-", " ").title()
        exam_slug = options.get("slug") or slugify(exam_title).lower()

        # Inferred Duration
        duration_minutes = options.get("duration")
        if not duration_minutes:
            lower_s = (exam_slug + " " + exam_title).lower()
            if "tier-1" in lower_s or "tier 1" in lower_s:
                duration_minutes = 60
            elif "rrb" in lower_s or "railway" in lower_s:
                duration_minutes = 90
            elif "police" in lower_s:
                duration_minutes = 120
            else:
                duration_minutes = 120

        self.stdout.write(self.style.SUCCESS(
            f"    [+] Extracted {len(questions)} questions for '{exam_title}' (Duration: {duration_minutes}m)"
        ))

        if is_pipeline_aborted(run_id):
            self.stdout.write(self.style.WARNING("[-] Pipeline manually aborted after text extraction."))
            set_pipeline_stage(run_id, PipelineStage.ABORTED, error="Aborted after text extraction.")
            return

        # Stage 3: Markdown Generation & Structure Parsing
        self.stdout.write(self.style.HTTP_INFO("\n[3/7] Generating standardized Markdown document..."))
        set_pipeline_stage(
            run_id,
            PipelineStage.MARKDOWN_GENERATION,
            progress=0.40,
            details={"title": exam_title, "questions": len(questions)}
        )

        sr2 = StageReport(2, "Markdown Document Generation")
        full_md = generate_exam_markdown(
            title=exam_title,
            pdf_path=str(pdf_path),
            questions=questions,
            answer_key_entries=ak_entries,
        )
        audit_stage2_markdown(full_md, sr2)
        sr2.artifact_path = save_stage_artifact(stages_dir, "stage2_raw_exam.md", full_md)
        sr2.complete()
        stage_reports.append(sr2)

        # Stage 3.5: Multimodal KaTeX & Math Refinement (if requested)
        if do_refine:
            if is_pipeline_aborted(run_id):
                set_pipeline_stage(run_id, PipelineStage.ABORTED, error="Aborted before KaTeX refinement.")
                return

            self.stdout.write(self.style.HTTP_INFO("\n[3.5/7] Running Multimodal KaTeX & Math Refinement (Gemini 3.8 Flash)..."))
            set_pipeline_stage(
                run_id,
                PipelineStage.KATEX_VISION_REFINE,
                progress=0.55,
                details={"workers": refine_workers}
            )
            sr_refine = StageReport(3, "Multimodal KaTeX & Math Refinement")
            refined_questions = refine_questions_batch(
                questions=questions,
                max_workers=refine_workers,
                output_dir=output_dir,
            )
            refined_md = generate_refined_exam_markdown(
                title=exam_title,
                pdf_path=str(pdf_path),
                refined_questions=refined_questions,
                answer_key_entries=ak_entries,
            )
            sr_refine.artifact_path = save_stage_artifact(stages_dir, "stage4_refined_exam.md", refined_md)
            sr_refine.complete()
            stage_reports.append(sr_refine)
            active_md = refined_md
            self.stdout.write(self.style.SUCCESS(
                f"    [+] Refined {len(refined_questions)} questions into KaTeX Markdown: {sr_refine.artifact_path}"
            ))
        else:
            active_md = full_md

        # Parse markdown into structured question representations
        parsed_doc = MarkdownExamParser.parse_text(active_md, source_filename=pdf_path.name)
        self.stdout.write(self.style.SUCCESS(
            f"    [+] Parsed Markdown: {len(parsed_doc.questions)} questions across {len(parsed_doc.sections)} sections."
        ))

        if not parsed_doc.questions:
            set_pipeline_stage(run_id, PipelineStage.FAILED, error="Failed to extract or parse any questions from the PDF.")
            raise CommandError("Failed to extract or parse any questions from the PDF.")

        if is_pipeline_aborted(run_id):
            set_pipeline_stage(run_id, PipelineStage.ABORTED, error="Aborted after parsing Markdown.")
            return

        # Stage 4: Visual Asset Storage & CDN URL Rewriting
        if upload_assets:
            self.stdout.write(self.style.HTTP_INFO("\n[4/7] Ingesting visual assets into Object Storage / CDN..."))
            set_pipeline_stage(
                run_id,
                PipelineStage.ASSET_EXTRACTION,
                progress=0.65,
                details={"questions_count": len(parsed_doc.questions)}
            )
            url_map = AssetStorageAgent.ingest_exam_assets(exam_slug, output_dir, parsed_doc.questions)
            self.stdout.write(self.style.SUCCESS(f"    [+] Uploaded & mapped {len(url_map)} assets to public CDN URLs."))
        else:
            self.stdout.write(self.style.HTTP_INFO("\n[4/7] Visual asset upload skipped (--no-upload-assets)."))

        if is_pipeline_aborted(run_id):
            set_pipeline_stage(run_id, PipelineStage.ABORTED, error="Aborted before bilingual alignment.")
            return

        # Stage 5: Bilingual Separation Agent
        self.stdout.write(self.style.HTTP_INFO("\n[5/7] Running Bilingual Separation Agent..."))
        set_pipeline_stage(
            run_id,
            PipelineStage.BILINGUAL_ALIGNMENT,
            progress=0.75,
            details={"questions_count": len(parsed_doc.questions)}
        )
        bilingual_payloads = []
        lang_counts: Dict[str, int] = {}
        for q in parsed_doc.questions:
            bi = BilingualAgent.process_question(q)
            bilingual_payloads.append(bi)
            lang_counts[bi.language] = lang_counts.get(bi.language, 0) + 1

        self.stdout.write(self.style.SUCCESS(
            f"    [+] Language profiles: {lang_counts.get('hi', 0)} Hindi, "
            f"{lang_counts.get('en', 0)} English, {lang_counts.get('bilingual', 0)} Bilingual."
        ))

        if is_pipeline_aborted(run_id):
            set_pipeline_stage(run_id, PipelineStage.ABORTED, error="Aborted before academic enrichment.")
            return

        # Stage 6: Academic Classification & Tutor Agent
        self.stdout.write(self.style.HTTP_INFO("\n[6/7] Running Academic Classification & Tutor Agent..."))
        set_pipeline_stage(
            run_id,
            PipelineStage.ACADEMIC_ENRICHMENT,
            progress=0.85,
            details={"enrich_enabled": do_enrich, "count": len(parsed_doc.questions)}
        )
        academic_agent = AcademicTutorAgent()
        questions_to_enrich = []
        for idx, q in enumerate(parsed_doc.questions):
            bi = bilingual_payloads[idx]
            questions_to_enrich.append({
                "item_id": q.global_question_number,
                "section": q.section_name,
                "topic_hint": q.topic or "",
                "stem_en": bi.stem_en,
                "stem_hi": bi.stem_hi or "",
                "options": [f"{o.option_number}. {o.text_en}" for o in bi.options],
                "correct_option": q.correct_option or "",
            })

        if do_enrich:
            self.stdout.write(self.style.HTTP_INFO("    [*] Calling Gemini 3.8 Flash for academic intelligence & tutor hints..."))
            enriched_academic_data = academic_agent.enrich_questions_batch(questions_to_enrich, batch_size=15)
        else:
            self.stdout.write(self.style.HTTP_INFO("    [*] Generating fast deterministic academic metadata..."))
            enriched_academic_data = [academic_agent.generate_heuristics_enrichment(it) for it in questions_to_enrich]

        if is_pipeline_aborted(run_id):
            set_pipeline_stage(run_id, PipelineStage.ABORTED, error="Aborted before Canonical V2 Assembly.")
            return

        # Stage 7: Canonical V2 Assembler & Database Persistence
        self.stdout.write(self.style.HTTP_INFO("\n[7/7] Assembling Canonical V2 Schema & Persisting..."))
        set_pipeline_stage(
            run_id,
            PipelineStage.CANONICAL_V2_ASSEMBLY,
            progress=0.92,
            details={"questions_count": len(parsed_doc.questions)}
        )
        canonical_questions = []
        year_match = re.search(r"\b(202[0-9])\b", exam_title)
        year_val = int(year_match.group(1)) if year_match else 2024

        shift_match = re.search(r"(?:Shift|Slot)\s*([0-9]+)", exam_title, re.IGNORECASE)
        shift_val = f"Shift {shift_match.group(1)}" if shift_match else "Shift 1"

        for idx, q in enumerate(parsed_doc.questions):
            bi = bilingual_payloads[idx]
            acad = enriched_academic_data[idx]
            v2_q = CanonicalV2Assembler.assemble_question(
                parsed_q=q,
                bilingual_data=bi,
                academic_data=acad,
                exam_name=exam_title,
                year=year_val,
                shift=shift_val,
                positive_marks=pos_marks,
                negative_marks=neg_marks,
                exam_slug=exam_slug,
            )
            canonical_questions.append(v2_q)

        # Output JSON artifact
        json_out_path = stages_dir / "canonical_v2_exam.json"
        canonical_payloads = CanonicalV2Assembler.assemble_exam_package(canonical_questions, output_file=json_out_path)
        self.stdout.write(self.style.SUCCESS(f"    [+] Emitted canonical V2 JSON: {json_out_path} ({len(canonical_payloads)} questions)"))

        # Generate Pipeline Audit Report
        rep_json, rep_md = generate_pipeline_audit_report(str(pdf_path), stage_reports, stages_dir)
        self.stdout.write(self.style.SUCCESS(f"    [+] Generated Audit Report: {rep_md}"))

        if is_pipeline_aborted(run_id):
            set_pipeline_stage(run_id, PipelineStage.ABORTED, error="Aborted before database persistence.")
            return

        # Database Ingestion
        if not dry_run:
            set_pipeline_stage(
                run_id,
                PipelineStage.DB_PERSISTENCE,
                progress=0.97,
                details={"canonical_questions": len(canonical_payloads)}
            )
            exam = DBIngestionService.ingest_canonical_exam(
                exam_title=exam_title,
                canonical_questions=canonical_payloads,
                exam_slug=exam_slug,
                category_name=options.get("category"),
                subcategory_name=options.get("subcategory"),
                duration_minutes=duration_minutes,
                positive_marks=pos_marks,
                negative_marks=neg_marks,
                is_active=is_publish,
            )
            set_pipeline_stage(
                run_id,
                PipelineStage.COMPLETED,
                progress=1.0,
                details={
                    "exam_id": exam.id,
                    "slug": exam.slug,
                    "total_questions": exam.total_questions,
                    "duration_seconds": round(time.time() - start_time, 2)
                }
            )
            self.stdout.write(self.style.SUCCESS(
                f"\n🎉 EXAM INGESTION COMPLETED SUCCESSFULLY!\n"
                f"    Exam ID:        {exam.id}\n"
                f"    Title:          {exam.title}\n"
                f"    Slug:           {exam.slug}\n"
                f"    Category:       {exam.subcategory.category.name if exam.subcategory else 'N/A'}\n"
                f"    SubCategory:    {exam.subcategory.name if exam.subcategory else 'N/A'}\n"
                f"    Questions:      {exam.total_questions}\n"
                f"    Duration:       {exam.duration_minutes} minutes\n"
                f"    Marking:        +{exam.marks_per_question} / -{exam.negative_marks}\n"
                f"    Total Marks:    {exam.total_marks}\n"
                f"    Status:         {'Active / Published' if exam.is_active else 'Draft'}\n"
                f"    Time Elapsed:   {time.time() - start_time:.2f}s\n"
            ))
        else:
            set_pipeline_stage(
                run_id,
                PipelineStage.COMPLETED,
                progress=1.0,
                details={"dry_run": True, "questions": len(canonical_payloads)}
            )
            self.stdout.write(self.style.WARNING(
                f"\n[DRY RUN COMPLETE] Validated {len(canonical_payloads)} canonical questions.\n"
                f"    Exam Title:     {exam_title}\n"
                f"    Exam Slug:      {exam_slug}\n"
                f"    Engine Used:    {engine}\n"
                f"    Marking Scheme: +{pos_marks} / -{neg_marks}\n"
                f"    Duration:       {duration_minutes}m\n"
                f"    Database was not modified (--dry-run).\n"
                f"    Time Elapsed:   {time.time() - start_time:.2f}s\n"
            ))
