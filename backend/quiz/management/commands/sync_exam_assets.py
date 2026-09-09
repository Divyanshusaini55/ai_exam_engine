from __future__ import annotations
import json
import logging
import os
os.environ["PYDANTIC_DISABLE_PLUGINS"] = "1"
import re
from pathlib import Path
from typing import Optional, Dict, Any, List

from django.core.management.base import BaseCommand, CommandError
from django.conf import settings
from django.utils.text import slugify

from quiz.models import Exam, Question
from quiz.ai.examintel.asset_storage_agent import AssetStorageAgent
from quiz.ai.examintel.llm_refiner import sanitize_option_text

logger = logging.getLogger("quiz.management.sync_exam_assets")


class Command(BaseCommand):
    help = (
        "Synchronizes visual assets (diagrams and option images) for exams to Cloudflare R2 / S3 "
        "Object Storage, updates schema_payload with permanent CDN URLs, and repairs leaked comprehension passages."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--exam-id",
            type=int,
            help="Database ID of a specific exam to sync (e.g. 17 or 18).",
        )
        parser.add_argument(
            "--slug",
            type=str,
            help="Slug of a specific exam to sync.",
        )
        parser.add_argument(
            "--all",
            action="store_true",
            default=False,
            help="Sync assets and repair all exams in the database.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            default=False,
            help="Simulate the sync without uploading assets or updating the database.",
        )
        parser.add_argument(
            "--fix-comprehension",
            action="store_true",
            default=True,
            help="Extract and repair reading comprehension passages leaked into option text.",
        )

    def handle(self, *args, **options):
        exam_id = options.get("exam_id")
        slug = options.get("slug")
        sync_all = options.get("all")
        dry_run = options.get("dry_run")
        fix_comprehension = options.get("fix_comprehension")

        if not exam_id and not slug and not sync_all:
            raise CommandError("Please specify --exam-id, --slug, or --all.")

        if exam_id:
            exams = Exam.objects.filter(id=exam_id)
        elif slug:
            exams = Exam.objects.filter(slug=slug)
        else:
            exams = Exam.objects.all().order_by("id")

        if not exams.exists():
            self.stdout.write(self.style.WARNING("No matching exams found."))
            return

        self.stdout.write(
            self.style.SUCCESS(f"Starting asset synchronization for {exams.count()} exam(s)...")
        )

        total_synced_assets = 0
        total_repaired_questions = 0

        for exam in exams:
            self.stdout.write(f"\n=======================================================")
            self.stdout.write(f"Processing Exam #{exam.id}: '{exam.title}' (slug: {exam.slug})")
            self.stdout.write(f"=======================================================")

            # 1. Locate local asset directory
            candidates = [
                Path(settings.MEDIA_ROOT) / "exam_assets" / exam.slug,
                Path(settings.MEDIA_ROOT) / "exam_assets" / exam.slug.lower(),
                Path(settings.MEDIA_ROOT) / "exam_assets" / slugify(exam.title),
            ]
            # Also check if any existing directory has similar name
            exam_assets_root = Path(settings.MEDIA_ROOT) / "exam_assets"
            if exam_assets_root.exists():
                for d in exam_assets_root.glob("*"):
                    if d.is_dir() and (d.name.lower() in exam.slug.lower() or exam.slug.lower() in d.name.lower()):
                        candidates.append(d)

            base_dir = None
            for cand in candidates:
                if cand.exists() and (cand / "assets").exists():
                    base_dir = cand
                    break
                elif cand.exists():
                    base_dir = cand

            if not base_dir:
                base_dir = Path(settings.MEDIA_ROOT) / "exam_assets" / exam.slug

            self.stdout.write(f"  [+] Assets Directory: {base_dir}")

            # 2. Check for stage artifacts that may have raw option image paths
            stage_questions_map: Dict[str, Dict[str, Any]] = {}
            stage_files = [
                base_dir / "pipeline_stages" / "canonical_v2_exam.json",
                base_dir / "pipeline_stages" / "stage8_canonical_v2_payloads.json",
                base_dir / "pipeline_stages" / "stage5_katex_vision_refined.json",
                base_dir / "pipeline_stages" / "stage1_raw_extracted.json",
            ]
            for sf in stage_files:
                if sf.exists():
                    try:
                        with open(sf, "r", encoding="utf-8") as f:
                            s_data = json.load(f)
                            items = s_data if isinstance(s_data, list) else s_data.get("questions", [])
                            for itm in items:
                                if isinstance(itm, dict):
                                    q_num = str(itm.get("question_number") or itm.get("id") or "")
                                    if q_num and q_num not in stage_questions_map:
                                        stage_questions_map[q_num] = itm
                    except Exception as e:
                        logger.warning(f"Failed to read stage artifact '{sf}': {e}")

            # 3. Retrieve all questions for this exam
            questions = list(exam.questions.all().order_by("id"))
            if not questions:
                self.stdout.write(self.style.WARNING("  [!] Exam has no associated questions."))
                continue

            self.stdout.write(f"  [+] Found {len(questions)} question(s) in database.")

            # 4. Prepare question payloads for AssetStorageAgent
            payloads = []
            modified_questions = []

            pending_passage: Optional[str] = None

            for idx, q in enumerate(questions):
                p = dict(q.schema_payload or {})
                was_modified = False

                # Recover missing option images from stage files if DB had None
                q_num_key = str(p.get("question_number") or idx + 1)
                stage_itm = stage_questions_map.get(q_num_key)
                if stage_itm and isinstance(stage_itm.get("options"), list):
                    db_opts = p.get("options", [])
                    stage_opts = stage_itm["options"]
                    for o_idx, opt in enumerate(db_opts):
                        if isinstance(opt, dict) and not opt.get("image_url"):
                            if o_idx < len(stage_opts) and isinstance(stage_opts[o_idx], dict):
                                s_img = stage_opts[o_idx].get("image_url") or stage_opts[o_idx].get("option_image_path")
                                if s_img:
                                    opt["image_url"] = s_img
                                    was_modified = True

                # Comprehension passage repair
                if fix_comprehension:
                    leaked_here = False
                    for opt in p.get("options", []):
                        if isinstance(opt, dict):
                            opt_text = opt.get("answer_text") or opt.get("text") or ""
                            comp_match = re.search(
                                r"(?im)(?:^|\n\s*|\s+)(Comprehension\s*:[\s\S]+|Directions\s*(?:\([^\)]*\))?\s*:[\s\S]+|Case\s*Study\s*-\s*\d+\s*to\s*\d+[\s\S]+)",
                                opt_text,
                            )
                            if comp_match:
                                extracted_passage = comp_match.group(1).strip()
                                pending_passage = extracted_passage
                                leaked_here = True
                                clean_txt = sanitize_option_text(opt_text, has_image=bool(opt.get("image_url")))
                                if "text" in opt:
                                    opt["text"] = clean_txt
                                if "answer_text" in opt:
                                    opt["answer_text"] = clean_txt
                                was_modified = True
                                self.stdout.write(
                                    self.style.NOTICE(
                                        f"    [*] Question #{idx + 1}: Extracted leaked comprehension passage ({len(extracted_passage)} chars) from Option {opt.get('id')}."
                                    )
                                )

                    # Only attach shared_context if question didn't leak the passage itself,
                    # and question is a blank / sub-question
                    if pending_passage and not leaked_here:
                        q_text = p.get("question_text") or (p.get("content") or {}).get("text", "")
                        is_sub_q = bool(
                            re.search(r"(?:blank\s*(?:no\.?|number)?\s*\d+|\(\s*\d+\s*\)\s*______|\bpassage\b|select\s+the\s+most\s+appropriate\s+option\s+to\s+fill)", q_text, re.IGNORECASE)
                        )
                        if is_sub_q and not p.get("shared_context"):
                            p["shared_context"] = pending_passage
                            was_modified = True
                            self.stdout.write(
                                f"    [+] Question #{idx + 1}: Attached shared_context passage."
                            )

                payloads.append(p)
                modified_questions.append((q, p, was_modified))

            # Second pass: if pending_passage was extracted, attach to any blank-numbered questions
            # across the exam that are still missing shared_context
            if pending_passage and fix_comprehension:
                for idx, (q, p, was_mod) in enumerate(modified_questions):
                    q_text = p.get("question_text") or (p.get("content") or {}).get("text", "")
                    if re.search(r"(?:blank\s*(?:no\.?|number)?\s*\d+|select\s+the\s+most\s+appropriate\s+option\s+to\s+fill\s+in\s+blank)", q_text, re.IGNORECASE):
                        if not p.get("shared_context"):
                            p["shared_context"] = pending_passage
                            modified_questions[idx] = (q, p, True)
                            self.stdout.write(
                                f"    [+] Second pass Question #{idx + 1}: Attached shared_context passage to blank sub-question."
                            )

            # 5. Ingest all assets to Object Storage
            if not dry_run:
                self.stdout.write("  [*] Uploading assets to Object Storage (R2/S3)...")
                try:
                    url_map = AssetStorageAgent.ingest_exam_assets(
                        exam_slug=exam.slug,
                        base_dir=base_dir,
                        questions=payloads,
                    )
                    self.stdout.write(
                        self.style.SUCCESS(f"  [+] Ingested and mapped {len(url_map)} asset(s).")
                    )
                    total_synced_assets += len(url_map)
                except Exception as e:
                    self.stdout.write(self.style.ERROR(f"  [!] AssetStorageAgent error: {e}"))

            # 6. Save updated schema_payloads back to database using fast bulk_update
            questions_to_update = []
            for q, p, was_mod in modified_questions:
                if was_mod or not dry_run:
                    q.schema_payload = p
                    questions_to_update.append(q)

            if questions_to_update and not dry_run:
                self.stdout.write(f"  [*] Bulk updating {len(questions_to_update)} question(s) in database...")
                Question.objects.bulk_update(questions_to_update, ["schema_payload"], batch_size=50)
                try:
                    from cache import clear_exam_cache
                    clear_exam_cache(exam.id)
                    if exam.slug:
                        clear_exam_cache(exam.slug)
                except Exception:
                    pass

            self.stdout.write(
                self.style.SUCCESS(f"  [✓] Updated schema_payload for {len(questions_to_update)} questions in Exam #{exam.id}.")
            )
            total_repaired_questions += len(questions_to_update)

        self.stdout.write(f"\n=======================================================")
        self.stdout.write(
            self.style.SUCCESS(
                f"🎉 Asset Synchronization Complete!\n"
                f"    Total Assets Ingested: {total_synced_assets}\n"
                f"    Total Questions Updated: {total_repaired_questions}"
            )
        )
        self.stdout.write(f"=======================================================")
