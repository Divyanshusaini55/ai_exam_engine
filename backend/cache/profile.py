import logging
from typing import Optional
from cache.backends import cache_get, cache_set, cache_delete

logger = logging.getLogger('cache')
PROFILE_TTL = 30 * 60  # 30 minutes

def get_user_profile(user_id: int) -> Optional[dict]:
    key = f'profile:{user_id}'
    data = cache_get(key)
    logger.info(f"Cache {'hit' if data else 'miss'}: {key}")
    return data

def set_user_profile(user_id: int, data: dict) -> None:
    cache_set(f'profile:{user_id}', data, timeout=PROFILE_TTL)

def invalidate_user_profile(user_id: int) -> None:
    cache_delete(f'profile:{user_id}')
