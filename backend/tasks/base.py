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
DEFAULT_LOCK_TTL = 600


class BaseTask(Task):
    abstract = True
    autoretry_for = ()               
    max_retries = 3
    default_retry_delay = 60       
    time_limit = 300               
    soft_time_limit = 270           
    acks_late = True                 
    reject_on_worker_lost = True     


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

def _lock_key(task_name, dedup_key):
    return f'job_lock:{task_name}:{dedup_key}'


def acquire_job_lock(task_name, dedup_key, job_id, ttl=DEFAULT_LOCK_TTL):
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
    if lock_key:
        cache.delete(lock_key)
        logger.debug('Released lock %s', lock_key)
