"""
Event dispatcher — decoupled event bus for the application.

Events are lightweight dictionaries keyed by a dotted name.  Handlers
can be registered either as synchronous callbacks or as Celery task
names (dispatched asynchronously).

This module does NOT implement business logic.  It is pure infrastructure.
"""

import logging
from typing import Any, Callable, Dict, List, Optional

logger = logging.getLogger('events')

# ── Registry ─────────────────────────────────────────────────────────

# { 'event.name': [ (handler_fn, async_task_name_or_None), ... ] }
_registry: Dict[str, List[tuple]] = {}


def register_handler(
    event_name: str,
    handler: Optional[Callable] = None,
    task_name: Optional[str] = None,
):
    """
    Register a handler for *event_name*.

    Args:
        event_name:  Dotted event name, e.g. ``exam.summary.requested``.
        handler:     Synchronous callable (receives **kwargs).
        task_name:   Fully-qualified Celery task name to dispatch async.
                     When provided, *handler* is ignored.
    """
    _registry.setdefault(event_name, []).append((handler, task_name))
    logger.debug('Registered handler for %s: handler=%s task=%s',
                 event_name, handler, task_name)


def dispatch_event(event_name: str, **kwargs: Any) -> None:
    """
    Emit an event.

    All registered handlers are called (sync) or dispatched (async).
    Failures in one handler do not prevent others from running.
    """
    handlers = _registry.get(event_name, [])
    if not handlers:
        logger.debug('No handlers for event %s', event_name)
        return

    for handler_fn, task_name in handlers:
        try:
            if task_name:
                # Lazy import to avoid circular dependency at module level
                from core.celery import app
                app.send_task(task_name, kwargs=kwargs)
                logger.info('Dispatched async task %s for event %s',
                            task_name, event_name)
            elif handler_fn:
                handler_fn(**kwargs)
                logger.debug('Ran sync handler %s for event %s',
                             handler_fn.__name__, event_name)
        except Exception:
            logger.exception(
                'Error in handler for event %s (handler=%s, task=%s)',
                event_name, handler_fn, task_name,
            )
