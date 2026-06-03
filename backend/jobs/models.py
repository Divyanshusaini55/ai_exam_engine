"""
BackgroundJob — generic job lifecycle model.

This model tracks the state of any asynchronous unit of work in the
system.  It is executor-agnostic: Celery tasks, management commands,
or any other mechanism can drive the lifecycle through the service
functions in ``jobs.services``.

State machine:

    QUEUED ──→ RUNNING ──→ COMPLETED
      │          │
      │          └──→ FAILED
      │
      └──→ CANCELLED
      
    RUNNING ──→ CANCELLED
"""

import uuid

from django.conf import settings
from django.db import models


class Priority(models.IntegerChoices):
    LOW = 10, 'Low'
    NORMAL = 20, 'Normal'
    HIGH = 30, 'High'
    CRITICAL = 40, 'Critical'


class Status(models.TextChoices):
    QUEUED = 'QUEUED', 'Queued'
    RUNNING = 'RUNNING', 'Running'
    FAILED = 'FAILED', 'Failed'
    COMPLETED = 'COMPLETED', 'Completed'
    CANCELLED = 'CANCELLED', 'Cancelled'


# Which status values represent a terminal (irreversible) state.
TERMINAL_STATUSES = frozenset({
    Status.COMPLETED,
    Status.FAILED,
    Status.CANCELLED,
})

# Allowed transitions: current_status → set of valid target statuses.
VALID_TRANSITIONS = {
    Status.QUEUED: {Status.RUNNING, Status.CANCELLED},
    Status.RUNNING: {Status.COMPLETED, Status.FAILED, Status.CANCELLED},
    # Terminal states cannot transition anywhere.
    Status.COMPLETED: set(),
    Status.FAILED: set(),
    Status.CANCELLED: set(),
}


class BackgroundJob(models.Model):
    """
    A single tracked unit of asynchronous work.

    Create via ``jobs.services.create_job()``.
    Drive lifecycle via ``start_job``, ``update_progress``,
    ``complete_job``, ``fail_job``, ``cancel_job``.
    """

    # ── Identity ──────────────────────────────────────────────────────
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    type = models.CharField(
        max_length=255,
        db_index=True,
        help_text=(
            'Registered job type key, e.g. "ai.explain", "ai.parse_pdf", '
            '"community.recalculate_ranks".'
        ),
    )
    priority = models.IntegerField(
        choices=Priority.choices,
        default=Priority.NORMAL,
        help_text='Job priority.  Higher value = more urgent.',
    )

    # ── Ownership ─────────────────────────────────────────────────────
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='background_jobs',
        help_text='User who initiated the job.  NULL for system jobs.',
    )

    # ── Lifecycle ─────────────────────────────────────────────────────
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.QUEUED,
        db_index=True,
    )
    stage = models.CharField(
        max_length=255,
        blank=True,
        default='',
        help_text='Current named stage, e.g. "parsing", "generating".',
    )
    progress = models.IntegerField(
        default=0,
        help_text='Completion percentage, 0–100.',
    )

    # ── Data ──────────────────────────────────────────────────────────
    payload = models.JSONField(
        default=dict,
        blank=True,
        help_text='Immutable input data, set at creation.',
    )
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text='Mutable runtime annotations (e.g. worker hostname).',
    )
    result = models.JSONField(
        null=True,
        blank=True,
        help_text='Output data, populated on completion.',
    )
    error = models.TextField(
        blank=True,
        default='',
        help_text='Error message and traceback on failure.',
    )

    # ── Retry tracking ────────────────────────────────────────────────
    retries = models.IntegerField(
        default=0,
        help_text='Number of retry attempts executed so far.',
    )

    # ── Timestamps ────────────────────────────────────────────────────
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Background Job'
        verbose_name_plural = 'Background Jobs'
        indexes = [
            models.Index(fields=['status', 'priority'], name='jobs_status_priority_idx'),
            models.Index(fields=['type', 'status'], name='jobs_type_status_idx'),
            models.Index(fields=['user', 'status'], name='jobs_user_status_idx'),
            models.Index(fields=['status', 'created_at'], name='jobs_status_created_idx'),
        ]

    # ── Computed helpers ──────────────────────────────────────────────

    @property
    def is_terminal(self):
        """True if the job has reached a final state."""
        return self.status in TERMINAL_STATUSES

    @property
    def duration_seconds(self):
        """Wall-clock duration in seconds, or None if not yet started."""
        if not self.started_at:
            return None
        end = self.completed_at or self.started_at  # still running → 0
        return (end - self.started_at).total_seconds()

    def __str__(self):
        return f'[{self.status}] {self.type} ({self.id})'

    def __repr__(self):
        return (
            f'<BackgroundJob id={self.id} type={self.type!r} '
            f'status={self.status} progress={self.progress}%>'
        )
