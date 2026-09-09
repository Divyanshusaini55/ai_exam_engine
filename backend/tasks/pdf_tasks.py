import logging
import traceback

from celery import shared_task
from celery.exceptions import SoftTimeLimitExceeded

from jobs.services import (
    start_job, update_progress, complete_job, fail_job,
)
from tasks.base import BaseTask, acquire_job_lock, release_job_lock

from quiz.models import QuestionPaperUpload, SubCategory
from quiz.ai import parse_exam_paper_with_ai

logger = logging.getLogger('tasks')


@shared_task(
    base=BaseTask,
    bind=True,
    name='tasks.pdf_tasks.parse_question_paper',
    max_retries=3,
    default_retry_delay=60,
    time_limit=600,        
    soft_time_limit=540,
    acks_late=True,
    reject_on_worker_lost=True,
)
def parse_question_paper(self, job_id, upload_id, dedup_key=None):
    dedup_key = dedup_key or str(upload_id)
    lock_key = None

    try:
        lock_key = acquire_job_lock(self.name, dedup_key, job_id, ttl=660)
        start_job(job_id)
        update_progress(job_id, stage='loading_pdf', progress=10,
                        message='Reading and extracting text from PDF')

        upload = QuestionPaperUpload.objects.get(pk=upload_id)
        update_progress(job_id, stage='parsing', progress=20,
                        message='Parsing PDF')
        update_progress(job_id, stage='extracting_questions', progress=50,
                        message='Extracting questions via Gemini')
        
        update_progress(job_id, stage='saving', progress=85,
                        message='Saving questions to database')
                        
        from quiz.models import Exam
        from quiz.ai.examintel.pipeline_monitor import is_pipeline_aborted, set_pipeline_stage, PipelineStage
        
        if is_pipeline_aborted(job_id):
            logger.info(f"parse_question_paper: job {job_id} aborted before start.")
            fail_job(job_id, error="Task aborted by user.")
            return

        exam = None
        try:
            from jobs.models import BackgroundJob
            bjob = BackgroundJob.objects.filter(pk=job_id).first()
            if bjob and bjob.payload and bjob.payload.get('exam_id'):
                exam = Exam.objects.filter(pk=bjob.payload['exam_id']).first()
        except Exception as e:
            logger.warning(f"Could not retrieve target exam from job payload: {e}")

        if exam:
            if upload.file:
                exam.pdf_file = upload.file
                exam.save(update_fields=['pdf_file'])
        else:
            exam = Exam.objects.create(
                title=f"{upload.subject} ({upload.exam_date})",
                pdf_file=upload.file,
                status='draft'
            )
        count = parse_exam_paper_with_ai(exam, run_id=job_id)
        
        if is_pipeline_aborted(job_id):
            logger.info(f"parse_question_paper: job {job_id} aborted during execution.")
            fail_job(job_id, error="Task aborted by user.")
            return

        upload.status = 'processed'
        upload.save(update_fields=['status'])

        # Trigger async background translation to Hindi if missing
        try:
            from quiz.ai import auto_translate_exam_to_hindi
            auto_translate_exam_to_hindi(exam)
        except Exception as e:
            logger.warning(f"Background translation to Hindi failed: {e}")

        complete_job(job_id, result={
            'upload_id': upload_id,
            'exam_id': exam.id,
            'questions_created': count,
            'status': 'questions_extracted',
        })

    except SoftTimeLimitExceeded:
        fail_job(job_id, error=f'Task timed out after {self.soft_time_limit}s')

    except self.MaxRetriesExceededError:
        fail_job(job_id, error='Max retries exhausted for PDF parsing')

    except Exception as exc:
        logger.exception('parse_question_paper failed for upload %s', upload_id)
        if self.request.retries < self.max_retries:
            fail_job(job_id, error=traceback.format_exc())
            raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))
        else:
            fail_job(job_id, error=traceback.format_exc())

    finally:
        release_job_lock(lock_key)


@shared_task(
    base=BaseTask,
    bind=True,
    name='tasks.pdf_tasks.parse_syllabus_pdf',
    max_retries=3,
    default_retry_delay=60,
    time_limit=600,
    soft_time_limit=540,
    acks_late=True,
    reject_on_worker_lost=True,
)
def parse_syllabus_pdf(self, job_id, subcategory_id, dedup_key=None):
    dedup_key = dedup_key or str(subcategory_id)
    lock_key = None

    try:
        lock_key = acquire_job_lock(self.name, dedup_key, job_id, ttl=660)
        start_job(job_id)
        update_progress(job_id, stage='loading_pdf', progress=10,
                        message='Reading syllabus PDF')

        subcategory = SubCategory.objects.get(pk=subcategory_id)
        update_progress(job_id, stage='parsing', progress=20,
                        message='Extracting topic structure via Gemini')

        from quiz.ai.roadmap_engine import RoadmapEngine
        engine = RoadmapEngine()
        syllabus_text = None
        if subcategory.syllabus_pdf:
            syllabus_text = engine.extract_and_clean_pdf(subcategory.syllabus_pdf.path)

        data = engine.parse_syllabus(subcategory.name, syllabus_text)
        update_progress(job_id, stage='saving', progress=90,
                        message='Saving topic structure')

        complete_job(job_id, result={
            'subcategory_id': subcategory_id,
            'status': 'syllabus_parsed',
        })

    except SoftTimeLimitExceeded:
        fail_job(job_id, error=f'Task timed out after {self.soft_time_limit}s')

    except self.MaxRetriesExceededError:
        fail_job(job_id, error='Max retries exhausted for syllabus parsing')

    except Exception as exc:
        logger.exception('parse_syllabus_pdf failed for subcategory %s', subcategory_id)
        if self.request.retries < self.max_retries:
            fail_job(job_id, error=traceback.format_exc())
            raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))
        else:
            fail_job(job_id, error=traceback.format_exc())

    finally:
        release_job_lock(lock_key)
