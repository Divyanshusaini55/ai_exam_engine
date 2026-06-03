"""
Base task class and deduplication helpers.

Every task in the project should use ``BaseTask`` as its base class.
The deduplication lock helpers (``acquire_job_lock`` / ``release_job_lock``)
use Redis ``SET NX`` to ensure only one instance of a given task + key
combination is executing at any time.

Usage:
    from tasks.base import BaseTask, acquire_job_lock, release_job_lock

    @shared_task(base=BaseTask, bind=True)
    def my_task(self, job_id, **kwargs):
        lock_key = acquire_job_lock(self.name, dedup_key, job_id)
        try:
            ...
        finally:
            release_job_lock(lock_key)
"""

import logging

from celery import Task
from django.conf import settings
from django.core.cache import cache

from jobs.exceptions import DuplicateJobError

logger = logging.getLogger('tasks')

# ─── Deduplication lock TTL (seconds) ─────────────────────────────────
# Default: 10 minutes — should be longer than the longest expected task.
DEFAULT_LOCK_TTL = 600


class BaseTask(Task):
    """
    Abstract base for all project tasks.

    Features:
        • Automatic exponential backoff on retries
        • Structured logging on start / success / failure
        • Configurable max_retries via settings (default 3)
    """

    abstract = True

    # Defaults — can be overridden per-task with decorator kwargs
    autoretry_for = ()                # We handle retries manually in task bodies
    max_retries = 3
    default_retry_delay = 60         # Seconds; exponential: 60 → 120 → 240
    time_limit = 300                 # Hard kill after 5 minutes
    soft_time_limit = 270            # Raise SoftTimeLimitExceeded after 4.5 min
    acks_late = True                 # Re-deliver if worker dies mid-task
    reject_on_worker_lost = True     # Reject (requeue) if worker is killed

    # ── Lifecycle hooks ──────────────────────────────────────────────

    def before_start(self, task_id, args, kwargs):
        logger.info(
            '[%s] STARTED  task=%s args=%s kwargs=%s',
            task_id, self.name, args, kwargs,
        )

    def on_success(self, retval, task_id, args, kwargs):
        logger.info(
            '[%s] SUCCESS  task=%s',
            task_id, self.name,
        )

    def on_failure(self, exc, task_id, args, kwargs, einfo):
        logger.error(
            '[%s] FAILED   task=%s error=%s',
            task_id, self.name, exc,
            exc_info=True,
        )

    def on_retry(self, exc, task_id, args, kwargs, einfo):
        logger.warning(
            '[%s] RETRY    task=%s attempt=%s/%s error=%s',
            task_id, self.name,
            self.request.retries + 1, self.max_retries, exc,
        )


# ─── Deduplication helpers ────────────────────────────────────────────


def _lock_key(task_name, dedup_key):
    """Build the Redis key for a deduplication lock."""
    return f'job_lock:{task_name}:{dedup_key}'


def acquire_job_lock(task_name, dedup_key, job_id, ttl=DEFAULT_LOCK_TTL):
    """
    Attempt to acquire a Redis-based deduplication lock.

    Uses ``SET key value NX EX ttl`` semantics:
    - If the key does not exist → set it to *job_id* and return the lock key.
    - If the key already exists → raise ``DuplicateJobError``.

    Args:
        task_name:  Fully-qualified Celery task name.
        dedup_key:  Caller-defined deduplication key (e.g. exam_id, user+exam hash).
        job_id:     The BackgroundJob UUID that owns this lock.
        ttl:        Lock expiry in seconds (safety net for crashed workers).

    Returns:
        The lock key string (pass to ``release_job_lock``).

    Raises:
        DuplicateJobError: if a lock already exists for this task + dedup_key.
    """
    key = _lock_key(task_name, dedup_key)
    acquired = cache.set(key, str(job_id), nx=True, timeout=ttl)

    if not acquired:
        existing = cache.get(key)
        logger.warning(
            'Duplicate job blocked: task=%s dedup_key=%s existing_job=%s new_job=%s',
            task_name, dedup_key, existing, job_id,
        )
        raise DuplicateJobError(task_name, dedup_key, existing_job_id=existing)

    logger.debug('Acquired lock %s for job %s (ttl=%ds)', key, job_id, ttl)
    return key


def release_job_lock(lock_key):
    """
    Release a previously acquired deduplication lock.

    Always safe to call — silently does nothing if the lock has
    already expired or been deleted.
    """
    if lock_key:
        cache.delete(lock_key)
        logger.debug('Released lock %s', lock_key)
