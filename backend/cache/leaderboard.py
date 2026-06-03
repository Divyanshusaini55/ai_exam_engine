import logging
from typing import Optional
from cache.backends import cache_get, cache_set, cache_delete, cache_delete_pattern

logger = logging.getLogger('cache')
LEADERBOARD_TTL = 10 * 60  # 10 minutes

def get_leaderboard(category_id: Optional[int] = None) -> Optional[list]:
    key = f'leaderboard:category:{category_id}' if category_id else 'leaderboard:global'
    data = cache_get(key)
    logger.info(f"Cache {'hit' if data else 'miss'}: {key}")
    return data

def set_leaderboard(data: list, category_id: Optional[int] = None) -> None:
    key = f'leaderboard:category:{category_id}' if category_id else 'leaderboard:global'
    cache_set(key, data, timeout=LEADERBOARD_TTL)

def invalidate_leaderboard(category_id: Optional[int] = None) -> None:
    if category_id:
        cache_delete(f'leaderboard:category:{category_id}')
        cache_delete('leaderboard:global')
    else:
        cache_delete_pattern('leaderboard:*')
