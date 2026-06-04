class JobError(Exception):
    pass


class JobNotFound(JobError):

    def __init__(self, job_id):
        self.job_id = job_id
        super().__init__(f'BackgroundJob with id={job_id} does not exist.')


class InvalidJobTransition(JobError):

    def __init__(self, job_id, current_status, target_status):
        self.job_id = job_id
        self.current_status = current_status
        self.target_status = target_status
        super().__init__(
            f'Cannot transition job {job_id} from '
            f'{current_status} → {target_status}.'
        )


class JobAlreadyTerminal(JobError):

    def __init__(self, job_id, current_status):
        self.job_id = job_id
        self.current_status = current_status
        super().__init__(
            f'Job {job_id} is already in terminal state {current_status}.'
        )


class DuplicateJobError(JobError):
    def __init__(self, task_name, dedup_key, existing_job_id=None):
        self.task_name = task_name
        self.dedup_key = dedup_key
        self.existing_job_id = existing_job_id
        detail = f' (held by job {existing_job_id})' if existing_job_id else ''
        super().__init__(
            f'Duplicate job rejected: {task_name}:{dedup_key}{detail}'
        )
