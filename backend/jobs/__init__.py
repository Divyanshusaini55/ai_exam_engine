"""
jobs — Generic background job lifecycle tracking.

Provides the BackgroundJob model and service functions for creating,
starting, progressing, completing, failing, and cancelling jobs.

No business logic lives here.  Application code creates a BackgroundJob
via ``create_job()`` and updates it through the service layer as work
progresses.  Celery tasks (or any other executor) consume these
services — they are not defined here.
"""

default_app_config = 'jobs.apps.JobsConfig'
