import time
import logging
import functools
from google.api_core.exceptions import ResourceExhausted

logger = logging.getLogger("quiz.ai.langgraph.base")

# Exponential-backoff decorator for LLM-calling nodes
BACKOFF_DELAYS = [1, 2, 4, 8, 16]


def with_backoff(fn):
    """Wrap a node function so that *only* 429 / ResourceExhausted errors are
    retried with exponential backoff.  All other exceptions propagate
    immediately.  After exhausting ``BACKOFF_DELAYS`` the final
    ``ResourceExhausted`` is re-raised."""  

    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        last_exc = None
        for delay in BACKOFF_DELAYS:
            try:
                return fn(*args, **kwargs)
            except ResourceExhausted as exc:
                last_exc = exc
                logger.warning(
                    "ResourceExhausted (429) in %s — retrying in %ss …",
                    fn.__name__,
                    delay,
                )
                time.sleep(delay)
            # Any other exception type is NOT retried — raise immediately.

        # All retries exhausted — re-raise the last 429 error.
        logger.error(
            "All %d backoff retries exhausted for %s.",
            len(BACKOFF_DELAYS),
            fn.__name__,
        )
        raise last_exc  # type: ignore[misc]

    return wrapper


# State reducers

def replace(existing, new):
    return new


def append(existing, new):
    if existing is None:
        existing = []
    if new is None:
        new = []
    return existing + new
