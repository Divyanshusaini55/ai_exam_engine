import logging
from typing import Optional
from cache.backends import cache_get, cache_set, cache_delete

logger = logging.getLogger('cache')
DASHBOARD_TTL = 5 * 60  # 5 minutes

def get_user_dashboard(user_id: int) -> Optional[dict]:
    key = f'dashboard:{user_id}'
    data = cache_get(key)
    logger.info(f"Cache {'hit' if data else 'miss'}: {key}")
    return data

def set_user_dashboard(user_id: int, data: dict) -> None:
    cache_set(f'dashboard:{user_id}', data, timeout=DASHBOARD_TTL)

def invalidate_user_dashboard(user_id: int) -> None:
    cache_delete(f'dashboard:{user_id}')
