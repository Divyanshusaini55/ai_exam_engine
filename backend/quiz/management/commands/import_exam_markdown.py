from __future__ import annotations
import sys
import time
from pathlib import Path
from django.core.management.base import BaseCommand, CommandError

from quiz.ai.examintel.markdown_exam_parser import MarkdownExamParser
from quiz.ai.examintel.bilingual_agent import BilingualAgent
from quiz.ai.examintel.academic_tutor_agent import AcademicTutorAgent
from quiz.ai.examintel.asset_storage_agent import AssetStorageAgent
from quiz.ai.examintel.canonical_v2_assembler import CanonicalV2Assembler
from quiz.ai.examintel.db_ingestion_service import DBIngestionService


class Command(BaseCommand):
    help = "Ingests a refined Markdown exam paper into canonical V2 JSONB schema and persists it into the database."

    def add_arguments(self, parser):
        parser.add_argument(
            "markdown_file",
            type=str,
            help="Path to the .md exam file (e.g. output/UP-Police-SI/stage4_refined_exam.md)",
        )
        parser.add_argument(
            "--enrich",
            action="store_true",
            default=False,
            help="Run Academic & Tutor LLM Agents to generate hints, solution steps, and Bloom cognitive levels.",
        )
        parser.add_argument(
            "--no-upload-assets",
            action="store_true",
            default=False,
            help="Skip uploading visual assets to Object Storage (keeps local relative paths).",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            default=False,
            help="Validate parsing and assemble canonical JSON without writing to the database.",
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
            help="Custom slug for the exam (e.g. ssc-cgl-2022-tier1-shift1).",
        )
        parser.add_argument(
            "--title",
            type=str,
            default=None,
            help="Custom title for the exam.",
        )
        parser.add_argument(
            "--output-json",
            type=str,
            default=None,
            help="Custom path to save the canonical v2 JSON file (defaults to canonical_v2_exam.json in the md dir).",
        )

    def handle(self, *args, **options):
        md_path = Path(options["markdown_file"])
        if not md_path.exists():
            raise CommandError(f"Markdown file does not exist: {md_path}")

        dry_run = options["dry_run"]
        do_enrich = options["enrich"]
        upload_assets = not options["no_upload_assets"]
        is_publish = options["publish"]

        start_time = time.time()
        self.stdout.write(self.style.NOTICE(f"\n======================================================="))
        self.stdout.write(self.style.NOTICE(f">>> [ExamIntel 10/10 Ingestion] Ingesting '{md_path.name}'"))
        self.stdout.write(self.style.NOTICE(f"    Mode: {'DRY RUN' if dry_run else 'LIVE DATABASE INGESTION'}"))
        self.stdout.write(self.style.NOTICE(f"    Enrichment LLM: {'ENABLED' if do_enrich else 'HEURISTIC FAST PATH'}"))
        self.stdout.write(self.style.NOTICE(f"    Object Storage Upload: {'ENABLED' if upload_assets else 'SKIPPED'}"))
        self.stdout.write(self.style.NOTICE(f"======================================================="))

        # Stage 1: Parse Markdown
        self.stdout.write(self.style.HTTP_INFO("\n[1/6] Parsing Markdown structure..."))
        parsed_doc = MarkdownExamParser.parse_file(md_path)
        self.stdout.write(self.style.SUCCESS(f"    [+] Parsed Title: '{parsed_doc.title}'"))
        self.stdout.write(self.style.SUCCESS(f"    [+] Total Questions: {len(parsed_doc.questions)} across {len(parsed_doc.sections)} sections"))

        if not parsed_doc.questions:
            raise CommandError("No questions could be parsed from the markdown file.")

        from django.utils.text import slugify

        exam_title = options.get("title") or parsed_doc.title
        raw_slug = options.get("slug")
        if not raw_slug:
            parent_name = md_path.parent.name
            if parent_name in ("2025_refined", "output", "refined", "output_refined", "downloads"):
                raw_slug = slugify(exam_title)
            else:
                raw_slug = parent_name
        exam_slug = raw_slug
        base_dir = md_path.parent

        is_ssc = "cgl" in exam_slug.lower() or "ssc" in exam_slug.lower() or "cgl" in exam_title.lower()
        pos_marks = 2.0 if is_ssc else 2.5
        neg_marks = 0.5 if is_ssc else 0.0

        # Stage 2: Visual Asset & Object Storage Ingestion
        if upload_assets:
            self.stdout.write(self.style.HTTP_INFO("\n[2/6] Ingesting visual assets into Object Storage (CDN)..."))
            url_map = AssetStorageAgent.ingest_exam_assets(exam_slug, base_dir, parsed_doc.questions)
            self.stdout.write(self.style.SUCCESS(f"    [+] Uploaded & mapped {len(url_map)} assets to public CDN URLs."))
        else:
            self.stdout.write(self.style.HTTP_INFO("\n[2/6] Asset upload skipped (--no-upload-assets specified)."))

        # Stage 3: Bilingual Separation Agent
        self.stdout.write(self.style.HTTP_INFO("\n[3/6] Running Bilingual Separation Agent..."))
        bilingual_payloads = []
        lang_counts = {"en": 0, "hi": 0, "bilingual": 0}
        for q in parsed_doc.questions:
            bi = BilingualAgent.process_question(q)
            bilingual_payloads.append(bi)
            lang_counts[bi.language] = lang_counts.get(bi.language, 0) + 1

        self.stdout.write(self.style.SUCCESS(
            f"    [+] Language profiles: {lang_counts.get('hi', 0)} Hindi, "
            f"{lang_counts.get('en', 0)} English, {lang_counts.get('bilingual', 0)} Bilingual."
        ))

        # Stage 4: Academic & Tutor Agent
        self.stdout.write(self.style.HTTP_INFO("\n[4/6] Running Academic Classification & Tutor Agent..."))
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
            self.stdout.write(self.style.HTTP_INFO("    [*] Calling Gemini 2.5 Flash for academic intelligence & tutor hints..."))
            enriched_academic_data = academic_agent.enrich_questions_batch(questions_to_enrich, batch_size=15)
        else:
            self.stdout.write(self.style.HTTP_INFO("    [*] Generating fast deterministic academic metadata..."))
            enriched_academic_data = [academic_agent.generate_heuristics_enrichment(it) for it in questions_to_enrich]

        self.stdout.write(self.style.SUCCESS(f"    [+] Successfully enriched {len(enriched_academic_data)} questions."))

        # Stage 5: Canonical V2 Assembler
        self.stdout.write(self.style.HTTP_INFO("\n[5/6] Assembling Canonical V2 Schema (schemamix.json compliant)..."))
        canonical_questions = []
        for idx, q in enumerate(parsed_doc.questions):
            bi = bilingual_payloads[idx]
            acad = enriched_academic_data[idx]
            v2_q = CanonicalV2Assembler.assemble_question(
                parsed_q=q,
                bilingual_data=bi,
                academic_data=acad,
                exam_name=exam_title,
                year=2022 if "2022" in exam_title else 2021,
                shift="Shift 1",
                positive_marks=pos_marks,
                negative_marks=neg_marks,
                exam_slug=exam_slug,
            )
            canonical_questions.append(v2_q)

        # Output JSON artifact
        json_out_path = options["output_json"] or (base_dir / "canonical_v2_exam.json")
        canonical_payloads = CanonicalV2Assembler.assemble_exam_package(canonical_questions, output_file=json_out_path)
        self.stdout.write(self.style.SUCCESS(f"    [+] Emitted canonical V2 JSON: {json_out_path} ({len(canonical_payloads)} questions)"))

        # Stage 6: Database Ingestion
        if not dry_run:
            self.stdout.write(self.style.HTTP_INFO("\n[6/6] Persisting atomically into Django PostgreSQL / SQLite..."))
            exam = DBIngestionService.ingest_canonical_exam(
                exam_title=exam_title,
                canonical_questions=canonical_payloads,
                exam_slug=exam_slug,
                positive_marks=pos_marks,
                negative_marks=neg_marks,
                is_active=is_publish,
            )
            self.stdout.write(self.style.SUCCESS(
                f"\n🎉 EXAM INGESTION COMPLETE!\n"
                f"    Exam ID:        {exam.id}\n"
                f"    Title:          {exam.title}\n"
                f"    Slug:           {exam.slug}\n"
                f"    Questions:      {exam.total_questions}\n"
                f"    Total Marks:    {exam.total_marks}\n"
                f"    Status:         {'Active / Published' if exam.is_active else 'Draft'}\n"
                f"    Time Elapsed:   {time.time() - start_time:.2f}s\n"
            ))
        else:
            self.stdout.write(self.style.WARNING(
                f"\n[DRY RUN COMPLETE] Validated {len(canonical_payloads)} questions. Database was not modified.\n"
                f"    Time Elapsed: {time.time() - start_time:.2f}s\n"
            ))
