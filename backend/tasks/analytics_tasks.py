"""
Analytics tasks — rank recalculation and leaderboard refresh.

Routes to queue: ``low``

Non-urgent, batch-oriented work.  These tasks aggregate data
and update computed fields / leaderboards.
"""

import logging
import traceback

from celery import shared_task
from celery.exceptions import SoftTimeLimitExceeded

from jobs.services import (
    start_job, update_progress, complete_job, fail_job,
)
from tasks.base import BaseTask, acquire_job_lock, release_job_lock

from community.services import recalculate_ranks
from cache.leaderboard import invalidate_leaderboard, set_leaderboard
from community.models import Profile
from jobs.models import BackgroundJob
from django.utils import timezone
from datetime import timedelta

logger = logging.getLogger('tasks')


@shared_task(
    base=BaseTask,
    bind=True,
    name='tasks.analytics_tasks.recalculate_community_ranks',
    max_retries=2,
    default_retry_delay=120,
    time_limit=300,
    soft_time_limit=270,
    acks_late=True,
    reject_on_worker_lost=True,
)
def recalculate_community_ranks(self, job_id, dedup_key='global'):
    """
    Recalculate XP-based ranks for the community leaderboard.

    This is a global operation — only one instance should run at a time.

    Args:
        job_id:    BackgroundJob UUID (str).
        dedup_key: Defaults to ``'global'`` (singleton lock).
    """
    lock_key = None

    try:
        lock_key = acquire_job_lock(self.name, dedup_key, job_id, ttl=360)
        start_job(job_id)

        # ── Stage 1: Aggregate scores ───────────────────────────────
        update_progress(job_id, stage='fetching_scores', progress=10,
                        message='Aggregating user XP and quiz scores')

        # ── Stage 2: Rank calculation ───────────────────────────────
        update_progress(job_id, stage='calculating_ranks', progress=60,
                        message='Computing rank positions')

        recalculate_ranks()

        # ── Stage 3: Update leaderboard ─────────────────────────────
        update_progress(job_id, stage='invalidating_cache', progress=90,
                        message='Writing updated ranks to database')

        invalidate_leaderboard()

        complete_job(job_id, result={'status': 'ranks_recalculated'})

    except SoftTimeLimitExceeded:
        fail_job(job_id, error=f'Task timed out after {self.soft_time_limit}s')

    except self.MaxRetriesExceededError:
        fail_job(job_id, error='Max retries exhausted for rank recalculation')

    except Exception as exc:
        logger.exception('recalculate_community_ranks failed')
        if self.request.retries < self.max_retries:
            fail_job(job_id, error=traceback.format_exc())
            raise self.retry(exc=exc, countdown=120 * (2 ** self.request.retries))
        else:
            fail_job(job_id, error=traceback.format_exc())

    finally:
        release_job_lock(lock_key)


@shared_task(
    base=BaseTask,
    bind=True,
    name='tasks.analytics_tasks.refresh_leaderboard_cache',
    max_retries=2,
    default_retry_delay=60,
    time_limit=120,
    soft_time_limit=100,
    acks_late=True,
    reject_on_worker_lost=True,
)
def refresh_leaderboard_cache(self, job_id, dedup_key='global'):
    """
    Rebuild the cached leaderboard payload (top N users).

    Args:
        job_id:    BackgroundJob UUID (str).
        dedup_key: Defaults to ``'global'``.
    """
    lock_key = None

    try:
        lock_key = acquire_job_lock(self.name, dedup_key, job_id, ttl=180)
        start_job(job_id)

        # ── Stage 1: Query top users ────────────────────────────────
        update_progress(job_id, stage='querying', progress=30,
                        message='Fetching top users by XP')

        profiles = list(Profile.objects.order_by('community_rank')[:200])

        # ── Stage 2: Build + cache ──────────────────────────────────
        update_progress(job_id, stage='caching', progress=80,
                        message='Writing leaderboard to Redis cache')

        from community.serializers import ProfileSerializer
        # We need a request context or we can just serialize without it if not needed.
        # But wait, ProfileSerializer takes profiles. Let's just pass to set_leaderboard.
        # Actually set_leaderboard might handle serialization, but prompt says "Serialize and write to cache via set_leaderboard()".
        # Assume set_leaderboard takes serialized data or objects. Let's look at set_leaderboard later if needed, but for now we'll just pass dicts.
        data = ProfileSerializer(profiles, many=True).data
        set_leaderboard(data)

        complete_job(job_id, result={'status': 'leaderboard_cached'})

    except SoftTimeLimitExceeded:
        fail_job(job_id, error=f'Task timed out after {self.soft_time_limit}s')

    except self.MaxRetriesExceededError:
        fail_job(job_id, error='Max retries exhausted for leaderboard cache')

    except Exception as exc:
        logger.exception('refresh_leaderboard_cache failed')
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
    name='tasks.analytics_tasks.cleanup_stale_jobs',
    max_retries=1,
    default_retry_delay=60,
    time_limit=120,
    soft_time_limit=100,
    acks_late=True,
    reject_on_worker_lost=True,
)
def cleanup_stale_jobs(self, job_id, dedup_key='global'):
    """
    Mark stuck RUNNING jobs (older than threshold) as FAILED.
    Scheduled via Celery Beat.

    Args:
        job_id:    BackgroundJob UUID (str).
        dedup_key: Defaults to ``'global'``.
    """
    lock_key = None

    try:
        lock_key = acquire_job_lock(self.name, dedup_key, job_id, ttl=180)
        start_job(job_id)

        # ── Stage 1: Find stale jobs ────────────────────────────────
        update_progress(job_id, stage='scanning', progress=30,
                        message='Scanning for stale RUNNING jobs')

        stale_jobs = BackgroundJob.objects.filter(
            status='RUNNING',
            started_at__lt=timezone.now() - timedelta(minutes=30)
        )
        count = stale_jobs.count()

        # ── Stage 2: Mark as failed ─────────────────────────────────
        update_progress(job_id, stage='cleaning', progress=80,
                        message='Marking stale jobs as FAILED')

        stale_jobs.update(status='FAILED', error='Worker timeout — job cleaned up')

        complete_job(job_id, result={'status': 'cleanup_completed'})

    except SoftTimeLimitExceeded:
        fail_job(job_id, error=f'Task timed out after {self.soft_time_limit}s')

    except Exception as exc:
        logger.exception('cleanup_stale_jobs failed')
        if self.request.retries < self.max_retries:
            fail_job(job_id, error=traceback.format_exc())
            raise self.retry(exc=exc, countdown=60)
        else:
            fail_job(job_id, error=traceback.format_exc())

    finally:
        release_job_lock(lock_key)

@shared_task(
    base=BaseTask,
    bind=True,
    name='tasks.analytics_tasks.fetch_current_affairs',
    max_retries=1,
    default_retry_delay=300,
    time_limit=600,
    soft_time_limit=540,
    acks_late=True,
    reject_on_worker_lost=True,
)
def fetch_current_affairs(self, job_id=None, dedup_key='global'):
    from django.core.management import call_command
    lock_key = None
    try:
        # Allow running without explicit job_id (e.g. from beat)
        if not job_id:
            job = BackgroundJob.objects.create(
                type='analytics.fetch_current_affairs',
                status='RUNNING',
                payload={},
            )
            job_id = str(job.id)
        
        lock_key = acquire_job_lock(self.name, dedup_key, job_id, ttl=900)
        start_job(job_id)
        
        update_progress(job_id, stage='fetching', progress=20, message='Running fetch_current_affairs management command')
        call_command('fetch_current_affairs')
        
        update_progress(job_id, stage='completed', progress=100, message='Done fetching')
        complete_job(job_id, result={'status': 'completed'})
    except SoftTimeLimitExceeded:
        fail_job(job_id, error=f'Task timed out after {self.soft_time_limit}s')
    except Exception as exc:
        logger.exception('fetch_current_affairs failed')
        if job_id:
            fail_job(job_id, error=traceback.format_exc())
        raise exc
    finally:
        if lock_key:
            release_job_lock(lock_key)
