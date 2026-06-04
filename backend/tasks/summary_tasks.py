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

logger = logging.getLogger('tasks')


@shared_task(
    base=BaseTask,
    bind=True,
    name='tasks.summary_tasks.generate_exam_summary',
    max_retries=3,
    default_retry_delay=60,
    time_limit=600,
    soft_time_limit=540,
    acks_late=True,
    reject_on_worker_lost=True,
)
def generate_exam_summary(self, job_id, exam_id, dedup_key=None):
    dedup_key = dedup_key or str(exam_id)
    lock_key = None

    try:
        lock_key = acquire_job_lock(self.name, dedup_key, job_id, ttl=660)
        start_job(job_id)

        update_progress(job_id, stage='loading_exam', progress=10,
                        message='Loading exam questions and answers')

        exam = Exam.objects.get(pk=exam_id)
        update_progress(job_id, stage='generating_summary', progress=30,
                        message='Generating AI summary with Gemini')

        service = ExamSummaryService()
        summary_text = service.generate_summary(exam)

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
    dedup_key = dedup_key or str(topic_id)
    lock_key = None

    try:
        lock_key = acquire_job_lock(self.name, dedup_key, job_id, ttl=360)
        start_job(job_id)
        update_progress(job_id, stage='loading', progress=10,
                        message='Loading topic data')

        question = Question.objects.get(pk=topic_id)
        update_progress(job_id, stage='generating', progress=30,
                        message='Generating explanation via Gemini')

        from quiz.ai import generate_explanation_for_question
        explanation = generate_explanation_for_question(question)
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
