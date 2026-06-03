"""
Job lifecycle exceptions.

These are raised by the service layer in ``jobs.services`` when
a requested state transition is invalid or the target job does not exist.
"""


class JobError(Exception):
    """Base class for all job-related errors."""
    pass


class JobNotFound(JobError):
    """Raised when a job_id does not match any existing BackgroundJob."""

    def __init__(self, job_id):
        self.job_id = job_id
        super().__init__(f'BackgroundJob with id={job_id} does not exist.')


class InvalidJobTransition(JobError):
    """
    Raised when a state transition is not allowed by the lifecycle rules.

    For example, transitioning from COMPLETED → RUNNING.
    """

    def __init__(self, job_id, current_status, target_status):
        self.job_id = job_id
        self.current_status = current_status
        self.target_status = target_status
        super().__init__(
            f'Cannot transition job {job_id} from '
            f'{current_status} → {target_status}.'
        )


class JobAlreadyTerminal(JobError):
    """
    Raised when an operation targets a job that has already reached
    a terminal state (COMPLETED, FAILED, or CANCELLED).
    """

    def __init__(self, job_id, current_status):
        self.job_id = job_id
        self.current_status = current_status
        super().__init__(
            f'Job {job_id} is already in terminal state {current_status}.'
        )


class DuplicateJobError(JobError):
    """
    Raised when a task is submitted but an identical job (same task
    name + dedup key) is already running and holds the Redis lock.
    """

    def __init__(self, task_name, dedup_key, existing_job_id=None):
        self.task_name = task_name
        self.dedup_key = dedup_key
        self.existing_job_id = existing_job_id
        detail = f' (held by job {existing_job_id})' if existing_job_id else ''
        super().__init__(
            f'Duplicate job rejected: {task_name}:{dedup_key}{detail}'
        )
