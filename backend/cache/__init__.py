"""
Cache utilities for high-read resources.
Provides a simple cache-aside abstraction over the underlying backend.
"""

from .backends import (
    cache_get, cache_set, cache_delete, cache_delete_pattern,
    cache_get_or_set, cache_incr
)
from .summary import get_exam_summary, set_exam_summary, invalidate_exam_summary
from .roadmap import get_exam_roadmap, set_exam_roadmap, invalidate_exam_roadmap
from .profile import get_user_profile, set_user_profile, invalidate_user_profile
from .dashboard import get_user_dashboard, set_user_dashboard, invalidate_user_dashboard
from .leaderboard import get_leaderboard, set_leaderboard, invalidate_leaderboard

__all__ = [
    'cache_get', 'cache_set', 'cache_delete', 'cache_delete_pattern',
    'cache_get_or_set', 'cache_incr',
    'get_exam_summary', 'set_exam_summary', 'invalidate_exam_summary',
    'get_exam_roadmap', 'set_exam_roadmap', 'invalidate_exam_roadmap',
    'get_user_profile', 'set_user_profile', 'invalidate_user_profile',
    'get_user_dashboard', 'set_user_dashboard', 'invalidate_user_dashboard',
    'get_leaderboard', 'set_leaderboard', 'invalidate_leaderboard',
]
