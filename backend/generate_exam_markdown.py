
import sys
import os
import time
import argparse
from pathlib import Path

# Setup Django Environment
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

try:
    import django
    django.setup()
    from django.conf import settings
except Exception as e:
    print(f"[-] Django setup warning: {e}")

from quiz.ai.examintel.audit import (
    StageReport,
    get_pipeline_stages_dir,
    save_stage_artifact,
    audit_stage1_layout,
    audit_stage2_markdown,
    audit_stage3_chunks,
)
from quiz.ai.examintel.layout_extraction import extract_text_layout
from quiz.ai.examintel.tcs_cbt_engine import is_tcs_cbt_paper, extract_tcs_cbt_questions
from quiz.ai.examintel.candidate_sheet_engine import is_candidate_response_sheet, extract_candidate_response_questions
from quiz.ai.examintel.native_engine import extract_native_exam_questions
from quiz.ai.examintel.ocr_engine import extract_questions_from_pdf
from quiz.ai.examintel.answer_key_detection import detect_answer_key_sections
from quiz.ai.examintel.markdown_generator import generate_exam_markdown, generate_refined_exam_markdown
from quiz.ai.examintel.llm_refiner import refine_questions_batch
from quiz.ai.langgraph.exam_ingestion_graph import _select_engine, _questionblock_to_dict


def run_pipeline_till_markdown(pdf_path: str, custom_output_dir: str = None, refine: bool = False) -> dict:
    start_total_time = time.time()
    pdf_path = os.path.abspath(pdf_path)

    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"PDF file not found at: {pdf_path}")

    # Determine Output Directory (defaults to backend/output/<pdf_stem>/)
    base_output = os.path.join(os.path.dirname(__file__), "output")
    stem = Path(pdf_path).stem
    if custom_output_dir:
        stages_dir = Path(custom_output_dir)
    else:
        stages_dir = Path(base_output) / stem
    stages_dir.mkdir(parents=True, exist_ok=True)

    print("\n" + "=" * 65)
    print(f"🚀 EXAMINTEL PIPELINE: PDF ➔ MARKDOWN (.md) GENERATOR")
    print("=" * 65)
    print(f"📄 Source PDF:       {pdf_path}")
    print(f"📁 Output Directory: {stages_dir}")
    print("=" * 65 + "\n")

    # ── STAGE 1: Layout & Text Extraction ────────────────────────────────────
    print("⏳ [STAGE 1/3] Extracting text layout, styled spans, and geometry...")
    sr1 = StageReport(1, "Layout & Text Extraction")
    layouts = extract_text_layout(pdf_path)
    spans_count = sum(len(pl.spans) for pl in layouts)
    audit_stage1_layout(layouts, spans_count, sr1)
    stage1_json = save_stage_artifact(
        stages_dir,
        "stage1_layout_extraction.json",
        [l.model_dump() if hasattr(l, "model_dump") else l.dict() for l in layouts],
    )
    sr1.artifact_path = stage1_json
    sr1.complete()
    print(f"   ✅ Stage 1 Complete in {sr1.duration_seconds}s")
    print(f"   📊 Pages: {len(layouts)} | Text Spans: {spans_count:,}")
    print(f"   💾 Saved: {stage1_json}\n")

    # ── STAGE 2: Engine Selection & Question Extraction ───────────────────────
    ak_entries = []
    output_dir = stages_dir

    if is_tcs_cbt_paper(pdf_path):
        engine = "tcs_cbt"
        print(f"⏳ [STAGE 2/3] Detecting engine and generating complete Markdown (.md)...")
        print(f"   🔍 Detected Engine: '{engine}' (High-Speed CBT Response Sheet)")
        questions, doc_title = extract_tcs_cbt_questions(pdf_path, output_dir, generate_crops=True)
    elif is_candidate_response_sheet(pdf_path):
        engine = "candidate_sheet"
        print(f"⏳ [STAGE 2/3] Detecting engine and generating complete Markdown (.md)...")
        print(f"   🔍 Detected Engine: '{engine}' (UPPRPB / Multi-line Candidate Sheet)")
        questions, doc_title = extract_candidate_response_questions(pdf_path, output_dir)
    else:
        engine = _select_engine(pdf_path)
        print(f"⏳ [STAGE 2/3] Detecting engine and generating complete Markdown (.md)...")
        print(f"   🔍 Detected Engine: '{engine}'")
        if engine == "ocr_spatial":
            questions, doc_title = extract_questions_from_pdf(pdf_path, output_dir)
            try:
                ak_entries = detect_answer_key_sections(pdf_path, layouts)
            except Exception:
                pass
        else:
            questions, doc_title, ak_entries = extract_native_exam_questions(pdf_path, output_dir)

    sr2 = StageReport(2, "Markdown Document Generation")
    full_md = generate_exam_markdown(
        title=doc_title,
        pdf_path=pdf_path,
        questions=questions,
        answer_key_entries=ak_entries,
    )
    audit_stage2_markdown(full_md, sr2)
    stage2_md = save_stage_artifact(stages_dir, f"{stem}.md", full_md)
    # Also save a direct copy in backend/output/<stem>.md and stage2_raw_exam.md
    save_stage_artifact(Path(base_output), f"{stem}.md", full_md)
    save_stage_artifact(stages_dir, "stage2_raw_exam.md", full_md)

    # Maintain root output/assets symlink pointing to stages_dir/assets so images resolve in IDE preview
    root_assets = Path(base_output) / "assets"
    try:
        if root_assets.is_symlink() or root_assets.exists():
            if root_assets.is_symlink():
                root_assets.unlink()
        if not root_assets.exists():
            root_assets.symlink_to(stem + "/assets", target_is_directory=True)
    except Exception:
        pass

    sr2.artifact_path = stage2_md
    sr2.complete()

    print(f"   ✅ Stage 2 Complete in {sr2.duration_seconds}s")
    print(f"   📊 Markdown Length: {len(full_md):,} characters | Title: '{doc_title}'")
    print(f"   💾 Saved Markdown: {stage2_md}\n")

    # ── STAGE 3: Chunking & Boundary Segmentation ─────────────────────────────
    print("⏳ [STAGE 3/3] Segmenting question chunks & validating options...")
    intermediate_qs = [_questionblock_to_dict(q) for q in questions]
    sr3 = StageReport(3, "Question Chunking & Boundary Segmentation")
    audit_stage3_chunks(intermediate_qs, sr3)
    stage3_json = save_stage_artifact(
        stages_dir, "stage3_question_chunks.json", intermediate_qs
    )
    sr3.artifact_path = stage3_json
    sr3.complete()

    verified_count = sum(1 for q in intermediate_qs if q.get("detected_answer"))
    total_options = sum(len(q.get("options", [])) for q in intermediate_qs)

    print(f"   ✅ Stage 3 Complete in {sr3.duration_seconds}s")
    print(f"   📊 Questions: {len(intermediate_qs)} | Options: {total_options} | Verified Answers: {verified_count}/{len(intermediate_qs)}")
    print(f"   💾 Saved Chunks: {stage3_json}\n")

    # ── STAGE 4: Vision KaTeX Math Refinement (Optional / On-Demand) ─────────
    stage4_md = None
    stage4_json = None
    if refine:
        print("⏳ [STAGE 4/4] Refining mathematical formulas & pseudo-images into KaTeX...")
        sr4 = StageReport(4, "Vision KaTeX Math Refinement")
        refined_qs = refine_questions_batch(
            questions=questions,
            max_workers=6,
            output_dir=stages_dir,
        )
        refined_md = generate_refined_exam_markdown(
            title=doc_title,
            pdf_path=pdf_path,
            refined_questions=refined_qs,
            answer_key_entries=ak_entries,
        )
        stage4_md = save_stage_artifact(stages_dir, "stage4_refined_exam.md", refined_md)
        save_stage_artifact(Path(base_output), f"{stem}.md", refined_md)
        save_stage_artifact(stages_dir, f"{stem}.md", refined_md)
        stage4_json = save_stage_artifact(
            stages_dir, "stage4_refined_questions.json", [q.model_dump() for q in refined_qs]
        )
        sr4.artifact_path = stage4_md
        sr4.complete()

        print(f"   ✅ Stage 4 Complete in {sr4.duration_seconds}s")
        print(f"   📊 Refined Questions: {len(refined_qs)} | KaTeX Markdown: {len(refined_md):,} chars")
        print(f"   💾 Saved Refined Markdown: {stage4_md}\n")

    total_elapsed = round(time.time() - start_total_time, 2)

    # ── Summary Box ─────────────────────────────────────────────────────────
    print("=" * 65)
    print(f"🎉 PIPELINE EXECUTION SUCCESSFUL (Total Time: {total_elapsed}s)")
    print("=" * 65)
    print(f"📄 Generated .md File:   {stage4_md or stage2_md}")
    print(f"📋 Question Chunks JSON: {stage4_json or stage3_json}")
    print(f"📐 Layout Extraction:    {stage1_json}")
    print("=" * 65 + "\n")

    return {
        "pdf_path": pdf_path,
        "engine": engine,
        "doc_title": doc_title,
        "total_questions": len(intermediate_qs),
        "total_options": total_options,
        "markdown_char_length": len(refined_md) if refine else len(full_md),
        "markdown_file_path": stage4_md or stage2_md,
        "chunks_file_path": stage4_json or stage3_json,
        "layout_file_path": stage1_json,
        "stages_directory": str(stages_dir),
        "elapsed_seconds": total_elapsed,
    }


def main():
    parser = argparse.ArgumentParser(
        description="Generate Markdown (.md) and stage artifacts for an exam PDF."
    )
    parser.add_argument(
        "pdf_path",
        nargs="?",
        default=None,
        help="Path to the exam PDF file (e.g. backend/media/pdfs/my_exam.pdf)",
    )
    parser.add_argument(
        "--output-dir",
        "-o",
        default=None,
        help="Custom directory to store generated .md and .json artifacts",
    )
    parser.add_argument(
        "--refine",
        action="store_true",
        help="Run Stage 4 Vision KaTeX Refinement for mathematical formulas and pseudo-images",
    )
    args = parser.parse_args()

    # Find default PDF if none provided
    target_pdf = args.pdf_path
    if not target_pdf:
        # Check media/pdfs/
        default_dir = os.path.join(os.path.dirname(__file__), "media", "pdfs")
        if os.path.exists(default_dir):
            pdf_files = [
                os.path.join(default_dir, f)
                for f in os.listdir(default_dir)
                if f.lower().endswith(".pdf")
            ]
            if pdf_files:
                target_pdf = pdf_files[0]

    if not target_pdf or not os.path.exists(target_pdf):
        print("[-] Error: No PDF path provided and no PDF found in media/pdfs/.")
        print("    Usage: python generate_exam_markdown.py <path_to_pdf>")
        sys.exit(1)

    try:
        run_pipeline_till_markdown(target_pdf, custom_output_dir=args.output_dir, refine=args.refine)
    except Exception as e:
        print(f"\n[-] Fatal Pipeline Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
