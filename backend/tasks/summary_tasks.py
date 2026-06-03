"""
Summary tasks — exam summary generation.

Routes to queue: ``normal``

These tasks wrap the existing summary pipeline in
``quiz.ai.summary_service`` / ``quiz.ai.summary_pipeline``.
They do NOT contain business logic — only job lifecycle management.
"""

import logging
import traceback

from celery import shared_task
from celery.exceptions import SoftTimeLimitExceeded

from jobs.services import (
    start_job, update_progress, complete_job, fail_job,
)
from tasks.base import BaseTask, acquire_job_lock, release_job_lock

from quiz.models import Exam, Question
from quiz.ai.summary_service import ExamSummaryService
from cache.summary import invalidate_exam_summary

# TODO: Add explanation service import when available
# from quiz.ai... import ...

logger = logging.getLogger('tasks')


@shared_task(
    base=BaseTask,
    bind=True,
    name='tasks.summary_tasks.generate_exam_summary',
    max_retries=3,
    default_retry_delay=60,
    time_limit=600,           # Summaries can be long — 10 min hard limit
    soft_time_limit=540,      # 9 min soft limit
    acks_late=True,
    reject_on_worker_lost=True,
)
def generate_exam_summary(self, job_id, exam_id, dedup_key=None):
    """
    Generate an AI summary for an exam.

    Args:
        job_id:     BackgroundJob UUID (str).
        exam_id:    PK of the Exam to summarise.
        dedup_key:  Dedup key (defaults to exam_id).
    """
    dedup_key = dedup_key or str(exam_id)
    lock_key = None

    try:
        lock_key = acquire_job_lock(self.name, dedup_key, job_id, ttl=660)
        start_job(job_id)

        # ── Stage 1: Load exam data ─────────────────────────────────
        update_progress(job_id, stage='loading_exam', progress=10,
                        message='Loading exam questions and answers')

        exam = Exam.objects.get(pk=exam_id)

        # ── Stage 2: Generating summary via AI ──────────────────────
        update_progress(job_id, stage='generating_summary', progress=30,
                        message='Generating AI summary with Gemini')

        service = ExamSummaryService()
        # generate_summary saves the result to exam.ai_summary internally
        summary_text = service.generate_summary(exam)

        # ── Stage 3: Saving results ─────────────────────────────────
        update_progress(job_id, stage='saving', progress=80,
                        message='Saving summary to database')

        invalidate_exam_summary(exam_id)

        complete_job(job_id, result={'exam_id': exam_id, 'status': 'summary_generated'})

    except SoftTimeLimitExceeded:
        fail_job(job_id, error=f'Task timed out after {self.soft_time_limit}s')

    except self.MaxRetriesExceededError:
        fail_job(job_id, error='Max retries exhausted for exam summary generation')

    except Exception as exc:
        logger.exception('generate_exam_summary failed for exam %s', exam_id)
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
    name='tasks.summary_tasks.generate_topic_explanation',
    max_retries=3,
    default_retry_delay=60,
    time_limit=300,
    soft_time_limit=270,
    acks_late=True,
    reject_on_worker_lost=True,
)
def generate_topic_explanation(self, job_id, topic_id, dedup_key=None):
    """
    Generate an AI explanation for a topic / question.

    Args:
        job_id:    BackgroundJob UUID (str).
        topic_id:  PK of the topic/question to explain.
        dedup_key: Dedup key (defaults to topic_id).
    """
    dedup_key = dedup_key or str(topic_id)
    lock_key = None

    try:
        lock_key = acquire_job_lock(self.name, dedup_key, job_id, ttl=360)
        start_job(job_id)

        # ── Stage 1: Load topic ─────────────────────────────────────
        update_progress(job_id, stage='loading', progress=10,
                        message='Loading topic data')

        question = Question.objects.get(pk=topic_id)

        # ── Stage 2: AI generation ──────────────────────────────────
        update_progress(job_id, stage='generating', progress=30,
                        message='Generating explanation via Gemini')

        from quiz.ai import generate_explanation_for_question
        explanation = generate_explanation_for_question(question)

        # ── Stage 3: Save ───────────────────────────────────────────
        update_progress(job_id, stage='saving', progress=80,
                        message='Persisting explanation')

        complete_job(job_id, result={'explanation': explanation, 'topic_id': topic_id, 'status': 'explanation_generated'})

    except SoftTimeLimitExceeded:
        fail_job(job_id, error=f'Task timed out after {self.soft_time_limit}s')

    except self.MaxRetriesExceededError:
        fail_job(job_id, error='Max retries exhausted for topic explanation')

    except Exception as exc:
        logger.exception('generate_topic_explanation failed for topic %s', topic_id)
        if self.request.retries < self.max_retries:
            fail_job(job_id, error=traceback.format_exc())
            raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))
        else:
            fail_job(job_id, error=traceback.format_exc())

    finally:
        release_job_lock(lock_key)
