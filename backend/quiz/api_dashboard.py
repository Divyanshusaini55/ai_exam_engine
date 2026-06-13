from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.db import models

from .models import ExamAttempt, PracticeSession, UserAnswer
from .serializers import ExamResultSerializer, UserAnswerSerializer, QuestionSerializer

class DashboardMixin:
    @action(detail=True, methods=['get'])
    def results(self, request, pk=None):
        exam = self.get_object()
        session_id = request.query_params.get('session_id')
        if not request.user.is_authenticated and not session_id:
            return Response(
                {'error': 'Authentication or Session ID required to view results'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        user_result = None
        is_practice = False
        
        if session_id:
            user_result = ExamAttempt.objects.filter(
                session_id=session_id, 
                exam=exam,
                is_completed=True
            ).order_by('-completed_at').first()
            
        if not user_result and request.user.is_authenticated:
            user_result = ExamAttempt.objects.filter(
                user=request.user, 
                exam=exam,
                is_completed=True
            ).order_by('-completed_at').first()
            
        if not user_result:
            if session_id:
                user_result = PracticeSession.objects.filter(
                    session_id=session_id,
                    exam=exam,
                    is_completed=True
                ).order_by('-submitted_at').first()
            if not user_result and request.user.is_authenticated:
                user_result = PracticeSession.objects.filter(
                    user=request.user,
                    exam=exam,
                    is_completed=True
                ).order_by('-submitted_at').first()
            if user_result:
                is_practice = True

        if not user_result:
            return Response(
                {'error': 'No results found for this exam. Please complete the exam first.'},
                status=status.HTTP_404_NOT_FOUND
            )
        user_answers = UserAnswer.objects.filter(
            exam=exam,
            session_id=user_result.session_id
        ).select_related('question', 'selected_answer')

        total_questions = exam.questions.count()
        correct_answers = user_answers.filter(is_correct=True).count()

        total_points = user_answers.filter(is_correct=True).aggregate(
            total=models.Sum('question__points')
        )['total'] or 0

        max_points = exam.questions.aggregate(
            total=models.Sum('points')
        )['total'] or 0
        
        percentage = user_result.accuracy if is_practice else user_result.percentage
        completed_at = user_result.submitted_at if is_practice else user_result.completed_at
        summary_data = {
            'exam_id': exam.id,
            'exam_title': exam.title,
            'session_id': user_result.session_id,
            'total_questions': user_result.total_questions,
            'answered_questions': user_answers.count(),
            'correct_answers': user_result.correct_answers,
            'total_points': user_result.score,
            'max_points': max_points,
            'percentage': percentage,
            'completed_at': completed_at,
        }

        summary_serializer = ExamResultSerializer(summary_data)
        answers_data = UserAnswerSerializer(
            user_answers,
            many=True
        ).data

        all_questions = exam.questions.all().prefetch_related('answers')
        questions_data = QuestionSerializer(
            all_questions,
            many=True,
            context={'hide_correct': False}
        ).data

        return Response({
            **summary_serializer.data,
            "answers": answers_data,
            "questions": questions_data # New Field
        })

    @action(detail=False, methods=['get'])
    def dashboard_stats(self, request):
        print(f"DASHBOARD DEBUG: User={request.user}, Auth={request.auth}")
        if not request.user.is_authenticated:
            return Response(
                {'error': 'Authentication required'}, 
                status=status.HTTP_401_UNAUTHORIZED
            )

        results = ExamAttempt.objects.select_related(
            'exam',
            'exam__subcategory',
            'exam__subcategory__category'
        ).filter(user=request.user, is_completed=True)
        
        total_tests = results.count()
        avg_score = results.aggregate(avg=models.Avg('percentage'))['avg'] or 0
        tests_passed = results.filter(percentage__gte=50).count()

        # Calculate total study time from both exam attempts and practice sessions (in seconds)
        exam_duration = results.aggregate(total=models.Sum('duration'))['total'] or 0
        practice_duration = PracticeSession.objects.filter(
            user=request.user, is_completed=True
        ).aggregate(total=models.Sum('duration'))['total'] or 0
        total_study_seconds = exam_duration + practice_duration

        return Response({
            'total_tests': total_tests,
            'average_score': round(avg_score, 1),
            'tests_passed': tests_passed,
            'total_study_seconds': total_study_seconds,
            'history': [
                {
                    'name': r.exam.title[:10] + '...',  # Shorten for chart
                    'date': r.completed_at.strftime('%Y-%m-%d'),
                    'score': r.percentage
                }
                for r in results.order_by('-completed_at')[:7][::-1] # Last 7, reversed for chrono order
            ],
            'subject_performance': [
                {
                    'name': item['exam__subcategory__category__name'], 
                    'score': round(item['avg_score'], 1)
                }
                for item in results.values('exam__subcategory__category__name').annotate(avg_score=models.Avg('percentage'))
                if item['exam__subcategory__category__name'] 
            ],
            'recent_activities': [
                {
                    'id': r.id,
                    'exam_id': r.exam.id,
                    'session_id': r.session_id,
                    'exam_title': r.exam.title,
                    'score': r.percentage,
                    'date': r.completed_at.isoformat(),
                    'category': r.exam.subcategory.category.name if r.exam.subcategory and r.exam.subcategory.category else 'Uncategorized'
                }
                for r in results.order_by('-completed_at')[:5]
            ]
        })
