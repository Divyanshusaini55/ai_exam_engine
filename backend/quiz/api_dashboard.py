from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.db import models

from .models import ExamAttempt, PracticeSession, UserAnswer
from .serializers import ExamResultSerializer, UserAnswerSerializer, QuestionSerializer

class DashboardMixin:
    @action(detail=True, methods=['get'])
    def results(self, request, slug=None, pk=None, **kwargs):
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
            ).order_by('-started_at').first()
            
        if not user_result and request.user.is_authenticated:
            user_result = ExamAttempt.objects.filter(
                user=request.user, 
                exam=exam,
                is_completed=True
            ).order_by('-started_at').first()
            
        if not user_result:
            if session_id:
                user_result = PracticeSession.objects.filter(
                    session_id=session_id,
                    exam=exam,
                    is_completed=True
                ).order_by('-started_at').first()
            if not user_result and request.user.is_authenticated:
                user_result = PracticeSession.objects.filter(
                    user=request.user,
                    exam=exam,
                    is_completed=True
                ).order_by('-started_at').first()
            if user_result:
                is_practice = True

        if not user_result:
            return Response(
                {'error': 'No results found for this exam. Please complete the exam first.'},
                status=status.HTTP_404_NOT_FOUND
            )

        # IDOR check: If result is bound to a registered user, ensure requester is that user or staff
        if user_result.user and request.user.is_authenticated:
            if user_result.user != request.user and not request.user.is_staff:
                return Response(
                    {'error': 'You do not have permission to view this scorecard.'},
                    status=status.HTTP_403_FORBIDDEN
                )
        user_answers = UserAnswer.objects.filter(
            exam=exam,
            session_id=user_result.session_id
        ).select_related('question')

        total_questions = exam.questions.count()
        correct_answers = user_answers.filter(is_correct=True).count()
        wrong_answers = user_answers.filter(is_correct=False).exclude(selected_options=[]).count()
        penalty = float(wrong_answers) * float(exam.negative_marks or 0.0)

        total_marks = sum(
            float((ua.question.schema_payload or {}).get('marks', exam.marks_per_question or 1.0))
            for ua in user_answers.filter(is_correct=True).select_related('question')
        )

        if exam.total_marks:
            max_marks = float(exam.total_marks)
        else:
            all_questions_list = list(exam.questions.all())
            max_marks = sum(
                float((q.schema_payload or {}).get('marks', exam.marks_per_question or 1.0))
                for q in all_questions_list
            ) or (total_questions * float(exam.marks_per_question or 1.0))
        
        percentage = user_result.accuracy if is_practice else user_result.percentage
        completed_at = user_result.submitted_at if is_practice else user_result.completed_at
        summary_data = {
            'exam_id': str(exam.id),
            'exam_title': exam.title,
            'session_id': user_result.session_id,
            'total_questions': user_result.total_questions,
            'answered_questions': user_answers.count(),
            'correct_answers': user_result.correct_answers,
            'total_marks': user_result.score,
            'max_marks': max_marks,
            'percentage': percentage,
            'completed_at': completed_at,
            'penalty': penalty,
            'wrong_answers': wrong_answers,
        }

        summary_serializer = ExamResultSerializer(summary_data)
        answers_data = UserAnswerSerializer(
            user_answers,
            many=True,
            context={'request': request}
        ).data

        all_questions = exam.questions.all().prefetch_related('community_comments', 'images')
        questions_data = QuestionSerializer(
            all_questions,
            many=True,
            context={'hide_correct': False, 'request': request}
        ).data

        return Response({
            **summary_serializer.data,
            "answers": answers_data,
            "questions": questions_data
        })

    @action(detail=False, methods=['get'])
    def dashboard_stats(self, request):
        print(f"DASHBOARD DEBUG: User={request.user}, Auth={request.auth}")
        if not request.user.is_authenticated:
            return Response(
                {'error': 'Authentication required'}, 
                status=status.HTTP_401_UNAUTHORIZED
            )

        results_attempts = list(ExamAttempt.objects.select_related(
            'exam',
            'exam__subcategory',
            'exam__subcategory__category'
        ).filter(user=request.user, is_completed=True))
        
        results_practice = list(PracticeSession.objects.select_related(
            'exam',
            'exam__subcategory',
            'exam__subcategory__category'
        ).filter(user=request.user, is_completed=True))

        # Normalize practice session fields to match exam attempts
        all_results = []
        for r in results_attempts:
            all_results.append({
                'id': r.id,
                'exam_id': r.exam.id,
                'exam_slug': r.exam.slug,
                'session_id': r.session_id,
                'exam_title': r.exam.title,
                'score': r.percentage,
                'date_obj': r.completed_at,
                'duration': r.duration,
                'category_name': r.exam.subcategory.category.name if r.exam.subcategory and r.exam.subcategory.category else 'Uncategorized',
                'type': 'exam'
            })
            
        for r in results_practice:
            all_results.append({
                'id': r.id,
                'exam_id': r.exam.id,
                'exam_slug': r.exam.slug,
                'session_id': r.session_id,
                'exam_title': r.exam.title,
                'score': r.accuracy,  # PracticeSession uses 'accuracy'
                'date_obj': r.submitted_at, # PracticeSession uses 'submitted_at'
                'duration': r.duration,
                'category_name': r.exam.subcategory.category.name if r.exam.subcategory and r.exam.subcategory.category else 'Uncategorized',
                'type': 'practice'
            })
            
        all_results.sort(key=lambda x: x['date_obj'], reverse=True)
        
        total_tests = len(all_results)
        tests_passed = sum(1 for r in all_results if r['score'] >= 50)
        avg_score = sum(r['score'] for r in all_results) / total_tests if total_tests > 0 else 0
        total_study_seconds = sum(r['duration'] for r in all_results)

        # Subject performance
        subject_scores = {}
        subject_counts = {}
        for r in all_results:
            cat = r['category_name']
            subject_scores[cat] = subject_scores.get(cat, 0) + r['score']
            subject_counts[cat] = subject_counts.get(cat, 0) + 1

        subject_performance = [
            {'name': cat, 'score': round(subject_scores[cat] / subject_counts[cat], 1)}
            for cat in subject_scores
        ]

        # History (last 7, chronological)
        history = [
            {
                'name': r['exam_title'][:10] + '...',
                'date': r['date_obj'].strftime('%Y-%m-%d'),
                'score': r['score']
            }
            for r in all_results[:7]
        ][::-1]

        # Recent activities (last 5)
        recent_activities = [
            {
                'id': r['id'],
                'exam_id': r['exam_id'],
                'exam_slug': r['exam_slug'],
                'session_id': r['session_id'],
                'exam_title': r['exam_title'],
                'score': r['score'],
                'date': r['date_obj'].isoformat(),
                'category': r['category_name'],
                'type': r['type']
            }
            for r in all_results[:5]
        ]

        return Response({
            'total_tests': total_tests,
            'average_score': round(avg_score, 1),
            'tests_passed': tests_passed,
            'total_study_seconds': total_study_seconds,
            'history': history,
            'subject_performance': subject_performance,
            'recent_activities': recent_activities
        })
