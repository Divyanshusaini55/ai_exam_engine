import math
from datetime import timedelta

from django.db.models import Avg, Count, Sum
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    Badge, Comment, ContributorActivity, Notification,
    Profile, Solution, UserBadge,
)
from .serializers import (
    CommentSerializer, NotificationSerializer,
    ProfileSerializer, SolutionSerializer,
)


# ─── Existing ViewSets (unchanged) ────────────────────────────────────────────

class ProfileViewSet(viewsets.ModelViewSet):
    serializer_class = ProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Profile.objects.filter(user=self.request.user)

    @action(detail=False, methods=['get'])
    def me(self, request):
        profile, created = Profile.objects.get_or_create(user=request.user)
        if created:
            profile.avatar_char = request.user.username[0].upper() if request.user.username else 'U'
            profile.save()

        answers_count = Solution.objects.filter(user=request.user).count()
        comments_count = Comment.objects.filter(user=request.user).count()
        total_views = Solution.objects.filter(user=request.user).aggregate(t=Sum('views'))['t'] or 0

        from quiz.models import ExamRoadmap
        from quiz.serializers import BookmarkedRoadmapSerializer
        bookmarked_roadmaps = ExamRoadmap.objects.filter(bookmarks=request.user)
        bookmarked_serializer = BookmarkedRoadmapSerializer(bookmarked_roadmaps, many=True)

        data = self.get_serializer(profile).data
        data['answers_count'] = answers_count
        data['comments_count'] = comments_count
        data['total_views'] = total_views
        data['bookmarked_roadmaps'] = bookmarked_serializer.data
        return Response(data)


class SolutionViewSet(viewsets.ModelViewSet):
    serializer_class = SolutionSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        return Solution.objects.all()

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
        # XP is handled in signals

    @action(detail=True, methods=['post'])
    def upvote(self, request, pk=None):
        solution = self.get_object()
        solution.upvotes += 1
        solution.save(update_fields=['upvotes'])
        # Award XP to solution author
        from .services import award_xp
        profile, _ = Profile.objects.get_or_create(user=solution.user)
        profile.total_upvotes_received = Solution.objects.filter(user=solution.user).aggregate(t=Sum('upvotes'))['t'] or 0
        profile.save(update_fields=['total_upvotes_received'])
        award_xp(solution.user, 3, 'Upvote received')
        return Response({'upvotes': solution.upvotes})


class CommentViewSet(viewsets.ModelViewSet):
    serializer_class = CommentSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        qs = Comment.objects.all()
        if self.request.query_params.get('question'):
            qs = qs.filter(question_id=self.request.query_params['question'])
        if self.request.query_params.get('user') == 'me':
            qs = qs.filter(user=self.request.user)
        return qs

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=['post'])
    def upvote(self, request, pk=None):
        comment = self.get_object()
        comment.upvotes += 1
        comment.save()
        return Response({'upvotes': comment.upvotes})

    def update(self, request, *args, **kwargs):
        if self.get_object().user != request.user:
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if self.get_object().user != request.user:
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)


class NotificationViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)

    @action(detail=True, methods=['post'])
    def read(self, request, pk=None):
        n = self.get_object()
        n.is_read = True
        n.save()
        return Response({'status': 'read'})


# ─── Contributor Analytics Views ──────────────────────────────────────────────

class CommunityOverviewView(APIView):
    """GET /api/community/contributors/ — global community stats."""
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({
            'total_contributors': Profile.objects.filter(xp__gt=0).count(),
            'total_solutions':    Solution.objects.count(),
            'total_comments':     Comment.objects.count(),
            'total_badges':       UserBadge.objects.count(),
        })


class MyStatsView(APIView):
    """GET /api/community/contributors/stats/me/ — rich stats for logged-in user."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from quiz.models import UserExamResult, UserTopicProgress
        profile, _ = Profile.objects.get_or_create(user=request.user)

        exams_solved = UserExamResult.objects.filter(user=request.user).count()
        avg_score    = UserExamResult.objects.filter(user=request.user).aggregate(a=Avg('percentage'))['a'] or 0
        roadmap_done = UserTopicProgress.objects.filter(user=request.user, status='done').count()

        # 7-day activity chart
        today = timezone.now().date()
        weekly = []
        for i in range(6, -1, -1):
            day = today - timedelta(days=i)
            cnt = ContributorActivity.objects.filter(
                user=request.user, created_at__date=day
            ).count()
            weekly.append({'day': day.strftime('%a'), 'date': day.isoformat(), 'contributions': cnt})

        # Full year heatmap activity
        from django.db.models.functions import TruncDate
        one_year_ago = today - timedelta(days=365)
        daily_counts = (
            ContributorActivity.objects.filter(
                user=request.user, created_at__date__gte=one_year_ago
            )
            .annotate(date=TruncDate('created_at'))
            .values('date')
            .annotate(count=Count('id'))
            .order_by('date')
        )
        heatmap_activity = []
        for item in daily_counts:
            count = item['count']
            level = 1 if count == 1 else 2 if count <= 3 else 3 if count <= 5 else 4
            heatmap_activity.append({
                'date': item['date'].isoformat(),
                'count': count,
                'level': level
            })

        badges = UserBadge.objects.filter(user=request.user).select_related('badge')

        return Response({
            'username':         request.user.username,
            'full_name':        request.user.get_full_name() or request.user.username,
            'avatar_char':      profile.avatar_char,
            'bio':              profile.bio,
            'xp':               profile.xp,
            'streak':           profile.streak,
            'best_streak':      profile.best_streak,
            'total_solutions':  profile.total_solutions,
            'total_comments':   profile.total_comments,
            'total_upvotes_received': profile.total_upvotes_received,
            'total_views':      profile.total_views,
            'uploads_approved': profile.uploads_approved,
            'suggestions_approved': profile.suggestions_approved,
            'reputation_score': profile.reputation_score,
            'community_rank':   profile.community_rank,
            'percentile':       profile.percentile,
            'exams_solved':     exams_solved,
            'avg_score':        round(avg_score, 1),
            'roadmap_topics_done': roadmap_done,
            'weekly_activity':  weekly,
            'heatmap_activity': heatmap_activity,
            'badges': [
                {
                    'name':           ub.badge.name,
                    'slug':           ub.badge.slug,
                    'description':    ub.badge.description,
                    'color_gradient': ub.badge.color_gradient,
                    'awarded_at':     ub.awarded_at.isoformat(),
                }
                for ub in badges
            ],
        })


class TopContributorsView(APIView):
    """GET /api/community/contributors/top/?page=1&per_page=10"""
    permission_classes = [AllowAny]

    def get(self, request):
        page     = max(1, int(request.query_params.get('page', 1)))
        per_page = min(50, int(request.query_params.get('per_page', 10)))
        offset   = (page - 1) * per_page

        total    = Profile.objects.filter(xp__gt=0).count()
        profiles = (
            Profile.objects.filter(xp__gt=0)
            .order_by('community_rank')
            .select_related('user')[offset:offset + per_page]
        )

        data = []
        for p in profiles:
            badges = list(
                UserBadge.objects.filter(user=p.user)
                .select_related('badge')
                .values('badge__name', 'badge__slug', 'badge__color_gradient')[:3]
            )
            data.append({
                'username':         p.user.username,
                'name':             p.user.get_full_name() or p.user.username,
                'avatar_char':      p.avatar_char,
                'xp':               p.xp,
                'reputation_score': p.reputation_score,
                'community_rank':   p.community_rank,
                'percentile':       p.percentile,
                'total_solutions':  p.total_solutions,
                'total_upvotes_received': p.total_upvotes_received,
                'streak':           p.streak,
                'badges':           badges,
            })

        return Response({
            'results':      data,
            'total':        total,
            'page':         page,
            'per_page':     per_page,
            'total_pages':  math.ceil(total / per_page) if total else 1,
        })


class ActivityFeedView(APIView):
    """GET /api/community/contributors/activity/?page=1"""
    permission_classes = [AllowAny]

    def get(self, request):
        page     = max(1, int(request.query_params.get('page', 1)))
        per_page = 20
        offset   = (page - 1) * per_page

        activities = (
            ContributorActivity.objects
            .select_related('user', 'user__profile')
            .order_by('-created_at')[offset:offset + per_page]
        )

        data = []
        for act in activities:
            avatar = act.user.username[0].upper()
            try:
                avatar = act.user.profile.avatar_char or avatar
            except Exception:
                pass
            data.append({
                'username':      act.user.username,
                'avatar_char':   avatar,
                'activity_type': act.activity_type,
                'description':   act.description,
                'metadata':      act.metadata,
                'created_at':    act.created_at.isoformat(),
            })

        return Response({'results': data, 'page': page, 'has_more': len(data) == per_page})


class CategoryLeaderboardView(APIView):
    """GET /api/community/contributors/leaderboard/?days=30"""
    permission_classes = [AllowAny]

    def get(self, request):
        from .services import get_category_leaderboard
        days = int(request.query_params.get('days', 30))
        return Response(get_category_leaderboard(days=days))


class BadgesListView(APIView):
    """GET /api/community/contributors/badges/ — all badges + earned status."""
    permission_classes = [AllowAny]

    def get(self, request):
        earned_slugs = set()
        if request.user.is_authenticated:
            earned_slugs = set(
                UserBadge.objects.filter(user=request.user).values_list('badge__slug', flat=True)
            )

        data = []
        for b in Badge.objects.filter(is_active=True):
            data.append({
                'name':            b.name,
                'slug':            b.slug,
                'description':     b.description,
                'icon':            b.icon,
                'color_gradient':  b.color_gradient,
                'criteria_type':   b.criteria_type,
                'criteria_value':  b.criteria_value,
                'earned':          b.slug in earned_slugs,
            })
        return Response(data)


class ContributorProfileView(APIView):
    """GET /api/community/contributors/profile/<username>/"""
    permission_classes = [AllowAny]

    def get(self, request, username):
        from django.contrib.auth.models import User
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=404)

        profile, _ = Profile.objects.get_or_create(user=user)
        badges  = UserBadge.objects.filter(user=user).select_related('badge')
        recent  = Solution.objects.filter(user=user).order_by('-created_at')[:5]

        from django.db.models.functions import TruncDate
        from django.db.models import Count
        from django.utils import timezone
        from datetime import timedelta
        
        today = timezone.now().date()
        one_year_ago = today - timedelta(days=365)
        daily_counts = (
            ContributorActivity.objects.filter(
                user=user, created_at__date__gte=one_year_ago
            )
            .annotate(date=TruncDate('created_at'))
            .values('date')
            .annotate(count=Count('id'))
            .order_by('date')
        )
        heatmap_activity = []
        for item in daily_counts:
            count = item['count']
            level = 1 if count == 1 else 2 if count <= 3 else 3 if count <= 5 else 4
            heatmap_activity.append({
                'date': item['date'].isoformat(),
                'count': count,
                'level': level
            })

        return Response({
            'username':         user.username,
            'name':             user.get_full_name() or user.username,
            'avatar_char':      profile.avatar_char,
            'bio':              profile.bio,
            'xp':               profile.xp,
            'streak':           profile.streak,
            'best_streak':      profile.best_streak,
            'total_solutions':  profile.total_solutions,
            'total_comments':   profile.total_comments,
            'total_upvotes_received': profile.total_upvotes_received,
            'reputation_score': profile.reputation_score,
            'community_rank':   profile.community_rank,
            'percentile':       profile.percentile,
            'heatmap_activity': heatmap_activity,
            'badges': [
                {'name': ub.badge.name, 'slug': ub.badge.slug, 'color_gradient': ub.badge.color_gradient}
                for ub in badges
            ],
            'recent_solutions': [
                {'id': s.id, 'question_id': s.question_id, 'upvotes': s.upvotes, 'created_at': s.created_at.isoformat()}
                for s in recent
            ],
        })
