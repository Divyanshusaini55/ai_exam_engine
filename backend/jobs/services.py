import logging
import traceback

from django.db import transaction
from django.utils import timezone

from jobs.exceptions import (
    JobAlreadyTerminal,
    InvalidJobTransition,
    JobNotFound,
)
from jobs.models import (
    BackgroundJob,
    Priority,
    Status,
    TERMINAL_STATUSES,
    VALID_TRANSITIONS,
)

logger = logging.getLogger('jobs')

def _get_job(job_id):
    try:
        return BackgroundJob.objects.get(pk=job_id)
    except BackgroundJob.DoesNotExist:
        raise JobNotFound(job_id)


def _get_job_for_update(job_id):
    try:
        return BackgroundJob.objects.select_for_update().get(pk=job_id)
    except BackgroundJob.DoesNotExist:
        raise JobNotFound(job_id)


def _assert_transition(job, target_status):
    if job.status == target_status:
        return False

    if job.is_terminal:
        raise JobAlreadyTerminal(job.id, job.status)

    allowed = VALID_TRANSITIONS.get(job.status, set())
    if target_status not in allowed:
        raise InvalidJobTransition(job.id, job.status, target_status)

    return True


def create_job(type, payload=None, user=None, priority=Priority.NORMAL, metadata=None):
    job = BackgroundJob.objects.create(
        type=type,
        payload=payload or {},
        user=user,
        priority=priority,
        metadata=metadata or {},
        status=Status.QUEUED,
    )
    logger.info('Created job %s type=%s priority=%s user=%s',
                job.id, type, priority, user)
    return job


@transaction.atomic
def start_job(job_id):
    job = _get_job_for_update(job_id)

    if not _assert_transition(job, Status.RUNNING):
        return job 

    job.status = Status.RUNNING
    job.started_at = timezone.now()
    job.save(update_fields=['status', 'started_at'])

    logger.info('Started job %s', job_id)
    return job


def update_progress(job_id, stage='', progress=0, message=None):
    job = _get_job(job_id)

    if job.is_terminal:
        raise JobAlreadyTerminal(job.id, job.status)

    progress = max(0, min(100, progress))

    update_fields = ['stage', 'progress']
    job.stage = stage
    job.progress = progress

    if message is not None:
        job.metadata = {**job.metadata, 'last_message': message}
        update_fields.append('metadata')

    job.save(update_fields=update_fields)

    logger.debug('Progress job %s → stage=%s progress=%d%%',
                 job_id, stage, progress)
    return job


@transaction.atomic
def complete_job(job_id, result=None):
    job = _get_job_for_update(job_id)

    if not _assert_transition(job, Status.COMPLETED):
        return job 

    job.status = Status.COMPLETED
    job.progress = 100
    job.result = result
    job.completed_at = timezone.now()
    job.save(update_fields=['status', 'progress', 'result', 'completed_at'])

    logger.info('Completed job %s', job_id)
    return job


@transaction.atomic
def fail_job(job_id, error=''):
    job = _get_job_for_update(job_id)

    if not _assert_transition(job, Status.FAILED):
        return job 

    job.status = Status.FAILED
    job.error = error
    job.retries += 1
    job.completed_at = timezone.now()
    job.save(update_fields=['status', 'error', 'retries', 'completed_at'])

    logger.error('Failed job %s: %s', job_id, error[:200])
    return job


@transaction.atomic
def cancel_job(job_id):
    job = _get_job_for_update(job_id)

    if not _assert_transition(job, Status.CANCELLED):
        return job 

    job.status = Status.CANCELLED
    job.completed_at = timezone.now()
    job.save(update_fields=['status', 'completed_at'])

    logger.info('Cancelled job %s', job_id)
    return job
