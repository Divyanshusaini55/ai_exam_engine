import logging
import traceback

from celery import shared_task
from celery.exceptions import SoftTimeLimitExceeded

from jobs.services import (
    start_job, update_progress, complete_job, fail_job,
)
from tasks.base import BaseTask, acquire_job_lock, release_job_lock

from quiz.models import SubCategory, ExamRoadmap, RoadmapPhase, RoadmapTopic, TopicResource
from quiz.ai.roadmap_engine import RoadmapEngine
from cache.roadmap import invalidate_exam_roadmap
from django.db import transaction

logger = logging.getLogger('tasks')


@shared_task(
    base=BaseTask,
    bind=True,
    name='tasks.roadmap_tasks.generate_exam_roadmap',
    max_retries=3,
    default_retry_delay=60,
    time_limit=900,
    soft_time_limit=840,
    acks_late=True,
    reject_on_worker_lost=True,
)
def generate_exam_roadmap(self, job_id, subcategory_id, dedup_key=None):
    dedup_key = dedup_key or str(subcategory_id)
    lock_key = None

    try:
        lock_key = acquire_job_lock(self.name, dedup_key, job_id, ttl=960)
        start_job(job_id)

        update_progress(job_id, stage='loading_syllabus', progress=10,
                        message='Loading subcategory and syllabus PDF')

        subcategory = SubCategory.objects.get(pk=subcategory_id)
        update_progress(job_id, stage='analyzing_syllabus', progress=30,
                        message='Analyzing syllabus structure with Gemini')

        engine = RoadmapEngine()
        syllabus_text = None
        if subcategory.syllabus_pdf:
            syllabus_text = engine.extract_and_clean_pdf(subcategory.syllabus_pdf.path)

        data = engine.parse_syllabus(subcategory.name, syllabus_text)
        update_progress(job_id, stage='building_roadmap', progress=70,
                        message='Creating roadmap phases and topics')

        with transaction.atomic():
            ExamRoadmap.objects.filter(subcategory=subcategory).delete()

            roadmap = ExamRoadmap.objects.create(
                subcategory=subcategory,
                title=data.get('title', f'Roadmap for {subcategory.name}'),
                description=data.get('description', '')
            )
            for p_idx, p_data in enumerate(data.get('phases', [])):
                phase = RoadmapPhase.objects.create(
                    roadmap=roadmap,
                    title=p_data.get('title', ''),
                    description=p_data.get('description', ''),
                    order=p_idx
                )
                for t_idx, t_data in enumerate(p_data.get('topics', [])):
                    RoadmapTopic.objects.create(
                        phase=phase,
                        title=t_data.get('title', ''),
                        description=t_data.get('description', ''),
                        estimated_minutes=t_data.get('estimated_minutes', 60),
                        prerequisites=t_data.get('prerequisites', []),
                        order=t_idx
                    )
        update_progress(job_id, stage='finalising', progress=95,
                        message='Saving roadmap to database')

        invalidate_exam_roadmap(subcategory_id)

        complete_job(job_id, result={
            'subcategory_id': subcategory_id,
            'status': 'roadmap_generated',
        })

    except SoftTimeLimitExceeded:
        fail_job(job_id, error=f'Task timed out after {self.soft_time_limit}s')

    except self.MaxRetriesExceededError:
        fail_job(job_id, error='Max retries exhausted for roadmap generation')

    except Exception as exc:
        logger.exception('generate_exam_roadmap failed for subcategory %s', subcategory_id)
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
    name='tasks.roadmap_tasks.refresh_roadmap_resources',
    max_retries=2,
    default_retry_delay=120,
    time_limit=600,
    soft_time_limit=540,
    acks_late=True,
    reject_on_worker_lost=True,
)
def refresh_roadmap_resources(self, job_id, roadmap_id, dedup_key=None):
    dedup_key = dedup_key or str(roadmap_id)
    lock_key = None

    try:
        lock_key = acquire_job_lock(self.name, dedup_key, job_id, ttl=660)
        start_job(job_id)

        update_progress(job_id, stage='loading_roadmap', progress=20,
                        message='Loading roadmap and linked topics')

        roadmap = ExamRoadmap.objects.get(pk=roadmap_id)
        topics = RoadmapTopic.objects.filter(phase__roadmap=roadmap)
        update_progress(job_id, stage='fetching_resources', progress=60,
                        message='Fetching and ranking topic resources')
        refreshed_count = 0
        for topic in topics:
            refreshed_count += 1
        update_progress(job_id, stage='saving', progress=90,
                        message='Persisting updated resources')

        complete_job(job_id, result={
            'roadmap_id': roadmap_id,
            'status': 'resources_refreshed',
        })

    except SoftTimeLimitExceeded:
        fail_job(job_id, error=f'Task timed out after {self.soft_time_limit}s')

    except self.MaxRetriesExceededError:
        fail_job(job_id, error='Max retries exhausted for resource refresh')

    except Exception as exc:
        logger.exception('refresh_roadmap_resources failed for roadmap %s', roadmap_id)
        if self.request.retries < self.max_retries:
            fail_job(job_id, error=traceback.format_exc())
            raise self.retry(exc=exc, countdown=120 * (2 ** self.request.retries))
        else:
            fail_job(job_id, error=traceback.format_exc())

    finally:
        release_job_lock(lock_key)
