from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.db.models import Sum, Count, Q
from django.contrib.auth.models import User

from .models import ExamAttempt

class LeaderboardMixin:
    @action(detail=False, methods=['get'], permission_classes=[AllowAny])
    def leaderboard(self, request):
        exam_slug = request.query_params.get('exam_slug') or request.query_params.get('exam_id')
        leaderboard_data = []

        if exam_slug:
            results = ExamAttempt.objects.filter(exam__slug=exam_slug, is_completed=True).select_related('user', 'exam').order_by('-score')
            
            user_best_map = {}
            for r in results:
                identity = r.user_id if r.user_id else r.session_id
                if identity not in user_best_map:
                    user_best_map[identity] = r
            
            sorted_results = sorted(user_best_map.values(), key=lambda x: x.score, reverse=True)
            
            rank = 1
            for r in sorted_results:
                username = r.user.username if r.user else (r.guest_name or f"Guest-{str(r.session_id)[:4]}")
                leaderboard_data.append({
                    "rank": rank,
                    "username": username,
                    "score": r.score,
                    "total_questions": r.total_questions,
                    "percentage": r.percentage,
                    "date": r.completed_at,
                    "exam_title": r.exam.title
                })
                rank += 1
                
            from core.pagination import LeaderboardPagination
            paginator = LeaderboardPagination()
            page = paginator.paginate_queryset(leaderboard_data, request)
            if page is not None:
                return paginator.get_paginated_response(page)
                
        else:
            auth_users = User.objects.annotate(
                total_score=Sum('exam_results__score', filter=Q(exam_results__is_completed=True)),
                exams_taken=Count('exam_results', filter=Q(exam_results__is_completed=True))
            ).filter(total_score__isnull=False)

            for u in auth_users:
                leaderboard_data.append({
                    "username": u.username,
                    "score": u.total_score,
                    "exams_taken": u.exams_taken,
                    "date": "-",
                    "exam_title": "All Exams"
                })

            # Guest users
            guest_attempts = ExamAttempt.objects.filter(user__isnull=True, is_completed=True).values('session_id', 'guest_name').annotate(
                total_score=Sum('score'),
                exams_taken=Count('id')
            ).filter(total_score__isnull=False)

            for g in guest_attempts:
                username = g['guest_name'] or f"Guest-{str(g['session_id'])[:4]}"
                leaderboard_data.append({
                    "username": username,
                    "score": g['total_score'],
                    "exams_taken": g['exams_taken'],
                    "date": "-",
                    "exam_title": "All Exams"
                })

            # Sort by total score descending
            leaderboard_data.sort(key=lambda x: x['score'], reverse=True)

            # Assign ranks
            for i, entry in enumerate(leaderboard_data):
                entry['rank'] = i + 1
        
        from core.pagination import LeaderboardPagination
        paginator = LeaderboardPagination()
        page = paginator.paginate_queryset(leaderboard_data, request)
        if page is not None:
            return paginator.get_paginated_response(page)

        return Response(leaderboard_data)
