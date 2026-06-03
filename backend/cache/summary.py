import logging
from typing import Optional
from cache.backends import cache_get, cache_set, cache_delete

logger = logging.getLogger('cache')
SUMMARY_TTL = 7 * 24 * 60 * 60  # 7 days

def get_exam_summary(exam_id: int) -> Optional[dict]:
    key = f'summary:{exam_id}'
    data = cache_get(key)
    logger.info(f"Cache {'hit' if data else 'miss'}: {key}")
    return data

def set_exam_summary(exam_id: int, data: dict) -> None:
    cache_set(f'summary:{exam_id}', data, timeout=SUMMARY_TTL)

def invalidate_exam_summary(exam_id: int) -> None:
    cache_delete(f'summary:{exam_id}')
