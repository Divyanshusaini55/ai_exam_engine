"""
Health check views — unauthenticated, lightweight probes.

These are designed for Docker HEALTHCHECK, Kubernetes liveness/readiness
probes, and uptime monitors.  They MUST NOT require authentication.
"""

import time
import logging

from django.http import JsonResponse
from django.db import connection

logger = logging.getLogger('health')


def health_check(request):
    """
    GET /health/

    Verifies the Django process is alive and the database is reachable.
    Returns 200 on success, 503 on failure.
    """
    checks = {
        'status': 'healthy',
        'database': 'ok',
        'timestamp': time.time(),
    }

    # Database probe
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1')
    except Exception as exc:
        logger.error('Health check database probe failed: %s', exc)
        checks['status'] = 'unhealthy'
        checks['database'] = str(exc)
        return JsonResponse(checks, status=503)

    return JsonResponse(checks, status=200)


# def worker_check(request):
#     """
#     GET /health/worker/

#     Sends a lightweight task to the Celery worker pool and waits
#     up to 5 seconds for a result.  Returns 200 if a worker picks it
#     up, 503 otherwise.
#     """
#     from core.celery import debug_task

#     try:
#         result = debug_task.apply_async()
#         value = result.get(timeout=5)
#         return JsonResponse({
#             'status': 'healthy',
#             'worker': value.get('worker', 'unknown'),
#             'task_id': result.id,
#             'timestamp': time.time(),
#         }, status=200)

#     except Exception as exc:
#         logger.error('Health check worker probe failed: %s', exc)
#         return JsonResponse({
#             'status': 'unhealthy',
#             'error': str(exc),
#             'timestamp': time.time(),
#         }, status=503)

def worker_check(request):
    from core.celery import debug_task

    try:
        # Send to 'low' queue — analytics_worker listens on this
        result = debug_task.apply_async(queue='low', timeout=10)
        value = result.get(timeout=10)  # increase timeout to 10s
        return JsonResponse({
            'status': 'healthy',
            'worker': value.get('worker', 'unknown'),
            'task_id': result.id,
            'timestamp': time.time(),
        }, status=200)

    except Exception as exc:
        logger.error('Health check worker probe failed: %s', exc)
        return JsonResponse({
            'status': 'unhealthy',
            'error': str(exc),
            'timestamp': time.time(),
        }, status=503)

def cache_check(request):
    """
    GET /health/cache/

    Writes and reads a throwaway key to verify Redis cache connectivity.
    Returns 200 on success, 503 on failure.
    """
    from django.core.cache import cache

    test_key = '_health_check_probe'
    test_value = f'probe-{time.time()}'

    try:
        cache.set(test_key, test_value, timeout=10)
        read_back = cache.get(test_key)
        cache.delete(test_key)

        if read_back != test_value:
            raise ValueError(
                f'Cache read-back mismatch: wrote {test_value!r}, '
                f'got {read_back!r}'
            )

        return JsonResponse({
            'status': 'healthy',
            'backend': 'redis',
            'timestamp': time.time(),
        }, status=200)

    except Exception as exc:
        logger.error('Health check cache probe failed: %s', exc)
        return JsonResponse({
            'status': 'unhealthy',
            'error': str(exc),
            'timestamp': time.time(),
        }, status=503)
