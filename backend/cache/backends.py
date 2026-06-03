
import logging
from typing import Any, Callable, Optional

from django.core.cache import cache

logger = logging.getLogger('cache')

# ─── Core operations ─────────────────────────────────────────────────


def cache_get(key: str, default: Any = None) -> Any:
    """Retrieve a value from cache.  Returns *default* on miss."""
    return cache.get(key, default)


def cache_set(key: str, value: Any, timeout: Optional[int] = None) -> None:
    """
    Store a value in cache.

    Args:
        key:     Cache key (auto-prefixed by Django).
        value:   Any picklable Python object.
        timeout: TTL in seconds.  ``None`` → use default from settings.
    """
    cache.set(key, value, timeout)


def cache_delete(key: str) -> None:
    """Delete a single cache key."""
    cache.delete(key)


def cache_delete_pattern(pattern: str) -> None:
    """
    Delete all keys matching a glob *pattern* (e.g. ``exam:*``).

    Only works with ``django-redis`` backend.  Falls back to a no-op
    with a warning on other backends.
    """
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
    """
    Return the cached value for *key*.  On miss, call *default_fn()*,
    store the result, and return it.
    """
    value = cache.get(key)
    if value is None:
        value = default_fn()
        cache.set(key, value, timeout)
    return value


def cache_incr(key: str, delta: int = 1) -> int:
    """
    Atomically increment a cache key.  If the key does not exist,
    initialise it to *delta*.

    Returns the new value.
    """
    try:
        return cache.incr(key, delta)
    except ValueError:
        cache.set(key, delta)
        return delta
