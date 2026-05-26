from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.shortcuts import get_object_or_404
from django.core.cache import cache
from django.db.models import Count, Sum
from django.db import models 
from django.contrib.auth.models import User
import uuid

from .ai import generate_explanation_for_question, parse_exam_paper_with_ai

from .models import (
    Exam, Question, Answer, UserAnswer, ExamAttempt, PracticeSession,
    Category, SubCategory, CorrectionSuggestion,
    TopicResource, ResourceBookmark, ResourceProgress,
    RoadmapTopic,
)
from .serializers import (
    ExamSerializer,
    QuestionSerializer,
    UserAnswerSerializer,
    ExamResultSerializer,
    CategorySerializer,
    SubCategorySerializer,
    CorrectionSuggestionSerializer,
    TopicResourceSerializer,
    TopicResourceListSerializer,
)


class CategoryViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for listing all active categories with exam counts.
    """
    queryset = Category.objects.filter(is_active=True).prefetch_related('subcategories')
    serializer_class = CategorySerializer
    permission_classes = [AllowAny]
    lookup_field = 'slug'


class SubCategoryViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for listing subcategories, optionally filtered by category slug.
    """
    queryset = SubCategory.objects.filter(is_active=True).select_related('category')
    serializer_class = SubCategorySerializer
    permission_classes = [AllowAny]
    lookup_field = 'slug'
    
    def get_queryset(self):
        queryset = super().get_queryset()
        category_slug = self.request.query_params.get('category')
        if category_slug:
            queryset = queryset.filter(category__slug=category_slug)
        return queryset


class ExamViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for listing and retrieving published exams.
    """
    queryset = Exam.objects.filter(is_active=True, status='published').annotate(
        question_count=Count('questions')
    ).select_related('subcategory__category')
    serializer_class = ExamSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        queryset = super().get_queryset()
        category_slug = self.request.query_params.get('category')  # e.g. 'ssc'
        subcategory_slug = self.request.query_params.get('subcategory')  # e.g. 'ssc-cgl'
        
        if category_slug:
            queryset = queryset.filter(subcategory__category__slug=category_slug)
        if subcategory_slug:
            queryset = queryset.filter(subcategory__slug=subcategory_slug)
            
        return queryset

    def retrieve(self, request, *args, **kwargs):
        lang = request.query_params.get('lang', 'en')
        exam_id = kwargs.get('pk')
        cache_key = f"exam:{exam_id}:{lang}"
        
        cached_data = cache.get(cache_key)
        if cached_data:
            return Response(cached_data)
            
        response = super().retrieve(request, *args, **kwargs)
        cache.set(cache_key, response.data, 300)
        return response

    @action(detail=True, methods=['post'])
    def parse_pdf(self, request, pk=None):
        exam = self.get_object()
        
        # Optional: Allow uploading a new PDF to replace the old one
        if 'pdf_file' in request.FILES:
            exam.pdf_file = request.FILES['pdf_file']
            exam.save()

        if not exam.pdf_file:
            return Response(
                {'error': 'No PDF file associated with this exam.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # Trigger CPU-bound/Network-bound task
            # In production, use Celery!
            question_count = parse_exam_paper_with_ai(exam)
            
            return Response({
                'message': 'Exam parsed successfully!',
                'questions_created': question_count
            })
            
        except Exception as e:
            print(f"Parse Error: {e}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['get'])
    def questions(self, request, pk=None):
        lang = request.query_params.get('lang', 'en')
        mode = request.query_params.get('mode', 'exam')
        
        hide_correct = (mode == 'exam')
        cache_key = f"exam_questions:{pk}:{lang}:{hide_correct}"
        
        cached_data = cache.get(cache_key)
        if cached_data:
            return Response(cached_data)
            
        exam = self.get_object()
        questions = exam.questions.all().prefetch_related('answers', 'community_comments')

        serializer = QuestionSerializer(
            questions,
            many=True,
            context={
                'request': request,
                'hide_correct': hide_correct,
                'lang': lang
            }
        )
        cache.set(cache_key, serializer.data, 300)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def submit_answer(self, request, pk=None):
        exam = self.get_object()

        session_id = request.data.get('session_id')
        question_id = request.data.get('question_id')
        answer_id = request.data.get('answer_id')
        text_answer = request.data.get('text_answer', '')
        is_flagged_for_review = request.data.get('is_flagged_for_review')
        is_bookmarked = request.data.get('is_bookmarked')

        if not session_id:
            return Response(
                {'error': 'session_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        question = get_object_or_404(Question, id=question_id, exam=exam)

        defaults = {
            'exam': exam,
            'text_answer': text_answer,
        }

        if answer_id is not None:
            if answer_id:
                selected_answer = get_object_or_404(
                    Answer,
                    id=answer_id,
                    question=question
                )
                defaults['selected_answer'] = selected_answer
                defaults['is_correct'] = selected_answer.is_correct
            else:
                defaults['selected_answer'] = None
                defaults['is_correct'] = False

        if is_flagged_for_review is not None:
            defaults['is_flagged_for_review'] = is_flagged_for_review
        if is_bookmarked is not None:
            defaults['is_bookmarked'] = is_bookmarked

        user_answer, _ = UserAnswer.objects.update_or_create(
            session_id=session_id,
            question=question,
            defaults=defaults
        )

        serializer = UserAnswerSerializer(user_answer)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def progress(self, request, pk=None):
        exam = self.get_object()
        session_id = request.query_params.get('session_id')
        if not session_id:
            return Response({'error': 'session_id is required'}, status=400)
        
        user_answers = UserAnswer.objects.filter(exam=exam, session_id=session_id)
        
        answers_dict = {ua.question_id: ua.selected_answer_id for ua in user_answers if ua.selected_answer_id is not None}
        review_list = [ua.question_id for ua in user_answers if ua.is_flagged_for_review]
        bookmarked_list = [ua.question_id for ua in user_answers if ua.is_bookmarked]
        visited_list = list(user_answers.values_list('question_id', flat=True))
        
        return Response({
            'answers': answers_dict,
            'review': review_list,
            'bookmarked': bookmarked_list,
            'visited': visited_list
        })

    @action(detail=True, methods=['get', 'post'], permission_classes=[AllowAny])
    def summary(self, request, pk=None):
        exam = self.get_object()
        
        # Check if force parameter is passed to regenerate summary
        force = request.data.get('force', False) or request.query_params.get('force', 'false').lower() == 'true'
        if exam.ai_summary and not force:
            return Response({'ai_summary': exam.ai_summary})
            
        from django.core.cache import cache
        import threading
        
        cache_key = f"exam_{exam.id}_summary_generating"
        
        if not cache.get(cache_key):
            cache.set(cache_key, True, timeout=300) # Lock for 5 minutes
            
            def background_generate(exam_id, is_force):
                try:
                    from quiz.models import Exam
                    from quiz.ai.summary_service import ExamSummaryService
                    import logging
                    
                    thread_exam = Exam.objects.get(pk=exam_id)
                    service = ExamSummaryService()
                    service.generate_summary(thread_exam, force=is_force)
                except Exception as e:
                    import logging
                    logging.getLogger('quiz.ai').error(f"Background summary generation failed: {e}")
                finally:
                    cache.delete(f"exam_{exam_id}_summary_generating")

            thread = threading.Thread(target=background_generate, args=(exam.id, force))
            thread.daemon = True
            thread.start()
            
        return Response({
            'status': 'processing', 
            'message': 'AI summary is currently being generated. This takes about a minute. Please check back shortly.'
        }, status=202)

    @action(detail=True, methods=['post'], permission_classes=[AllowAny])
    def start(self, request, pk=None):
        exam = self.get_object()
        mode = request.data.get('mode', 'exam')  # 'exam' or 'learning'
        session_id = request.data.get('session_id')
        
        if mode not in ['exam', 'learning']:
            return Response({'error': 'Invalid mode'}, status=status.HTTP_400_BAD_REQUEST)
            
        user = request.user if request.user.is_authenticated else None
        
        # Check if there is an active (incomplete) session/attempt of the same mode to resume
        if mode == 'exam':
            active_attempt = None
            if user:
                active_attempt = ExamAttempt.objects.filter(user=user, exam=exam, is_completed=False).order_by('-completed_at').first()
            elif session_id:
                active_attempt = ExamAttempt.objects.filter(session_id=session_id, exam=exam, is_completed=False).first()
                
            if active_attempt:
                return Response({
                    'success': True,
                    'session_id': active_attempt.session_id,
                    'mode': mode,
                    'current_question_index': active_attempt.current_question_index,
                    'duration': active_attempt.duration
                })
                
            # Otherwise create a new one
            new_session_id = session_id or str(uuid.uuid4())
            ExamAttempt.objects.create(
                user=user,
                exam=exam,
                session_id=new_session_id,
                score=0,
                total_questions=exam.questions.count(),
                correct_answers=0,
                percentage=0.0,
                duration=0,
                is_completed=False
            )
            return Response({
                'success': True,
                'session_id': new_session_id,
                'mode': mode,
                'current_question_index': 0,
                'duration': 0
            })
        else:
            active_session = None
            if user:
                active_session = PracticeSession.objects.filter(user=user, exam=exam, is_completed=False).order_by('-submitted_at').first()
            elif session_id:
                active_session = PracticeSession.objects.filter(session_id=session_id, exam=exam, is_completed=False).first()
                
            if active_session:
                return Response({
                    'success': True,
                    'session_id': active_session.session_id,
                    'mode': mode,
                    'current_question_index': active_session.current_question_index,
                    'duration': active_session.duration
                })
                
            new_session_id = session_id or str(uuid.uuid4())
            PracticeSession.objects.create(
                user=user,
                exam=exam,
                session_id=new_session_id,
                score=0,
                total_questions=exam.questions.count(),
                correct_answers=0,
                accuracy=0.0,
                duration=0,
                is_completed=False
            )
            return Response({
                'success': True,
                'session_id': new_session_id,
                'mode': mode,
                'current_question_index': 0,
                'duration': 0
            })

    @action(detail=True, methods=['post'], permission_classes=[AllowAny])
    def update_session(self, request, pk=None):
        exam = self.get_object()
        session_id = request.data.get('session_id')
        mode = request.data.get('mode', 'exam')
        duration = request.data.get('duration')
        current_question_index = request.data.get('current_question_index')
        question_id = request.data.get('question_id')
        
        if not session_id:
            return Response({'error': 'session_id is required'}, status=status.HTTP_400_BAD_REQUEST)
            
        updates = {}
        if duration is not None:
            updates['duration'] = duration
        if current_question_index is not None:
            updates['current_question_index'] = current_question_index
            
        if updates:
            if mode == 'exam':
                ExamAttempt.objects.filter(session_id=session_id, exam=exam).update(**updates)
            else:
                PracticeSession.objects.filter(session_id=session_id, exam=exam).update(**updates)
                
        if question_id:
            UserAnswer.objects.get_or_create(
                session_id=session_id,
                exam=exam,
                question_id=question_id
            )
            
        return Response({'success': True})

    @action(detail=True, methods=['post'], permission_classes=[AllowAny])
    def submit(self, request, pk=None):
        exam = self.get_object()
        session_id = request.data.get('session_id')
        mode = request.data.get('mode', 'exam')
        duration = request.data.get('duration', 0)
        
        if not session_id:
            return Response({'error': 'session_id is required'}, status=status.HTTP_400_BAD_REQUEST)
            
        user = request.user if request.user.is_authenticated else None
        guest_name = request.data.get("name", "Guest")
        guest_email = request.data.get("email", "")
        
        user_answers = UserAnswer.objects.filter(exam=exam, session_id=session_id)
        total_questions = exam.questions.count()
        correct_answers = user_answers.filter(is_correct=True).count()
        wrong_answers = user_answers.filter(is_correct=False).exclude(selected_answer__isnull=True).count()
        
        score = user_answers.filter(is_correct=True).aggregate(
            total=models.Sum('question__points')
        )['total'] or 0
        
        accuracy = round((correct_answers / total_questions * 100) if total_questions > 0 else 0, 2)
        
        if mode == 'exam':
            attempts = ExamAttempt.objects.filter(session_id=session_id, exam=exam)
            if attempts.exists():
                attempt = attempts.first()
                attempt.user = user
                attempt.score = score
                attempt.total_questions = total_questions
                attempt.correct_answers = correct_answers
                attempt.percentage = accuracy
                attempt.duration = duration
                attempt.is_completed = True
                attempt.guest_name = guest_name if not user else None
                attempt.guest_email = guest_email if not user else None
                attempt.save()
                
                if attempts.count() > 1:
                    attempts.exclude(id=attempt.id).delete()
            else:
                attempt = ExamAttempt.objects.create(
                    session_id=session_id,
                    exam=exam,
                    user=user,
                    score=score,
                    total_questions=total_questions,
                    correct_answers=correct_answers,
                    percentage=accuracy,
                    duration=duration,
                    is_completed=True,
                    guest_name=guest_name if not user else None,
                    guest_email=guest_email if not user else None,
                )
            return Response({
                'success': True,
                'message': 'Exam submitted successfully!',
                'result_id': attempt.id,
                'score': score,
                'total': total_questions,
                'percentage': attempt.percentage,
                'attempt_id': attempt.id 
            })
        else:
            sessions = PracticeSession.objects.filter(session_id=session_id, exam=exam)
            if sessions.exists():
                session = sessions.first()
                session.user = user
                session.score = score
                session.total_questions = total_questions
                session.correct_answers = correct_answers
                session.accuracy = accuracy
                session.duration = duration
                session.is_completed = True
                session.save()
                
                if sessions.count() > 1:
                    sessions.exclude(id=session.id).delete()
            else:
                session = PracticeSession.objects.create(
                    session_id=session_id,
                    exam=exam,
                    user=user,
                    score=score,
                    total_questions=total_questions,
                    correct_answers=correct_answers,
                    accuracy=accuracy,
                    duration=duration,
                    is_completed=True
                )
            
            # Calculate weak areas
            from django.db.models import Count, Q
            topic_stats = user_answers.values('question__topic').annotate(
                total=Count('id'),
                correct=Count('id', filter=Q(is_correct=True))
            )
            weak_topics = []
            for stat in topic_stats:
                topic_name = stat['question__topic']
                if not topic_name:
                    continue
                tot = stat['total']
                corr = stat['correct']
                acc = (corr / tot) if tot > 0 else 0
                if acc < 0.7:
                    weak_topics.append(topic_name)
                    
            return Response({
                'score': score,
                'accuracy': accuracy,
                'correct': correct_answers,
                'wrong': wrong_answers,
                'weak_topics': weak_topics
            })

    @action(detail=True, methods=['post'], permission_classes=[AllowAny])
    def pause(self, request, pk=None):
        exam = self.get_object()
        session_id = request.data.get('session_id')
        mode = request.data.get('mode', 'learning')
        duration = request.data.get('duration', 0)
        
        if mode == 'exam':
            return Response(
                {'error': 'Pause is disabled in Exam Mode'},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        if not session_id:
            return Response(
                {'error': 'session_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        PracticeSession.objects.filter(session_id=session_id).update(duration=duration)
        return Response({'success': True, 'message': 'Practice session paused successfully'})

    @action(detail=True, methods=['post'], permission_classes=[AllowAny])
    def reset(self, request, pk=None):
        exam = self.get_object()
        session_id = request.data.get('session_id')
        mode = request.data.get('mode', 'learning')
        
        if mode == 'exam':
            return Response(
                {'error': 'Reset is disabled in Exam Mode'},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        if not session_id:
            return Response(
                {'error': 'session_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        UserAnswer.objects.filter(exam=exam, session_id=session_id).delete()
        PracticeSession.objects.filter(session_id=session_id).update(
            score=0,
            correct_answers=0,
            accuracy=0.0,
            duration=0
        )
        return Response({'success': True, 'message': 'Practice session reset successfully'})

    @action(detail=True, methods=['post'], permission_classes=[AllowAny])
    def submit_exam(self, request, pk=None):
        """
        Delegates to the submit action.
        """
        return self.submit(request, pk=pk)

    @action(detail=True, methods=['get'])
    def results(self, request, pk=None):
        """
        Get exam results for the authenticated user OR guest (via session_id).
        SECURITY: Results are scoped to user/session + exam.
        """
        exam = self.get_object()
        session_id = request.query_params.get('session_id')
        
        # AUTH / SESSION CHECK
        if not request.user.is_authenticated and not session_id:
            return Response(
                {'error': 'Authentication or Session ID required to view results'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # CHECK IF USER HAS COMPLETED THIS EXAM OR PRACTICE SESSION
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
        
        # FETCH USER'S ANSWERS using the session_id from their result
        user_answers = UserAnswer.objects.filter(
            exam=exam,
            session_id=user_result.session_id
        ).select_related('question', 'selected_answer')

        total_questions = exam.questions.count()
        correct_answers = user_answers.filter(is_correct=True).count()

        total_points = user_answers.filter(is_correct=True).aggregate(
            total=Sum('question__points')
        )['total'] or 0

        max_points = exam.questions.aggregate(
            total=Sum('points')
        )['total'] or 0
        
        percentage = user_result.accuracy if is_practice else user_result.percentage
        completed_at = user_result.submitted_at if is_practice else user_result.completed_at

        # SUMMARY DATA (using saved result)
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

        # ANSWERS SERIALIZED SEPARATELY
        answers_data = UserAnswerSerializer(
            user_answers,
            many=True
        ).data

        # FULL QUESTIONS WITH CORRECT ANSWERS (FOR REVIEW)
        all_questions = exam.questions.all().prefetch_related('answers')
        questions_data = QuestionSerializer(
            all_questions,
            many=True,
            context={'hide_correct': False} # Explicitly Show Correct Answers
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

        results = ExamAttempt.objects.filter(user=request.user, is_completed=True)
        
        total_tests = results.count()
        avg_score = results.aggregate(avg=models.Avg('percentage'))['avg'] or 0
        tests_passed = results.filter(percentage__gte=50).count()

        return Response({
            'total_tests': total_tests,
            'average_score': round(avg_score, 1),
            'tests_passed': tests_passed,
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
                if item['exam__subcategory__category__name']  # Filter out None values
            ],
            'recent_activities': [
                {
                    'id': r.id,
                    'exam_title': r.exam.title,
                    'score': r.percentage,
                    'date': r.completed_at.isoformat(),
                    'category': r.exam.subcategory.category.name if r.exam.subcategory and r.exam.subcategory.category else 'Uncategorized'
                }
                for r in results.order_by('-completed_at')[:5]
            ]
        })

    @action(detail=False, methods=['post'])
    def explain_question(self, request):
        # ... (implementation remains same) ...
        question_id = request.data.get('question_id')
        
        if not question_id:
            return Response({'error': 'Question ID required'}, status=400)
            
        question = get_object_or_404(Question, id=question_id)
        
        # 1. Check if we already have it (Cache logic)
        if question.explanation:
            return Response({'explanation': question.explanation})
            
        # 2. If not, generate it using AI
        explanation = generate_explanation_for_question(question)
        
        # 3. Save it for next time
        question.explanation = explanation
        question.save()
        
        return Response({'explanation': explanation})

    @action(detail=False, methods=['get'])
    def leaderboard(self, request):
        exam_id = request.query_params.get('exam_id')
        leaderboard_data = []

        if exam_id:
            # Per-Exam Leaderboard (Highest Score per User/Guest)
            results = ExamAttempt.objects.filter(exam_id=exam_id, is_completed=True).select_related('user', 'exam').order_by('-score')
            
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
                
        else:
            # Global Leaderboard (Reputation / Total Score sum)
            from django.db.models import Q
            
            # Authenticated users
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

        return Response(leaderboard_data)


from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from .models import ContactMessage
from .serializers import ContactMessageSerializer


@api_view(['POST'])
@permission_classes([AllowAny])
def submit_contact_message(request):
    """
    Public API endpoint to submit a contact support message.
    No authentication required.
    """
    serializer = ContactMessageSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response({
            'success': True,
            'message': 'Message sent successfully'
        }, status=status.HTTP_200_OK)
    return Response({
        'success': False,
        'message': 'Failed to send message'
    }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdminUser])
def list_contact_messages(request):
    """
    Admin-only API endpoint to list all contact messages.
    Ordered by newest first.
    """
    messages = ContactMessage.objects.all()
    serializer = ContactMessageSerializer(messages, many=True)
    return Response(serializer.data)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated, IsAdminUser])
def update_contact_message_status(request, message_id):
    """
    Admin-only API endpoint to update message status (read/unread).
    """
    try:
        message = ContactMessage.objects.get(id=message_id)
        new_status = request.data.get('status', 'read')
        if new_status not in ['read', 'unread']:
            return Response({'error': 'Invalid status. Must be "read" or "unread".'}, 
                          status=status.HTTP_400_BAD_REQUEST)
        message.status = new_status
        message.save()
        serializer = ContactMessageSerializer(message)
        return Response(serializer.data)
    except ContactMessage.DoesNotExist:
        return Response({'error': 'Message not found'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated, IsAdminUser])
def delete_contact_message(request, message_id):
    """
    Admin-only API endpoint to delete a contact message.
    """
    try:
        message = ContactMessage.objects.get(id=message_id)
        message.delete()
        return Response({'success': True, 'message': 'Message deleted successfully'}, 
                       status=status.HTTP_204_NO_CONTENT)
    except ContactMessage.DoesNotExist:
        return Response({'error': 'Message not found'}, status=status.HTTP_404_NOT_FOUND)

from .models import QuestionPaperUpload
from .serializers import QuestionPaperUploadSerializer
from rest_framework.permissions import IsAuthenticated

class QuestionPaperUploadViewSet(viewsets.ModelViewSet):
    queryset = QuestionPaperUpload.objects.all()
    serializer_class = QuestionPaperUploadSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Users only see their own uploads, admins see all
        if self.request.user.is_staff:
            return QuestionPaperUpload.objects.all()
        return QuestionPaperUpload.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class CorrectionSuggestionViewSet(viewsets.ModelViewSet):
    queryset = CorrectionSuggestion.objects.all()
    serializer_class = CorrectionSuggestionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        question_id = self.request.query_params.get('question_id')
        if question_id:
            return self.queryset.filter(question_id=question_id)
        return self.queryset

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=['post'])
    def upvote(self, request, pk=None):
        suggestion = self.get_object()
        suggestion.upvotes += 1
        suggestion.save()
        return Response({'upvotes': suggestion.upvotes})

from .models import CurrentAffair
from .serializers import CurrentAffairSerializer

class CurrentAffairViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = CurrentAffair.objects.all()
    serializer_class = CurrentAffairSerializer
    permission_classes = [AllowAny]
    lookup_field = 'slug'

    def get_queryset(self):
        category_slug = self.request.query_params.get('category')
        if category_slug:
            return self.queryset.filter(category__slug=category_slug)
        return self.queryset


from .models import ExamRoadmap, RoadmapTopic, UserTopicProgress
from .serializers import ExamRoadmapSerializer
from django.utils import timezone

class ExamRoadmapViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ExamRoadmap.objects.all()
    serializer_class = ExamRoadmapSerializer
    permission_classes = [AllowAny]
    lookup_field = 'subcategory__slug'

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def bookmark(self, request, subcategory__slug=None):
        roadmap = self.get_object()
        user = request.user
        
        if roadmap.bookmarks.filter(id=user.id).exists():
            roadmap.bookmarks.remove(user)
            is_bookmarked = False
        else:
            roadmap.bookmarks.add(user)
            is_bookmarked = True
            
        return Response({'is_bookmarked': is_bookmarked})

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated], url_path='topics/(?P<topic_id>[^/.]+)/status')
    def update_topic_status(self, request, topic_id=None):
        try:
            topic = RoadmapTopic.objects.get(id=topic_id)
            progress, created = UserTopicProgress.objects.get_or_create(user=request.user, topic=topic)
            
            new_status = request.data.get('status')
            valid_statuses = [choice[0] for choice in UserTopicProgress.STATUS_CHOICES]
            
            if new_status in valid_statuses:
                progress.status = new_status
                if new_status == 'done':
                    progress.completed_at = timezone.now()
                progress.save()
                return Response({'status': progress.status})
            else:
                return Response({'error': 'Invalid status'}, status=400)
                
        except RoadmapTopic.DoesNotExist:
            return Response({'error': 'Topic not found'}, status=404)


class TopicResourceViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint for TopicResource.
    - List: published resources, filterable by ?topic=, ?resource_type=, ?difficulty=, ?search=, ?featured=
    - Retrieve: full resource including content + increments view_count
    - bookmark/: toggle bookmark (auth required)
    - complete/: toggle completed (auth required)
    - ai_summary/: generate Gemini summary (admin only)
    """
    permission_classes = [AllowAny]

    def get_queryset(self):
        qs = TopicResource.objects.filter(is_published=True).select_related(
            'topic', 'created_by'
        ).prefetch_related('tags')

        topic_id = self.request.query_params.get('topic')
        resource_type = self.request.query_params.get('resource_type')
        difficulty = self.request.query_params.get('difficulty')
        search = self.request.query_params.get('search')
        featured = self.request.query_params.get('featured')

        if topic_id:
            qs = qs.filter(topic_id=topic_id)
        if resource_type:
            qs = qs.filter(resource_type=resource_type)
        if difficulty:
            qs = qs.filter(difficulty=difficulty)
        if featured:
            qs = qs.filter(is_featured=True)
        if search:
            from django.db.models import Q
            qs = qs.filter(
                Q(title__icontains=search)
                | Q(short_description__icontains=search)
                | Q(markdown_content__icontains=search)
                | Q(ai_summary__icontains=search)
            )

        return qs.order_by('order', 'created_at')

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return TopicResourceSerializer
        return TopicResourceListSerializer

    def retrieve(self, request, *args, **kwargs):
        """Increment view_count atomically on each fetch."""
        instance = self.get_object()
        TopicResource.objects.filter(pk=instance.pk).update(
            view_count=models.F('view_count') + 1
        )
        instance.refresh_from_db(fields=['view_count'])
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def bookmark(self, request, pk=None):
        """Toggle bookmark for the current user."""
        resource = self.get_object()
        bookmark, created = ResourceBookmark.objects.get_or_create(
            user=request.user, resource=resource
        )
        if not created:
            bookmark.delete()
            return Response({'is_bookmarked': False})
        return Response({'is_bookmarked': True})

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def complete(self, request, pk=None):
        """Toggle completion status for the current user."""
        resource = self.get_object()
        progress, _ = ResourceProgress.objects.get_or_create(
            user=request.user, resource=resource
        )
        progress.is_completed = not progress.is_completed
        progress.save()
        return Response({'is_completed': progress.is_completed})

    @action(detail=True, methods=['post'], permission_classes=[IsAdminUser])
    def ai_summary(self, request, pk=None):
        """Generate AI summary via Gemini and persist it."""
        import os
        import google.generativeai as genai

        resource = self.get_object()
        api_key = os.environ.get('GEMINI_API_KEY')
        if not api_key:
            return Response({'error': 'GEMINI_API_KEY not configured'}, status=500)

        content = (
            resource.markdown_content
            or resource.html_content
            or resource.latex_content
            or resource.short_description
        )
        if not content:
            return Response({'error': 'No content to summarize'}, status=400)

        try:
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel('gemini-1.5-flash')
            prompt = (
                f"Summarize the following educational resource in 2-3 concise sentences "
                f"suitable for competitive exam preparation. "
                f"Resource title: '{resource.title}'.\\n\\n{content[:3000]}"
            )
            response = model.generate_content(prompt)
            resource.ai_summary = response.text.strip()
            resource.is_ai_generated = True
            resource.save(update_fields=['ai_summary', 'is_ai_generated'])
            return Response({'ai_summary': resource.ai_summary})
        except Exception as e:
            return Response({'error': str(e)}, status=500)
