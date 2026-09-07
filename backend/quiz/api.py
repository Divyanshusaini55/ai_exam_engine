from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated, AllowAny, IsAdminUser
from .api_throttles import AIHeavyThrottle, AILightThrottle
from .api_session import SessionMixin
from .api_summary import SummaryMixin
from .api_dashboard import DashboardMixin
from .api_leaderboard import LeaderboardMixin
from .api_upload import UploadMixin
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.shortcuts import get_object_or_404
from django.core.cache import cache
from django.db.models import Count, Sum
from django.db import models, transaction
from django.utils import timezone
from django.contrib.auth.models import User
import uuid

from .ai import generate_explanation_for_question, parse_exam_paper_with_ai

from .models import (
    Exam, Question, UserAnswer, ExamAttempt, PracticeSession,
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
    queryset = Category.objects.filter(is_active=True).exclude(
        slug__in=[
            'current-affairs', 
            'economy-finance', 
            'polity-governance', 
            'science-technology', 
            'international-relations', 
            'environment-ecology', 
            'defence-security', 
            'society-social-justice', 
            'geography-disasters', 
            'history-culture'
        ]
    ).prefetch_related('subcategories')
    serializer_class = CategorySerializer
    permission_classes = [AllowAny]
    lookup_field = 'slug'


class SubCategoryViewSet(viewsets.ReadOnlyModelViewSet):
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


class ExamViewSet(SessionMixin, SummaryMixin, DashboardMixin, LeaderboardMixin, UploadMixin, viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for listing and retrieving published exams.
    """
    queryset = Exam.objects.filter(is_active=True, status='published').annotate(
        question_count=Count('questions')
    ).select_related('subcategory__category').order_by('-created_at')
    serializer_class = ExamSerializer
    permission_classes = [AllowAny]
    lookup_field = 'slug'

    def get_queryset(self):
        queryset = super().get_queryset()
        category_slug = self.request.query_params.get('category')  # e.g. 'ssc'
        subcategory_slug = self.request.query_params.get('subcategory')  # e.g. 'ssc-cgl'
        
        if category_slug:
            queryset = queryset.filter(subcategory__category__slug=category_slug)
        if subcategory_slug:
            queryset = queryset.filter(subcategory__slug=subcategory_slug)
            
        return queryset

    def get_object(self):
        queryset = self.filter_queryset(self.get_queryset())
        lookup_url_kwarg = self.lookup_url_kwarg or self.lookup_field
        lookup_value = self.kwargs.get(lookup_url_kwarg) or self.kwargs.get('pk') or self.kwargs.get('id')

        if not lookup_value:
            lookup_value = self.kwargs.get('slug')

        if lookup_value:
            lookup_str = str(lookup_value)
            if lookup_str.isdigit():
                try:
                    obj = queryset.get(id=int(lookup_str))
                    self.check_object_permissions(self.request, obj)
                    return obj
                except queryset.model.DoesNotExist:
                    pass

            obj = queryset.filter(slug__iexact=lookup_str).first()
            if not obj:
                from django.http import Http404
                raise Http404(f"Exam '{lookup_str}' not found")
            self.check_object_permissions(self.request, obj)
            return obj

        return super().get_object()


    def retrieve(self, request, *args, **kwargs):
        lang = request.query_params.get('lang', 'en')
        exam_slug = kwargs.get('slug')
        cache_key = f"exam:{exam_slug}:{lang}"
        
        cached_data = cache.get(cache_key)
        if cached_data:
            return Response(cached_data)
            
        response = super().retrieve(request, *args, **kwargs)
        cache.set(cache_key, response.data, 300)
        return response


    @action(detail=True, methods=['get'])
    def questions(self, request, slug=None):
        lang = request.query_params.get('lang', 'en')
        mode = request.query_params.get('mode', 'exam')
        session_id = request.query_params.get('session_id')
        user = request.user if request.user.is_authenticated else None
        exam = self.get_object()

        # Anti-cheat check: if user or session has an active uncompleted ExamAttempt for this exam, force hide_correct = True
        has_active_exam_attempt = False
        if user:
            has_active_exam_attempt = ExamAttempt.objects.filter(user=user, exam=exam, is_completed=False).exists()
        elif session_id:
            has_active_exam_attempt = ExamAttempt.objects.filter(session_id=session_id, exam=exam, is_completed=False).exists()

        hide_correct = (mode == 'exam') or has_active_exam_attempt
        cache_key = f"exam_questions:{exam.slug}:{lang}:{hide_correct}"
        
        cached_data = cache.get(cache_key)
        if cached_data:
            return Response(cached_data)
            
        questions = exam.questions.all().order_by('examquestion__order').prefetch_related('community_comments', 'images')

        serializer = QuestionSerializer(
            questions,
            many=True,
            context={
                'request': request,
                'hide_correct': hide_correct,
                'lang': lang,
                'exam_slug': exam.slug,
            }
        )
        cache.set(cache_key, serializer.data, 300)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def submit_answer(self, request, slug=None, pk=None, **kwargs):
        exam = self.get_object()

        session_id = request.data.get('session_id')
        question_id = request.data.get('question_id')
        answer_id = request.data.get('answer_id')
        selected_options = request.data.get('selected_options')
        text_answer = request.data.get('text_answer')
        answer_payload = request.data.get('answer_payload', {})
        is_flagged_for_review = request.data.get('is_flagged_for_review')
        is_bookmarked = request.data.get('is_bookmarked')

        if not session_id:
            return Response(
                {'error': 'session_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Anti-cheat: verify exam is not already submitted
        if ExamAttempt.objects.filter(session_id=session_id, exam=exam, is_completed=True).exists():
            return Response(
                {'error': 'Exam has already been submitted. Further modifications are disabled.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Server-side timer check
        active_attempt = ExamAttempt.objects.filter(session_id=session_id, exam=exam, is_completed=False).first()
        if active_attempt and exam.duration_minutes and exam.duration_minutes > 0:
            elapsed = (timezone.now() - active_attempt.started_at).total_seconds()
            max_allowed = (exam.duration_minutes * 60) + 30  # 30-second network grace window
            if elapsed > max_allowed:
                return Response(
                    {'error': 'Exam duration limit has expired.'},
                    status=status.HTTP_403_FORBIDDEN
                )

        question = get_object_or_404(Question, id=question_id, exams=exam)

        defaults = {
            'exam': exam,
        }

        payload = question.schema_payload or {}
        q_type = payload.get('question_type') or question.question_type or 'mcq_single'
        options = payload.get('options', [])
        correct_options = (payload.get('answer') or {}).get('correct_options', [])
        
        # 1. Normalize selected_options from input
        chosen_indices = []
        if selected_options is not None:
            if isinstance(selected_options, list):
                for item in selected_options:
                    try:
                        chosen_indices.append(int(item))
                    except (ValueError, TypeError):
                        # Match option label like 'A', 'B', 'C', 'D'
                        for idx, opt in enumerate(options):
                            if isinstance(opt, dict) and opt.get('id') == str(item):
                                chosen_indices.append(idx)
                                break
        elif answer_id is not None and str(answer_id).strip() != "":
            try:
                chosen_indices = [int(answer_id)]
            except (ValueError, TypeError):
                for idx, opt in enumerate(options):
                    if isinstance(opt, dict) and opt.get('id') == str(answer_id):
                        chosen_indices = [idx]
                        break

        defaults['selected_options'] = chosen_indices

        # 2. Store text_answer or answer_payload for NAT / Subjective
        if text_answer is not None or answer_payload:
            user_payload = dict(answer_payload)
            if text_answer is not None:
                user_payload['text_answer'] = str(text_answer).strip()
            defaults['answer_payload'] = user_payload

        # 3. Evaluate correctness based on V2 question_type
        is_correct = False
        if q_type in ['mcq_single', 'multiple_choice']:
            if chosen_indices:
                ans_idx = chosen_indices[0]
                if 0 <= ans_idx < len(options):
                    opt = options[ans_idx]
                    if isinstance(opt, dict):
                        is_correct = bool(opt.get('is_correct', False)) or (opt.get('id') in correct_options) or (chr(65 + ans_idx) in correct_options)
                    else:
                        is_correct = (ans_idx == 0)
        elif q_type == 'mcq_multi':
            # Multiple-choice multi-select: all correct options must be selected and zero wrong options
            if chosen_indices and options:
                selected_labels = set()
                for idx in chosen_indices:
                    if 0 <= idx < len(options):
                        opt = options[idx]
                        lbl = opt.get('id', chr(65 + idx)) if isinstance(opt, dict) else chr(65 + idx)
                        selected_labels.add(lbl)
                target_correct = set(correct_options) if correct_options else {
                    opt.get('id', chr(65 + i)) for i, opt in enumerate(options) if isinstance(opt, dict) and opt.get('is_correct')
                }
                is_correct = (selected_labels == target_correct and len(target_correct) > 0)
        elif q_type == 'nat':
            # Numerical Answer Type: check if user value is within [min, max] with epsilon tolerance
            ans_info = payload.get('answer') or {}
            val_str = (defaults.get('answer_payload') or {}).get('text_answer', '')
            try:
                user_val = float(val_str)
                min_val = ans_info.get('min')
                max_val = ans_info.get('max')
                exact_val = ans_info.get('value')
                
                if min_val is not None and max_val is not None:
                    is_correct = ((float(min_val) - 1e-6) <= user_val <= (float(max_val) + 1e-6))
                elif exact_val is not None:
                    is_correct = abs(user_val - float(exact_val)) < 1e-4
            except (ValueError, TypeError):
                is_correct = False
        elif q_type == 'subjective':
            # Subjective: pending manual/AI review, no auto-wrong mark
            is_correct = None

        defaults['is_correct'] = is_correct

        if is_flagged_for_review is not None:
            defaults['is_flagged_for_review'] = is_flagged_for_review
        if is_bookmarked is not None:
            defaults['is_bookmarked'] = is_bookmarked

        user_answer, _ = UserAnswer.objects.update_or_create(
            session_id=session_id,
            question=question,
            defaults=defaults
        )

        serializer = UserAnswerSerializer(user_answer, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['post'], permission_classes=[AllowAny])
    def start(self, request, slug=None, pk=None, **kwargs):
        exam = self.get_object()
        mode = request.data.get('mode', 'exam')  # 'exam' or 'learning'
        session_id = request.data.get('session_id')
        
        if mode not in ['exam', 'learning']:
            return Response({'error': 'Invalid mode'}, status=status.HTTP_400_BAD_REQUEST)
            
        user = request.user if request.user.is_authenticated else None
        now = timezone.now()
        
        # Check if there is an active (incomplete) session/attempt of the same mode to resume
        if mode == 'exam':
            active_attempt = None
            if user:
                active_attempt = ExamAttempt.objects.filter(user=user, exam=exam, is_completed=False).order_by('-started_at').first()
            elif session_id:
                active_attempt = ExamAttempt.objects.filter(session_id=session_id, exam=exam, is_completed=False).first()
                
            if active_attempt:
                elapsed_seconds = int((now - active_attempt.started_at).total_seconds()) if active_attempt.started_at else (active_attempt.duration or 0)
                max_allowed = (exam.duration_minutes * 60) if (exam.duration_minutes and exam.duration_minutes > 0) else None
                
                # If attempt duration has expired, close it out cleanly and allow a fresh start
                if max_allowed and elapsed_seconds >= max_allowed:
                    active_attempt.is_completed = True
                    active_attempt.completed_at = now
                    active_attempt.duration = max_allowed
                    active_attempt.save()
                    active_attempt = None
                else:
                    return Response({
                        'success': True,
                        'session_id': active_attempt.session_id,
                        'mode': mode,
                        'current_question_index': active_attempt.current_question_index,
                        'duration': elapsed_seconds,
                        'started_at': active_attempt.started_at.isoformat() if active_attempt.started_at else now.isoformat()
                    })
                
            new_session_id = str(uuid.uuid4())
            attempt = ExamAttempt.objects.create(
                user=user,
                exam=exam,
                session_id=new_session_id,
                score=0,
                total_questions=exam.questions.count(),
                correct_answers=0,
                percentage=0.0,
                duration=0,
                started_at=now,
                is_completed=False
            )
            return Response({
                'success': True,
                'session_id': new_session_id,
                'mode': mode,
                'current_question_index': 0,
                'duration': 0,
                'started_at': attempt.started_at.isoformat()
            })
        else:
            active_session = None
            if user:
                active_session = PracticeSession.objects.filter(user=user, exam=exam, is_completed=False).order_by('-started_at').first()
            elif session_id:
                active_session = PracticeSession.objects.filter(session_id=session_id, exam=exam, is_completed=False).first()
                
            if active_session:
                return Response({
                    'success': True,
                    'session_id': active_session.session_id,
                    'mode': mode,
                    'current_question_index': active_session.current_question_index,
                    'duration': active_session.duration or 0,
                    'started_at': active_session.started_at.isoformat() if active_session.started_at else now.isoformat()
                })
                
            new_session_id = str(uuid.uuid4())
            session = PracticeSession.objects.create(
                user=user,
                exam=exam,
                session_id=new_session_id,
                score=0,
                total_questions=exam.questions.count(),
                correct_answers=0,
                accuracy=0.0,
                duration=0,
                started_at=now,
                is_completed=False
            )
            return Response({
                'success': True,
                'session_id': new_session_id,
                'mode': mode,
                'current_question_index': 0,
                'duration': 0,
                'started_at': session.started_at.isoformat()
            })

    @action(detail=True, methods=['post'], permission_classes=[AllowAny])
    @transaction.atomic
    def submit(self, request, slug=None, pk=None, **kwargs):
        exam = self.get_object()
        session_id = request.data.get('session_id')
        mode = request.data.get('mode', 'exam')
        client_duration = request.data.get('duration', 0)
        
        if not session_id:
            return Response({'error': 'session_id is required'}, status=status.HTTP_400_BAD_REQUEST)
            
        user = request.user if request.user.is_authenticated else None
        guest_name = request.data.get("name", "Guest")
        guest_email = request.data.get("email", "")
        
        user_answers = UserAnswer.objects.filter(exam=exam, session_id=session_id).select_related('question')
        total_questions = exam.questions.count()
        
        positive_score = 0.0
        correct_answers_count = 0
        wrong_answers_count = 0
        
        for ua in user_answers:
            q_payload = (ua.question.schema_payload or {})
            q_type = q_payload.get('question_type') or ua.question.question_type or 'mcq_single'
            pos_mark = float(q_payload.get('marks') or q_payload.get('marking', {}).get('positive') or exam.marks_per_question or 1.0)
            
            if q_type == 'subjective':
                # Subjective: pending manual/AI review, do NOT count as wrong or deduct negative marks
                continue
                
            if ua.is_correct is True:
                positive_score += pos_mark
                correct_answers_count += 1
            elif ua.is_correct is False:
                # Has user attempted this question?
                has_attempt = bool(ua.selected_options) or bool((ua.answer_payload or {}).get('text_answer'))
                if has_attempt:
                    # Check for mcq_multi partial credit
                    if q_type == 'mcq_multi':
                        options = q_payload.get('options', [])
                        correct_options = (q_payload.get('answer') or {}).get('correct_options', [])
                        target_correct = set(correct_options) if correct_options else {
                            opt.get('id', chr(65 + i)) for i, opt in enumerate(options) if isinstance(opt, dict) and opt.get('is_correct')
                        }
                        selected_labels = set()
                        for idx in ua.selected_options:
                            if 0 <= idx < len(options):
                                opt = options[idx]
                                lbl = opt.get('id', chr(65 + idx)) if isinstance(opt, dict) else chr(65 + idx)
                                selected_labels.add(lbl)
                        
                        wrong_selected = selected_labels - target_correct
                        correct_selected = selected_labels.intersection(target_correct)
                        if not wrong_selected and len(correct_selected) > 0 and len(target_correct) > 0:
                            # Award partial proportional credit
                            awarded = pos_mark * (len(correct_selected) / len(target_correct))
                            positive_score += awarded
                            continue
                            
                    wrong_answers_count += 1
        
        penalty = float(wrong_answers_count) * float(exam.negative_marks or 0.0)
        score = max(0.0, float(positive_score) - penalty)
        accuracy = round((correct_answers_count / total_questions * 100) if total_questions > 0 else 0, 2)
        now = timezone.now()
        
        if mode == 'exam':
            attempts = ExamAttempt.objects.select_for_update().filter(session_id=session_id, exam=exam)
            if attempts.exists():
                attempt = attempts.first()
                actual_duration = int((now - attempt.started_at).total_seconds()) if attempt.started_at else client_duration
                attempt.user = user or attempt.user
                attempt.score = score
                attempt.total_questions = total_questions
                attempt.correct_answers = correct_answers_count
                attempt.percentage = accuracy
                attempt.duration = actual_duration
                attempt.completed_at = now
                attempt.is_completed = True
                if not user:
                    attempt.guest_name = guest_name
                    attempt.guest_email = guest_email
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
                    correct_answers=correct_answers_count,
                    percentage=accuracy,
                    duration=client_duration,
                    started_at=now,
                    completed_at=now,
                    is_completed=True,
                    guest_name=guest_name if not user else None,
                    guest_email=guest_email if not user else None,
                )
            return Response({
                'success': True,
                'message': 'Exam submitted successfully!',
                'result_id': attempt.id,
                'score': score,
                'positive_score': positive_score,
                'penalty': penalty,
                'correct': correct_answers_count,
                'wrong': wrong_answers_count,
                'total': total_questions,
                'percentage': attempt.percentage,
                'attempt_id': attempt.id 
            })
        else:
            sessions = PracticeSession.objects.select_for_update().filter(session_id=session_id, exam=exam)
            if sessions.exists():
                session = sessions.first()
                actual_duration = int((now - session.started_at).total_seconds()) if session.started_at else client_duration
                session.user = user or session.user
                session.score = score
                session.total_questions = total_questions
                session.correct_answers = correct_answers_count
                session.accuracy = accuracy
                session.duration = actual_duration
                session.submitted_at = now
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
                    correct_answers=correct_answers_count,
                    accuracy=accuracy,
                    duration=client_duration,
                    started_at=now,
                    submitted_at=now,
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
                'positive_score': positive_score,
                'penalty': penalty,
                'accuracy': accuracy,
                'correct': correct_answers_count,
                'wrong': wrong_answers_count,
                'weak_topics': weak_topics
            })

    @action(detail=True, methods=['post'], permission_classes=[AllowAny])
    def submit_exam(self, request, slug=None, pk=None, **kwargs):
        return self.submit(request, slug=slug, pk=pk, **kwargs)





from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from .models import ContactMessage
from .serializers import ContactMessageSerializer


@api_view(['POST'])
@permission_classes([AllowAny])
def submit_contact_message(request):
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
    messages = ContactMessage.objects.all()
    serializer = ContactMessageSerializer(messages, many=True)
    return Response(serializer.data)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated, IsAdminUser])
def update_contact_message_status(request, message_id):
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

    @action(detail=False, methods=['get'])
    def categories(self, request):
        """Return all categories that have current affairs articles, with counts.

        GET /api/current-affairs/categories/
        → [{"name": "Economy & Finance", "slug": "economy-finance", "count": 5}, ...]
        """
        from django.db.models import Count
        from .models import Category

        cats = (
            Category.objects
            .filter(currentaffair__isnull=False)
            .annotate(count=Count('currentaffair'))
            .order_by('-count')
            .values('id', 'name', 'slug', 'count')
        )
        return Response(list(cats))


from .models import ExamRoadmap, RoadmapTopic, UserTopicProgress
from .serializers import ExamRoadmapSerializer
from django.utils import timezone

class ExamRoadmapViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ExamRoadmapSerializer
    permission_classes = [AllowAny]
    lookup_field = 'subcategory__slug'

    def get_queryset(self):
        user = self.request.user
        from django.db.models import Prefetch
        from .models import ExamRoadmap, TopicResource, UserTopicProgress, ResourceBookmark, ResourceProgress
        
        prefetches = [
            'phases',
            'phases__topics',
            'phases__topics__prerequisites',
        ]
        
        if user and user.is_authenticated:
            prefetches.append(
                Prefetch(
                    'phases__topics__progress',
                    queryset=UserTopicProgress.objects.filter(user=user),
                    to_attr='prefetched_user_progress'
                )
            )
            # Prefetch for topic resources with user-specific bookmarks and progress
            resource_qs = TopicResource.objects.filter(is_published=True).prefetch_related(
                'tags',
                Prefetch(
                    'bookmarks',
                    queryset=ResourceBookmark.objects.filter(user=user),
                    to_attr='prefetched_bookmarks'
                ),
                Prefetch(
                    'user_progress',
                    queryset=ResourceProgress.objects.filter(user=user),
                    to_attr='prefetched_progress'
                )
            ).order_by('order', 'created_at')
            prefetches.append(
                Prefetch(
                    'phases__topics__topic_resources',
                    queryset=resource_qs,
                    to_attr='published_resources'
                )
            )
        else:
            resource_qs = TopicResource.objects.filter(is_published=True).prefetch_related('tags').order_by('order', 'created_at')
            prefetches.append(
                Prefetch(
                    'phases__topics__topic_resources',
                    queryset=resource_qs,
                    to_attr='published_resources'
                )
            )
            
        return ExamRoadmap.objects.select_related('subcategory').prefetch_related(*prefetches)

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
            from django.db import connection
            if connection.vendor == 'postgresql':
                from django.contrib.postgres.search import SearchVector, SearchQuery, SearchRank
                
                vector = SearchVector('title', weight='A') + \
                         SearchVector('short_description', weight='B') + \
                         SearchVector('ai_summary', weight='C') + \
                         SearchVector('markdown_content', weight='D')
                query = SearchQuery(search)
                
                qs = qs.annotate(
                    search=vector,
                    rank=SearchRank(vector, query)
                ).filter(search=query).order_by('-rank')
            else:
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
        instance = self.get_object()
        TopicResource.objects.filter(pk=instance.pk).update(
            view_count=models.F('view_count') + 1
        )
        instance.refresh_from_db(fields=['view_count'])
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def bookmark(self, request, pk=None):
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
        resource = self.get_object()
        progress, _ = ResourceProgress.objects.get_or_create(
            user=request.user, resource=resource
        )
        progress.is_completed = not progress.is_completed
        progress.save()
        return Response({'is_completed': progress.is_completed})

    @action(detail=True, methods=['post'], permission_classes=[IsAdminUser])
    def ai_summary(self, request, pk=None):
        """Generate AI summary via Vertex AI and persist it."""
        from quiz.ai.gemini_client import GeminiClient

        resource = self.get_object()
        content = (
            resource.markdown_content
            or resource.html_content
            or resource.latex_content
            or resource.short_description
        )
        if not content:
            return Response({'error': 'No content to summarize'}, status=400)

        try:
            client = GeminiClient()
            prompt = (
                f"Summarize the following educational resource in 2-3 concise sentences "
                f"suitable for competitive exam preparation. "
                f"Resource title: '{resource.title}'.\n\n{content[:3000]}"
            )
            response = client.generate_content(prompt)
            resource.ai_summary = response.get('text', '').strip()
            resource.is_ai_generated = True
            resource.save(update_fields=['ai_summary', 'is_ai_generated'])
            return Response({'ai_summary': resource.ai_summary})
        except Exception as e:
            return Response({'error': str(e)}, status=500)
