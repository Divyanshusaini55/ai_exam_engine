from __future__ import annotations
import re
import uuid
import logging
from typing import List, Dict, Any, Optional
from django.db import transaction
from django.utils.text import slugify

from quiz.models import Exam, Question, ExamQuestion, QuestionImage, Category, SubCategory

logger = logging.getLogger("quiz.ai.examintel.db_ingestion_service")


class DBIngestionService:
    """
    Seamless Database Ingestion Service for Canonical V2 Exam Payloads.
    Performs atomic persistence into Exam, Question (JSONB schema_payload),
    and ExamQuestion tables with complete referential integrity.
    """

    @classmethod
    def ingest_canonical_exam(
        cls,
        exam_title: str,
        canonical_questions: List[Dict[str, Any]],
        exam_slug: Optional[str] = None,
        category_name: Optional[str] = None,
        subcategory_name: Optional[str] = None,
        duration_minutes: int = 120,
        positive_marks: float = 2.5,
        negative_marks: float = 0.0,
        is_active: bool = True,
    ) -> Exam:
        """
        Atomically persists the exam and all canonical v2 questions into the database.
        """
        slug = (exam_slug or slugify(exam_title)).lower()
        if not slug:
            slug = f"exam-{uuid.uuid4().hex[:8]}"

        with transaction.atomic():
            # 1. Resolve or create Category & SubCategory
            category = None
            subcategory = None
            if subcategory_name:
                cat_name = category_name or "Competitive Exams"
                cat_slug = slugify(cat_name)
                category = Category.objects.filter(slug=cat_slug).first()
                if not category:
                    category = Category.objects.create(name=cat_name, slug=cat_slug, order=1)

                sub_slug = slugify(subcategory_name)
                subcategory = SubCategory.objects.filter(slug=sub_slug).first()
                if not subcategory:
                    subcategory = SubCategory.objects.create(name=subcategory_name, category=category, slug=sub_slug, order=1)
            else:
                # Infer from title (e.g. "UP Police SI", "SSC CGL", "RRB NTPC")
                inferred_sub = "General Exams"
                inferred_cat = "Competitive Exams"
                if "police" in exam_title.lower():
                    inferred_cat = "Police Exams"
                    inferred_sub = "UP Police SI" if "up" in exam_title.lower() else "Police SI"
                elif "cgl" in exam_title.lower() or "ssc" in exam_title.lower():
                    inferred_cat = "SSC"
                    inferred_sub = "SSC CGL"
                elif "rrb" in exam_title.lower() or "railway" in exam_title.lower():
                    inferred_cat = "Railway Exams"
                    inferred_sub = "RRB NTPC"

                cat_slug = slugify(inferred_cat)
                category = Category.objects.filter(slug=cat_slug).first()
                if not category:
                    category = Category.objects.create(name=inferred_cat, slug=cat_slug, order=1)

                sub_slug = slugify(inferred_sub)
                subcategory = SubCategory.objects.filter(slug=sub_slug).first()
                if not subcategory:
                    subcategory = SubCategory.objects.create(name=inferred_sub, category=category, slug=sub_slug, order=1)

            # 2. Create or update Exam
            exam, created = Exam.objects.update_or_create(
                slug=slug,
                defaults={
                    "title": exam_title,
                    "subcategory": subcategory,
                    "duration_minutes": duration_minutes,
                    "marks_per_question": positive_marks,
                    "negative_marks": negative_marks,
                    "total_questions": len(canonical_questions),
                    "total_marks": int(positive_marks * len(canonical_questions)),
                    "is_active": is_active,
                    "status": "published" if is_active else "draft",
                }
            )

            action_str = "Created new" if created else "Updated existing"
            logger.info(f"{action_str} Exam: '{exam.title}' (ID: {exam.id}, Slug: {exam.slug})")

            clean_slug = re.sub(r"[^a-zA-Z0-9_]", "_", slug.lower()).strip("_")[:28]

            # 3. Fast Bulk Upsert Questions (single atomic SQL statement)
            q_objects_map = {}
            for idx, q_data in enumerate(canonical_questions):
                q_id = q_data.get("id") or f"q_{clean_slug}_{idx+1:04d}"
                q_type = q_data.get("question_type", "mcq_single")
                q_topic = (q_data.get("classification") or {}).get("topic", "")
                q_origin = q_data.get("origin", "pyq_extracted")
                q_verified = (q_data.get("verification") or {}).get("verified", True)

                q_objects_map[q_id] = Question(
                    id=q_id,
                    schema_version="v2",
                    origin=q_origin,
                    question_type=q_type,
                    topic=q_topic,
                    schema_payload=q_data,
                    verified=q_verified,
                )

            # Bulk upsert all questions in a single query
            Question.objects.bulk_create(
                list(q_objects_map.values()),
                update_conflicts=True,
                update_fields=["schema_version", "origin", "question_type", "topic", "schema_payload", "verified"],
                unique_fields=["id"],
            )

            # 4. Link questions to Exam (clean sequential ordering, avoiding cross-contamination)
            ExamQuestion.objects.filter(exam=exam).delete()
            questions_to_link = []
            images_to_create = []
            for idx, q_data in enumerate(canonical_questions):
                q_id = q_data.get("id") or f"q_{clean_slug}_{idx+1:04d}"
                q_obj = q_objects_map[q_id]
                questions_to_link.append(ExamQuestion(exam=exam, question=q_obj, order=idx))

                content_imgs = (q_data.get("content") or {}).get("images") or {}
                for img_key, img_info in content_imgs.items():
                    if isinstance(img_info, dict) and img_info.get("url"):
                        images_to_create.append(
                            QuestionImage(question=q_obj, ocr_text=img_info.get("url", ""))
                        )

            if questions_to_link:
                ExamQuestion.objects.bulk_create(questions_to_link)
            logger.info(f"Successfully ensured {len(canonical_questions)} questions linked to Exam '{exam.title}'")

            # Bulk create QuestionImage records if any
            if images_to_create:
                try:
                    QuestionImage.objects.bulk_create(images_to_create)
                except Exception as e:
                    logger.debug(f"QuestionImage creation note: {e}")

            return exam
