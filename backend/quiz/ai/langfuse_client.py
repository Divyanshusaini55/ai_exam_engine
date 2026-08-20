import os
import logging
import functools
from django.conf import settings

logger = logging.getLogger("quiz.ai.langfuse")

_observe = None
langfuse_context = None
LANGFUSE_ENABLED = False

try:
    from langfuse import observe as _observe, Langfuse
    try:
        from langfuse import langfuse_context
    except ImportError:
        try:
            from langfuse.decorators import langfuse_context
        except ImportError:
            langfuse_context = None

    # Configure env vars from Django settings if available
    public_key = getattr(settings, "LANGFUSE_PUBLIC_KEY", None) or os.environ.get("LANGFUSE_PUBLIC_KEY")
    secret_key = getattr(settings, "LANGFUSE_SECRET_KEY", None) or os.environ.get("LANGFUSE_SECRET_KEY")
    host = getattr(settings, "LANGFUSE_HOST", None) or os.environ.get("LANGFUSE_HOST", "https://cloud.langfuse.com")
    
    if public_key:
        os.environ["LANGFUSE_PUBLIC_KEY"] = public_key
    if secret_key:
        os.environ["LANGFUSE_SECRET_KEY"] = secret_key
    if host:
        os.environ["LANGFUSE_HOST"] = host

    LANGFUSE_ENABLED = bool(public_key and secret_key)
    if LANGFUSE_ENABLED:
        logger.info(f"Langfuse observability initialized (host: {host})")
    else:
        logger.info("Langfuse installed and ready. (Set LANGFUSE_PUBLIC_KEY & LANGFUSE_SECRET_KEY in .env to stream live traces)")
except Exception as e:
    LANGFUSE_ENABLED = False
    _observe = None
    langfuse_context = None
    logger.info(f"Langfuse disabled or initialization notice: {e}")


def observe(*args, **kwargs):
    """
    Safe decorator wrapper around Langfuse @observe.
    If Langfuse is not configured or keys are omitted, cleanly passes through without side effects.
    """
    if _observe:
        return _observe(*args, **kwargs)

    # No-op fallback decorator
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*f_args, **f_kwargs):
            return func(*f_args, **f_kwargs)
        return wrapper

    if len(args) == 1 and callable(args[0]):
        return decorator(args[0])
    return decorator


def update_trace_metadata(**kwargs):
    """Safely add custom metadata/tags to the active Langfuse trace."""
    if langfuse_context:
        try:
            langfuse_context.update_current_trace(**kwargs)
        except Exception as e:
            logger.debug(f"Failed to update Langfuse trace metadata: {e}")


def update_observation_metadata(**kwargs):
    """Safely update current observation/span metadata."""
    if langfuse_context:
        try:
            langfuse_context.update_current_observation(**kwargs)
        except Exception as e:
            logger.debug(f"Failed to update Langfuse observation metadata: {e}")
