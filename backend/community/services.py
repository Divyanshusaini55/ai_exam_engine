"""
Contributor Analytics Service Layer
All XP, streak, reputation, ranking, and badge logic lives here.
Celery-ready: each function can be called from a task with zero changes.
"""
from django.utils import timezone
from django.core.cache import cache
from django.db.models import Count, Sum, Avg
from datetime import date, timedelta
import math

# XP Rules
XP_RULES = {
    'upload_approved':      50,
    'suggestion_approved':  20,
    'solution_posted':      10,
    'comment_posted':        5,
    'upvote_received':       3,
    'exam_completed':        2,
    'roadmap_topic_done':    1,
}


def award_xp(user, amount, reason=''):
    from .models import Profile
    from django.db.models import F
    from django.db.models.functions import Greatest
    profile, _ = Profile.objects.get_or_create(user=user)
    profile.xp = Greatest(F('xp') + amount, 0)
    profile.save(update_fields=['xp'])
    recalculate_reputation(user)
    check_and_award_badges(user)
    from jobs.models import BackgroundJob
    from jobs.services import create_job
    from tasks.analytics_tasks import recalculate_community_ranks
    
    # Dedup check
    is_queued = BackgroundJob.objects.filter(
        type='analytics.recalculate_ranks',
        status__in=['QUEUED', 'RUNNING']
    ).exists()
    
    if not is_queued:
        job = create_job(type='analytics.recalculate_ranks', payload={})
        recalculate_community_ranks.apply_async(args=[str(job.id)], countdown=60)

def update_streak(user):
    from .models import Profile
    from django.db.models import F
    profile, _ = Profile.objects.get_or_create(user=user)
    today = date.today()
    last = profile.last_activity

    if last is None or last < today - timedelta(days=1):
        profile.streak = 1
    elif last == today - timedelta(days=1):
        profile.streak = F('streak') + 1
        profile.save(update_fields=['streak'])
        profile.refresh_from_db(fields=['streak'])
    # if last == today: already counted

    if profile.streak > profile.best_streak:
        profile.best_streak = profile.streak

    profile.last_activity = today
    profile.save(update_fields=['streak', 'best_streak', 'last_activity'])


def recalculate_reputation(user):
    from .models import Profile
    profile, _ = Profile.objects.get_or_create(user=user)

    upvote_score       = min(profile.total_upvotes_received * 0.5, 30)
    view_score         = min(profile.total_views / 100.0, 20)
    contribution_score = min((profile.uploads_approved + profile.suggestions_approved) * 2, 20)
    solution_score     = min(profile.total_solutions * 0.5, 15)
    engagement_score   = min(profile.total_comments * 0.3, 10)
    streak_score       = min(profile.streak * 0.2, 5)

    reputation = (upvote_score + view_score + contribution_score +
                  solution_score + engagement_score + streak_score)
    profile.reputation_score = round(min(reputation, 100.0), 1)
    profile.save(update_fields=['reputation_score'])


def recalculate_ranks():
    from .models import Profile
    profiles = list(Profile.objects.filter(xp__gt=0).order_by('-xp', '-reputation_score'))
    total = len(profiles)
    if total == 0:
        return
        
    for rank, profile in enumerate(profiles, start=1):
        profile.community_rank = rank
        profile.percentile = round((1 - rank / total) * 100, 1)
        
    Profile.objects.bulk_update(profiles, ['community_rank', 'percentile'])


def check_and_award_badges(user):
    from .models import Profile, Badge, UserBadge, ContributorActivity
    profile, _ = Profile.objects.get_or_create(user=user)
    earned_slugs = set(
        UserBadge.objects.filter(user=user).values_list('badge__slug', flat=True)
    )

    for badge in Badge.objects.filter(is_active=True):
        if badge.slug in earned_slugs:
            continue

        earned = False
        ct, cv = badge.criteria_type, badge.criteria_value
        if ct == 'solutions_count'  and profile.total_solutions          >= cv: earned = True
        elif ct == 'xp_threshold'   and profile.xp                       >= cv: earned = True
        elif ct == 'streak'         and profile.best_streak               >= cv: earned = True
        elif ct == 'uploads'        and profile.uploads_approved          >= cv: earned = True
        elif ct == 'suggestions'    and profile.suggestions_approved      >= cv: earned = True
        elif ct == 'upvotes'        and profile.total_upvotes_received    >= cv: earned = True
        elif ct == 'ai_verified'    and profile.ai_verified_count         >= cv: earned = True

        if earned:
            UserBadge.objects.create(user=user, badge=badge)
            ContributorActivity.objects.create(
                user=user,
                activity_type='BADGE',
                description=f'{user.username} earned the "{badge.name}" badge',
                metadata={'badge_slug': badge.slug, 'badge_name': badge.name},
            )


def get_category_leaderboard(days=30):
    from quiz.models import Category, Question
    from .models import Solution, Profile

    cache_key = f'cat_leaderboard_{days}'
    cached = cache.get(cache_key)
    if cached:
        return cached

    cutoff = timezone.now() - timedelta(days=days)
    result = []

    for cat in Category.objects.filter(is_active=True):
        question_ids = Question.objects.filter(
            exam__subcategory__category=cat
        ).values_list('id', flat=True)

        top = (
            Solution.objects
            .filter(question_id__in=question_ids, created_at__gte=cutoff)
            .values('user__id', 'user__username')
            .annotate(solutions=Count('id'), total_upvotes=Sum('upvotes'))
            .order_by('-total_upvotes', '-solutions')[:3]
        )

        contributors = []
        for rank, u in enumerate(top, start=1):
            xp = Profile.objects.filter(
                user_id=u['user__id']
            ).values_list('xp', flat=True).first() or 0
            contributors.append({
                'rank': rank,
                'username': u['user__username'],
                'solutions': u['solutions'],
                'upvotes': u['total_upvotes'] or 0,
                'xp': xp,
            })

        result.append({
            'category_slug': cat.slug,
            'category_name': cat.name,
            'contributors': contributors,
        })

    cache.set(cache_key, result, 300)
    return result


def seed_default_badges():
    from .models import Badge
    defaults = [
        {'name': 'First Solution',       'slug': 'first-solution',    'description': 'Posted your very first solution',        'icon': 'lightbulb',   'color_gradient': 'from-yellow-400 to-amber-500',  'criteria_type': 'solutions_count', 'criteria_value': 1},
        {'name': '10 Solutions',         'slug': '10-solutions',      'description': 'Shared 10 solutions with the community', 'icon': 'file-text',   'color_gradient': 'from-blue-400 to-indigo-500',   'criteria_type': 'solutions_count', 'criteria_value': 10},
        {'name': '100 Solutions',        'slug': '100-solutions',     'description': 'Legendary 100 solutions posted',         'icon': 'award',       'color_gradient': 'from-purple-400 to-pink-500',   'criteria_type': 'solutions_count', 'criteria_value': 100},
        {'name': '1000 XP',              'slug': '1000-xp',           'description': 'Earned 1000 XP through contributions',   'icon': 'zap',         'color_gradient': 'from-amber-400 to-orange-500',  'criteria_type': 'xp_threshold',    'criteria_value': 1000},
        {'name': 'XP Master',            'slug': 'xp-master',         'description': 'Reached the elite 5000 XP club',         'icon': 'zap',         'color_gradient': 'from-orange-400 to-red-500',    'criteria_type': 'xp_threshold',    'criteria_value': 5000},
        {'name': 'Week Warrior',         'slug': 'week-warrior',      'description': 'Maintained a 7-day activity streak',      'icon': 'flame',       'color_gradient': 'from-orange-400 to-red-500',    'criteria_type': 'streak',          'criteria_value': 7},
        {'name': 'Daily Streak Master',  'slug': 'streak-master',     'description': '30-day unbroken activity streak',         'icon': 'flame',       'color_gradient': 'from-red-400 to-rose-600',      'criteria_type': 'streak',          'criteria_value': 30},
        {'name': 'Verified Contributor', 'slug': 'verified',          'description': 'Had a question paper approved',           'icon': 'shield-check','color_gradient': 'from-emerald-400 to-teal-600',  'criteria_type': 'uploads',         'criteria_value': 1},
        {'name': 'Discussion Expert',    'slug': 'discussion-expert', 'description': 'Posted 25+ quality solutions',            'icon': 'message-sq',  'color_gradient': 'from-pink-400 to-rose-600',     'criteria_type': 'solutions_count', 'criteria_value': 25},
        {'name': 'Top Contributor',      'slug': 'top-contributor',   'description': 'Elite contributor with 2000+ XP',         'icon': 'trophy',      'color_gradient': 'from-amber-300 to-yellow-500',  'criteria_type': 'xp_threshold',    'criteria_value': 2000},
        {'name': 'AI Mentor',            'slug': 'ai-mentor',         'description': 'Had 5+ solutions AI-verified',            'icon': 'cpu',         'color_gradient': 'from-blue-400 to-cyan-500',     'criteria_type': 'ai_verified',     'criteria_value': 5},
    ]
    for b in defaults:
        Badge.objects.get_or_create(slug=b['slug'], defaults=b)
