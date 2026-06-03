"""
events — Domain event dispatch layer for AI Exam Engine.

Provides a thin abstraction over Django signals for decoupled,
async-ready event handling.  Business modules emit events here;
listeners can choose to process them synchronously (Django signal)
or asynchronously (by dispatching a Celery task).

Currently a skeleton — event definitions will be added when workers
are implemented.

Usage:
    from events import dispatch_event

    dispatch_event('exam.summary.requested', exam_id=42)
"""

from events.dispatch import dispatch_event  # noqa: F401 – re-export
