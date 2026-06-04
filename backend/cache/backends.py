
import logging
from typing import Any, Callable, Optional

from django.core.cache import cache

logger = logging.getLogger('cache')

def cache_get(key: str, default: Any = None) -> Any:
    return cache.get(key, default)


def cache_set(key: str, value: Any, timeout: Optional[int] = None) -> None:
    cache.set(key, value, timeout)


def cache_delete(key: str) -> None:
    cache.delete(key)


def cache_delete_pattern(pattern: str) -> None:
    try:
        cache.delete_pattern(pattern)
    except AttributeError:
        logger.warning(
            'cache_delete_pattern(%s) called but backend does not '
            'support pattern deletion.  Skipping.',
            pattern,
        )


def cache_get_or_set(
    key: str,
    default_fn: Callable[[], Any],
    timeout: Optional[int] = None,
) -> Any:
    value = cache.get(key)
    if value is None:
        value = default_fn()
        cache.set(key, value, timeout)
    return value


def cache_incr(key: str, delta: int = 1) -> int:
    try:
        return cache.incr(key, delta)
    except ValueError:
        cache.set(key, delta)
        return delta
