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
    queryset = Category.objects.filter(is_active=True).prefetch_related('subcategories')
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
    def submit_exam(self, request, pk=None):
        return self.submit(request, pk=pk)





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
