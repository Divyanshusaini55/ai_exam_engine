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


# ─── Helpers ──────────────────────────────────────────────────────────

def _get_job(job_id):
    """
    Fetch a BackgroundJob by primary key.
    Raises ``JobNotFound`` if it does not exist.
    """
    try:
        return BackgroundJob.objects.get(pk=job_id)
    except BackgroundJob.DoesNotExist:
        raise JobNotFound(job_id)


def _get_job_for_update(job_id):
    """
    Fetch a BackgroundJob with a row-level lock (SELECT … FOR UPDATE).
    Raises ``JobNotFound`` if it does not exist.
    """
    try:
        return BackgroundJob.objects.select_for_update().get(pk=job_id)
    except BackgroundJob.DoesNotExist:
        raise JobNotFound(job_id)


def _assert_transition(job, target_status):
    """
    Validate that transitioning *job* to *target_status* is legal.

    - If the job is already in *target_status*, returns ``False``
      (idempotent no-op).
    - If the job is in a terminal state, raises ``JobAlreadyTerminal``.
    - If the transition is not in ``VALID_TRANSITIONS``, raises
      ``InvalidJobTransition``.
    - Otherwise returns ``True`` (transition allowed).
    """
    if job.status == target_status:
        # Idempotent: already in the desired state.
        return False

    if job.is_terminal:
        raise JobAlreadyTerminal(job.id, job.status)

    allowed = VALID_TRANSITIONS.get(job.status, set())
    if target_status not in allowed:
        raise InvalidJobTransition(job.id, job.status, target_status)

    return True


# ─── Public API ───────────────────────────────────────────────────────

def create_job(type, payload=None, user=None, priority=Priority.NORMAL, metadata=None):
    """
    Create and return a new ``BackgroundJob`` in QUEUED state.

    Args:
        type:     Registered job type key (e.g. ``"ai.explain"``).
        payload:  Immutable input data dict.
        user:     The requesting user, or ``None`` for system jobs.
        priority: One of ``Priority.LOW / NORMAL / HIGH / CRITICAL``.
        metadata: Optional initial runtime metadata dict.

    Returns:
        The newly created ``BackgroundJob`` instance.
    """
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
    """
    Transition a job from QUEUED → RUNNING.

    Sets ``started_at`` to the current time.
    Idempotent: if already RUNNING, returns the job unchanged.

    Returns:
        The updated ``BackgroundJob`` instance.

    Raises:
        JobNotFound: if ``job_id`` does not exist.
        JobAlreadyTerminal: if the job is COMPLETED/FAILED/CANCELLED.
        InvalidJobTransition: if the current state is not QUEUED.
    """
    job = _get_job_for_update(job_id)

    if not _assert_transition(job, Status.RUNNING):
        return job  # Already RUNNING — idempotent.

    job.status = Status.RUNNING
    job.started_at = timezone.now()
    job.save(update_fields=['status', 'started_at'])

    logger.info('Started job %s', job_id)
    return job


def update_progress(job_id, stage='', progress=0, message=None):
    """
    Update the current stage and progress percentage of a RUNNING job.

    This does **not** change the status — the job remains RUNNING.
    Optionally stores *message* in ``metadata['last_message']``.

    Args:
        job_id:   Job primary key.
        stage:    Named stage string (e.g. ``"parsing"``).
        progress: Integer 0–100.
        message:  Optional human-readable progress note.

    Returns:
        The updated ``BackgroundJob`` instance.

    Raises:
        JobNotFound: if ``job_id`` does not exist.
        JobAlreadyTerminal: if the job is in a terminal state.
    """
    job = _get_job(job_id)

    if job.is_terminal:
        raise JobAlreadyTerminal(job.id, job.status)

    # Clamp progress to [0, 100].
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
    """
    Transition a job from RUNNING → COMPLETED.

    Sets ``progress=100``, ``completed_at=now``, and stores the *result*.
    Idempotent: if already COMPLETED, returns the job unchanged.

    Returns:
        The updated ``BackgroundJob`` instance.

    Raises:
        JobNotFound: if ``job_id`` does not exist.
        JobAlreadyTerminal: if FAILED or CANCELLED.
        InvalidJobTransition: if not currently RUNNING.
    """
    job = _get_job_for_update(job_id)

    if not _assert_transition(job, Status.COMPLETED):
        return job  # Already COMPLETED — idempotent.

    job.status = Status.COMPLETED
    job.progress = 100
    job.result = result
    job.completed_at = timezone.now()
    job.save(update_fields=['status', 'progress', 'result', 'completed_at'])

    logger.info('Completed job %s', job_id)
    return job


@transaction.atomic
def fail_job(job_id, error=''):
    """
    Transition a job from RUNNING → FAILED.

    Stores the *error* string (typically a traceback) and increments
    the retry counter.  Idempotent: if already FAILED, returns
    unchanged.

    Args:
        job_id: Job primary key.
        error:  Error message or traceback string.

    Returns:
        The updated ``BackgroundJob`` instance.

    Raises:
        JobNotFound: if ``job_id`` does not exist.
        JobAlreadyTerminal: if COMPLETED or CANCELLED.
        InvalidJobTransition: if not currently RUNNING.
    """
    job = _get_job_for_update(job_id)

    if not _assert_transition(job, Status.FAILED):
        return job  # Already FAILED — idempotent.

    job.status = Status.FAILED
    job.error = error
    job.retries += 1
    job.completed_at = timezone.now()
    job.save(update_fields=['status', 'error', 'retries', 'completed_at'])

    logger.error('Failed job %s: %s', job_id, error[:200])
    return job


@transaction.atomic
def cancel_job(job_id):
    """
    Cancel a job.  Only allowed from QUEUED or RUNNING.

    Idempotent: if already CANCELLED, returns unchanged.

    Returns:
        The updated ``BackgroundJob`` instance.

    Raises:
        JobNotFound: if ``job_id`` does not exist.
        JobAlreadyTerminal: if COMPLETED or FAILED.
        InvalidJobTransition: if current state does not allow cancellation.
    """
    job = _get_job_for_update(job_id)

    if not _assert_transition(job, Status.CANCELLED):
        return job  # Already CANCELLED — idempotent.

    job.status = Status.CANCELLED
    job.completed_at = timezone.now()
    job.save(update_fields=['status', 'completed_at'])

    logger.info('Cancelled job %s', job_id)
    return job
