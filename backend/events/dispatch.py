import logging
from typing import Any, Callable, Dict, List, Optional

logger = logging.getLogger('events')
_registry: Dict[str, List[tuple]] = {}


def register_handler(
    event_name: str,
    handler: Optional[Callable] = None,
    task_name: Optional[str] = None,
):
    _registry.setdefault(event_name, []).append((handler, task_name))
    logger.debug('Registered handler for %s: handler=%s task=%s',
                 event_name, handler, task_name)


def dispatch_event(event_name: str, **kwargs: Any) -> None:
    handlers = _registry.get(event_name, [])
    if not handlers:
        logger.debug('No handlers for event %s', event_name)
        return

    for handler_fn, task_name in handlers:
        try:
            if task_name:
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
