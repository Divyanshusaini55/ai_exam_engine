import logging
from typing import Optional
from cache.backends import cache_get, cache_set, cache_delete

logger = logging.getLogger('cache')
ROADMAP_TTL = 24 * 60 * 60  # 24 hours

def get_exam_roadmap(exam_id: int) -> Optional[dict]:
    key = f'roadmap:{exam_id}'
    data = cache_get(key)
    logger.info(f"Cache {'hit' if data else 'miss'}: {key}")
    return data

def set_exam_roadmap(exam_id: int, data: dict) -> None:
    cache_set(f'roadmap:{exam_id}', data, timeout=ROADMAP_TTL)

def invalidate_exam_roadmap(exam_id: int) -> None:
    cache_delete(f'roadmap:{exam_id}')
