from rest_framework import viewsets, status, views
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from django.shortcuts import get_object_or_404
from django.db.models import Count, Sum
from django.contrib.auth.models import User

from .models import (
    Exam, Question, Answer, UserAnswer, ExamAttempt, Category, SubCategory,
    ContactMessage, QuestionPaperUpload, CorrectionSuggestion, CurrentAffair,
    TopicResource, ExamRoadmap, RoadmapPhase, RoadmapTopic, ResourceTag, Topic
)
from .serializers import (
    ExamSerializer, QuestionSerializer, CategorySerializer, SubCategorySerializer,
    CorrectionSuggestionSerializer, CurrentAffairSerializer,
    QuestionPaperUploadSerializer, ContactMessageSerializer, TopicResourceSerializer,
    ExamRoadmapSerializer, RoadmapPhaseSerializer, RoadmapTopicSerializer, ResourceTagSerializer,
    TopicSerializer
)

class AdminDashboardStatsView(views.APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request):
        from jobs.models import BackgroundJob
        from community.models import Solution
        from django.utils import timezone
        
        total_users = User.objects.count()
        active_users = User.objects.filter(is_active=True).count()
        total_exams = Exam.objects.count()
        total_questions = Question.objects.count()
        total_attempts = ExamAttempt.objects.filter(is_completed=True).count()
        active_current_affairs = CurrentAffair.objects.count()
        pending_suggestions = CorrectionSuggestion.objects.filter(status='pending').count()
        unread_messages = ContactMessage.objects.filter(status='unread').count()
        
        pending_jobs = BackgroundJob.objects.filter(status__in=['QUEUED', 'RUNNING']).count()
        today = timezone.now().date()
        new_solutions_today = Solution.objects.filter(created_at__date=today).count()

        recent_attempts = ExamAttempt.objects.filter(is_completed=True).select_related('user', 'exam').order_by('-completed_at')[:5]
        recent_attempts_data = [
            {
                'id': str(attempt.id),
                'user': attempt.user.email if attempt.user else (attempt.guest_name or 'Guest'),
                'exam_title': attempt.exam.title,
                'score': attempt.score,
                'accuracy': attempt.percentage,
                'completed_at': attempt.completed_at
            }
            for attempt in recent_attempts
        ]

        recent_users = User.objects.order_by('-date_joined')[:5]
        recent_users_data = [
            {
                'id': user.id,
                'email': user.email,
                'name': f"{user.first_name} {user.last_name}".strip() or user.username,
                'is_staff': user.is_staff,
                'date_joined': user.date_joined
            }
            for user in recent_users
        ]

        return Response({
            'stats': {
                'total_users': total_users,
                'active_users': active_users,
                'total_exams': total_exams,
                'total_questions': total_questions,
                'total_attempts': total_attempts,
                'active_current_affairs': active_current_affairs,
                'pending_suggestions': pending_suggestions,
                'unread_messages': unread_messages,
                'pending_jobs': pending_jobs,
                'new_solutions_today': new_solutions_today
            },
            'recent_attempts': recent_attempts_data,
            'recent_users': recent_users_data
        })


class AdminCategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all().order_by('order', 'name')
    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    lookup_field = 'id'
    pagination_class = None


class AdminSubCategoryViewSet(viewsets.ModelViewSet):
    queryset = SubCategory.objects.select_related('category').all().order_by('category__name', 'order', 'name')
    serializer_class = SubCategorySerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    lookup_field = 'id'
    pagination_class = None

    @action(detail=True, methods=['post'])
    def trigger_roadmap(self, request, id=None):
        subcategory = self.get_object()
        try:
            from tasks.roadmap_tasks import generate_exam_roadmap
            generate_exam_roadmap.delay(None, subcategory.id)
            return Response({'message': f'AI Roadmap generation task queued for {subcategory.name}.'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AdminTopicViewSet(viewsets.ModelViewSet):
    queryset = Topic.objects.select_related('subcategory', 'subcategory__category').all().order_by('subcategory__name', 'order', 'name')
    serializer_class = TopicSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    lookup_field = 'id'
    pagination_class = None

    def get_queryset(self):
        qs = super().get_queryset()
        subcat_id = self.request.query_params.get('subcategory')
        if subcat_id:
            qs = qs.filter(subcategory_id=subcat_id)
        return qs


class AdminExamViewSet(viewsets.ModelViewSet):
    queryset = Exam.objects.select_related('subcategory', 'subcategory__category').all().order_by('-created_at')
    serializer_class = ExamSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    lookup_field = 'id'
    pagination_class = None

    def get_queryset(self):
        qs = super().get_queryset()
        subcat = self.request.query_params.get('subcategory')
        if subcat:
            qs = qs.filter(subcategory__slug=subcat)
        return qs

    @action(detail=True, methods=['post'])
    def import_json(self, request, id=None):
        exam = self.get_object()
        questions_data = request.data.get('questions', [])
        if not isinstance(questions_data, list):
            return Response({'error': 'Invalid format. Expected a list of questions.'}, status=status.HTTP_400_BAD_REQUEST)

        created_count = 0
        for q_data in questions_data:
            q_text = q_data.get('question_text') or q_data.get('question')
            if not q_text:
                continue
            question = Question.objects.create(
                exam=exam,
                question_text=q_text,
                explanation=q_data.get('explanation', ''),
                subject=q_data.get('subject', ''),
                topic=q_data.get('topic', ''),
                difficulty=q_data.get('difficulty', 'medium'),
                marks=q_data.get('marks', exam.marks_per_question or 1)
            )
            options = q_data.get('options', [])
            correct_idx = q_data.get('correct_option_index', 0)
            for idx, opt in enumerate(options):
                opt_text = opt if isinstance(opt, str) else opt.get('answer_text', '')
                is_correct = (idx == correct_idx) if isinstance(opt, str) else opt.get('is_correct', False)
                Answer.objects.create(
                    question=question,
                    answer_text=opt_text,
                    is_correct=is_correct,
                    order=idx
                )
            created_count += 1

        exam.total_questions = exam.questions.count()
        exam.save(update_fields=['total_questions'])
        return Response({'message': f'Successfully imported {created_count} questions.', 'total_questions': exam.total_questions})

    @action(detail=True, methods=['get'])
    def export_json(self, request, id=None):
        exam = self.get_object()
        questions = exam.questions.prefetch_related('answers').all()
        data = {
            'exam_title': exam.title,
            'slug': exam.slug,
            'duration_minutes': exam.duration_minutes,
            'questions': [
                {
                    'question_text': q.question_text,
                    'explanation': q.explanation,
                    'subject': q.subject,
                    'topic': q.topic,
                    'difficulty': q.difficulty,
                    'marks': q.marks,
                    'options': [
                        {
                            'answer_text': a.answer_text,
                            'is_correct': a.is_correct
                        }
                        for a in q.answers.all()
                    ]
                }
                for q in questions
            ]
        }
        return Response(data)


class AdminQuestionViewSet(viewsets.ModelViewSet):
    queryset = Question.objects.select_related('exam').prefetch_related(
        'answers', 'translations', 'answers__translations', 'community_comments'
    ).all().order_by('id')
    serializer_class = QuestionSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    lookup_field = 'id'
    pagination_class = None

    def get_queryset(self):
        qs = super().get_queryset()
        exam_id = self.request.query_params.get('exam_id')
        exam_slug = self.request.query_params.get('exam_slug') or self.request.query_params.get('slug')
        if exam_id:
            qs = qs.filter(exam_id=exam_id)
        elif exam_slug:
            qs = qs.filter(exam__slug=exam_slug)
        return qs

    def create(self, request, *args, **kwargs):
        from .models_translations import QuestionTranslation, AnswerTranslation
        data = request.data
        exam_id = data.get('exam')
        exam = get_object_or_404(Exam, id=exam_id)
        question = Question.objects.create(
            exam=exam,
            question_text=data.get('question_text', ''),
            explanation=data.get('explanation', ''),
            subject=data.get('subject', ''),
            topic=data.get('topic', ''),
            difficulty=data.get('difficulty', 'medium'),
            marks=data.get('marks', 1)
        )

        q_text_hi = data.get('question_text_hi', '')
        exp_hi = data.get('explanation_hi', '')
        if q_text_hi or exp_hi:
            QuestionTranslation.objects.update_or_create(
                question=question,
                language='hi',
                defaults={'question_text': q_text_hi, 'explanation': exp_hi}
            )

        options = data.get('options', [])
        for idx, opt in enumerate(options):
            ans = Answer.objects.create(
                question=question,
                answer_text=opt.get('answer_text', ''),
                is_correct=opt.get('is_correct', False),
                order=idx
            )
            if opt.get('answer_text_hi'):
                AnswerTranslation.objects.update_or_create(
                    answer=ans,
                    language='hi',
                    defaults={'answer_text': opt['answer_text_hi']}
                )

        serializer = self.get_serializer(question)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        from .models_translations import QuestionTranslation, AnswerTranslation
        question = self.get_object()
        data = request.data
        question.question_text = data.get('question_text', question.question_text)
        question.explanation = data.get('explanation', question.explanation)
        question.subject = data.get('subject', question.subject)
        question.topic = data.get('topic', question.topic)
        question.difficulty = data.get('difficulty', question.difficulty)
        question.marks = data.get('marks', question.marks)
        question.save()

        if 'question_text_hi' in data or 'explanation_hi' in data:
            q_text_hi = data.get('question_text_hi', '')
            exp_hi = data.get('explanation_hi', '')
            if q_text_hi or exp_hi:
                QuestionTranslation.objects.update_or_create(
                    question=question,
                    language='hi',
                    defaults={'question_text': q_text_hi, 'explanation': exp_hi}
                )
            else:
                QuestionTranslation.objects.filter(question=question, language='hi').delete()

        if 'options' in data:
            question.answers.all().delete()
            for idx, opt in enumerate(data['options']):
                ans = Answer.objects.create(
                    question=question,
                    answer_text=opt.get('answer_text', ''),
                    is_correct=opt.get('is_correct', False),
                    order=idx
                )
                if opt.get('answer_text_hi'):
                    AnswerTranslation.objects.update_or_create(
                        answer=ans,
                        language='hi',
                        defaults={'answer_text': opt['answer_text_hi']}
                    )

        serializer = self.get_serializer(question)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def generate_hindi(self, request, id=None):
        from .ai import translate_question_to_hindi
        question = self.get_object()
        success = translate_question_to_hindi(question)
        if success:
            serializer = self.get_serializer(question)
            return Response({'message': 'Hindi translation generated.', 'question': serializer.data})
        return Response({'error': 'Failed to generate Hindi translation.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'])
    def bulk_generate_hindi(self, request):
        from .ai import translate_question_to_hindi
        ids = request.data.get('ids', [])
        questions = Question.objects.filter(id__in=ids)
        success_count = 0
        for q in questions:
            if translate_question_to_hindi(q):
                success_count += 1
        return Response({'message': f'Generated Hindi translation for {success_count} of {len(ids)} questions.'})


class AdminCurrentAffairViewSet(viewsets.ModelViewSet):
    serializer_class = CurrentAffairSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    lookup_field = 'id'

    def get_queryset(self):
        from django.db.models import Q
        qs = CurrentAffair.objects.all().order_by('-published_date', '-created_at')
        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(title__icontains=search) |
                Q(summary__icontains=search) |
                Q(source_name__icontains=search)
            )
        return qs

    @action(detail=False, methods=['post'])
    def trigger_ai_gen(self, request):
        try:
            from tasks.analytics_tasks import fetch_current_affairs
            fetch_current_affairs.delay()
            return Response({'message': 'AI Current Affairs generation task queued.'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AdminUserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().order_by('-date_joined')
    permission_classes = [IsAuthenticated, IsAdminUser]
    lookup_field = 'id'
    pagination_class = None

    def list(self, request, *args, **kwargs):
        qs = self.filter_queryset(self.get_queryset())
        search = request.query_params.get('search')
        if search:
            qs = qs.filter(email__icontains=search) | qs.filter(username__icontains=search) | qs.filter(first_name__icontains=search)
        
        users_data = [
            {
                'id': u.id,
                'username': u.username,
                'email': u.email,
                'first_name': u.first_name,
                'last_name': u.last_name,
                'name': f"{u.first_name} {u.last_name}".strip() or u.username,
                'is_active': u.is_active,
                'is_staff': u.is_staff,
                'date_joined': u.date_joined,
                'attempts_count': u.exam_results.count()
            }
            for u in qs
        ]
        return Response(users_data)

    def retrieve(self, request, *args, **kwargs):
        u = self.get_object()
        return Response({
            'id': u.id,
            'username': u.username,
            'email': u.email,
            'first_name': u.first_name,
            'last_name': u.last_name,
            'name': f"{u.first_name} {u.last_name}".strip() or u.username,
            'is_active': u.is_active,
            'is_staff': u.is_staff,
            'date_joined': u.date_joined,
            'attempts_count': u.exam_results.count()
        })

    def update(self, request, *args, **kwargs):
        user = self.get_object()
        data = request.data
        if 'first_name' in data:
            user.first_name = data['first_name']
        if 'last_name' in data:
            user.last_name = data['last_name']
        if 'email' in data:
            user.email = data['email']
        if 'is_active' in data:
            user.is_active = data['is_active']
        user.save()
        return Response({
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'name': f"{user.first_name} {user.last_name}".strip() or user.username,
            'is_active': user.is_active,
            'is_staff': user.is_staff,
            'date_joined': user.date_joined,
            'attempts_count': user.exam_results.count()
        })

    @action(detail=True, methods=['post'])
    def toggle_staff(self, request, id=None):
        user = self.get_object()
        
        password = request.data.get('password')
        if not password:
            return Response({'error': 'Admin password is required to change staff privileges.'}, status=status.HTTP_400_BAD_REQUEST)
            
        if not request.user.check_password(password):
            return Response({'error': 'Incorrect admin password.'}, status=status.HTTP_403_FORBIDDEN)
            
        if not user.is_staff:
            staff_count = User.objects.filter(is_staff=True).count()
            if staff_count >= 2:
                return Response({'error': 'Maximum limit of 2 staff members reached.'}, status=status.HTTP_400_BAD_REQUEST)
                
        user.is_staff = not user.is_staff
        user.save(update_fields=['is_staff'])
        return Response({'id': user.id, 'is_staff': user.is_staff})

    @action(detail=True, methods=['post'])
    def toggle_active(self, request, id=None):
        user = self.get_object()
        user.is_active = not user.is_active
        user.save(update_fields=['is_active'])
        return Response({'id': user.id, 'is_active': user.is_active})

    @action(detail=True, methods=['get'])
    def progress(self, request, id=None):
        user = self.get_object()
        
        # 1. Exam Results
        exam_results = user.exam_results.all().order_by('-completed_at')
        exam_data = [
            {
                'id': e.id,
                'exam_title': e.exam.title,
                'score': e.score,
                'total_questions': e.total_questions,
                'correct_answers': e.correct_answers,
                'percentage': e.percentage,
                'completed_at': e.completed_at,
                'is_completed': e.is_completed
            }
            for e in exam_results
        ]
        
        # 2. Topic Progress
        topic_progress = user.roadmap_progress.select_related('topic').all()
        topic_data = [
            {
                'id': t.id,
                'topic_title': t.topic.title,
                'status': t.status,
                'completed_at': t.completed_at,
                'updated_at': t.updated_at
            }
            for t in topic_progress
        ]
        
        # 3. Resource Progress
        resource_progress = user.resource_progress.select_related('resource').all()
        resource_data = [
            {
                'id': r.id,
                'resource_title': r.resource.title,
                'is_completed': r.is_completed,
                'last_viewed_at': r.last_viewed_at
            }
            for r in resource_progress
        ]
        
        # 4. Answer Stats (aggregate over user answers linked via session_id)
        session_ids = exam_results.values_list('session_id', flat=True)
        from .models import UserAnswer
        all_answers = UserAnswer.objects.filter(session_id__in=session_ids).select_related('question')
        
        total_answers = all_answers.count()
        correct_answers = all_answers.filter(is_correct=True).count()
        flagged_answers = all_answers.filter(is_flagged_for_review=True).count()
        
        recent_answers_qs = all_answers.order_by('-answered_at')[:50]
        recent_answers = [
            {
                'id': a.id,
                'question_text': a.question.question_text[:100],
                'is_correct': a.is_correct,
                'answered_at': a.answered_at,
                'is_flagged': a.is_flagged_for_review
            }
            for a in recent_answers_qs
        ]
        
        return Response({
            'exam_results': exam_data,
            'topic_progress': topic_data,
            'resource_progress': resource_data,
            'answer_stats': {
                'total_answers': total_answers,
                'correct_answers': correct_answers,
                'incorrect_answers': total_answers - correct_answers,
                'flagged_answers': flagged_answers
            },
            'recent_answers': recent_answers
        })


class AdminPdfUploadViewSet(viewsets.ModelViewSet):
    queryset = QuestionPaperUpload.objects.all().order_by('-created_at')
    serializer_class = QuestionPaperUploadSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    lookup_field = 'id'
    pagination_class = None


class AdminMessageViewSet(viewsets.ModelViewSet):
    queryset = ContactMessage.objects.all().order_by('-created_at')
    serializer_class = ContactMessageSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    lookup_field = 'id'
    pagination_class = None

    @action(detail=True, methods=['post'])
    def toggle_resolve(self, request, id=None):
        msg = self.get_object()
        msg.is_resolved = not msg.is_resolved
        msg.save(update_fields=['is_resolved'])
        return Response({'id': msg.id, 'is_resolved': msg.is_resolved})


class AdminSuggestionViewSet(viewsets.ModelViewSet):
    queryset = CorrectionSuggestion.objects.select_related('question', 'user').all().order_by('-created_at')
    serializer_class = CorrectionSuggestionSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    lookup_field = 'id'
    pagination_class = None

    @action(detail=True, methods=['post'])
    def update_status(self, request, id=None):
        suggestion = self.get_object()
        new_status = request.data.get('status')
        if new_status in ['pending', 'reviewed', 'accepted', 'rejected', 'approved']:
            suggestion.status = new_status
            suggestion.save(update_fields=['status'])
            return Response({'id': suggestion.id, 'status': suggestion.status})
        return Response({'error': 'Invalid status'}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def bulk_update_status(self, request):
        ids = request.data.get('ids', [])
        new_status = request.data.get('status')
        if new_status in ['pending', 'reviewed', 'accepted', 'rejected', 'approved']:
            count = CorrectionSuggestion.objects.filter(id__in=ids).update(status=new_status)
            return Response({'message': f'Updated {count} suggestions to {new_status}.'})
        return Response({'error': 'Invalid status'}, status=status.HTTP_400_BAD_REQUEST)


class AdminTopicResourceViewSet(viewsets.ModelViewSet):
    queryset = TopicResource.objects.all().order_by('-created_at')
    serializer_class = TopicResourceSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    lookup_field = 'id'

    @action(detail=True, methods=['post'])
    def toggle_publish(self, request, id=None):
        res = self.get_object()
        res.is_published = not res.is_published
        res.save(update_fields=['is_published'])
        return Response({'id': res.id, 'is_published': res.is_published})

    @action(detail=True, methods=['post'])
    def toggle_feature(self, request, id=None):
        res = self.get_object()
        res.is_featured = not res.is_featured
        res.save(update_fields=['is_featured'])
        return Response({'id': res.id, 'is_featured': res.is_featured})

    @action(detail=True, methods=['post'])
    def ai_summary(self, request, id=None):
        import os
        import google.generativeai as genai

        resource = self.get_object()
        api_key = os.environ.get('GEMINI_API_KEY')
        if not api_key:
            return Response({'error': 'GEMINI_API_KEY not set.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        content = resource.markdown_content or resource.html_content or resource.latex_content or resource.short_description
        if not content:
            return Response({'error': 'Resource has no text content.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel('gemini-1.5-flash')
            prompt = f"Summarize this study resource in 2 concise sentences for exam prep:\nTitle: {resource.title}\nContent:\n{content[:3000]}"
            resp = model.generate_content(prompt)
            resource.ai_summary = resp.text.strip()
            resource.is_ai_generated = True
            resource.save(update_fields=['ai_summary', 'is_ai_generated'])
            return Response({'id': resource.id, 'ai_summary': resource.ai_summary})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'])
    def bulk_publish(self, request):
        ids = request.data.get('ids', [])
        count = TopicResource.objects.filter(id__in=ids).update(is_published=True)
        return Response({'message': f'Published {count} resources.'})

    @action(detail=False, methods=['post'])
    def bulk_unpublish(self, request):
        ids = request.data.get('ids', [])
        count = TopicResource.objects.filter(id__in=ids).update(is_published=False)
        return Response({'message': f'Unpublished {count} resources.'})

    @action(detail=False, methods=['post'])
    def bulk_feature(self, request):
        ids = request.data.get('ids', [])
        count = TopicResource.objects.filter(id__in=ids).update(is_featured=True)
        return Response({'message': f'Marked {count} resources as featured.'})

    @action(detail=False, methods=['post'])
    def bulk_ai_summary(self, request):
        import os
        import google.generativeai as genai

        ids = request.data.get('ids', [])
        api_key = os.environ.get('GEMINI_API_KEY')
        if not api_key:
            return Response({'error': 'GEMINI_API_KEY not set.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        resources = TopicResource.objects.filter(id__in=ids)
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-1.5-flash')

        success_count = 0
        for resource in resources:
            content = resource.markdown_content or resource.html_content or resource.latex_content or resource.short_description
            if not content:
                continue
            try:
                prompt = f"Summarize this study resource in 2 concise sentences for exam prep:\nTitle: {resource.title}\nContent:\n{content[:3000]}"
                resp = model.generate_content(prompt)
                resource.ai_summary = resp.text.strip()
                resource.is_ai_generated = True
                resource.save(update_fields=['ai_summary', 'is_ai_generated'])
                success_count += 1
            except Exception:
                pass

        return Response({'message': f'Generated AI summary for {success_count} resources.'})

class AdminResourceTagViewSet(viewsets.ModelViewSet):
    queryset = ResourceTag.objects.all().order_by('name')
    serializer_class = ResourceTagSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    lookup_field = 'id'
    pagination_class = None

class AdminExamRoadmapViewSet(viewsets.ModelViewSet):
    queryset = ExamRoadmap.objects.all().order_by('-created_at')
    serializer_class = ExamRoadmapSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    lookup_field = 'id'
    pagination_class = None

class AdminRoadmapPhaseViewSet(viewsets.ModelViewSet):
    queryset = RoadmapPhase.objects.all().order_by('order')
    serializer_class = RoadmapPhaseSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    lookup_field = 'id'
    pagination_class = None

    def get_queryset(self):
        qs = super().get_queryset()
        roadmap_id = self.request.query_params.get('roadmap_id')
        if roadmap_id:
            qs = qs.filter(roadmap_id=roadmap_id)
        return qs

class AdminRoadmapTopicViewSet(viewsets.ModelViewSet):
    queryset = RoadmapTopic.objects.all().order_by('order')
    serializer_class = RoadmapTopicSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    lookup_field = 'id'
    pagination_class = None

    def get_queryset(self):
        qs = super().get_queryset()
        phase_id = self.request.query_params.get('phase_id')
        if phase_id:
            qs = qs.filter(phase_id=phase_id)
        return qs
    pagination_class = None

    @action(detail=True, methods=['post'])
    def toggle_publish(self, request, id=None):
        res = self.get_object()
        res.is_published = not res.is_published
        res.save(update_fields=['is_published'])
        return Response({'id': res.id, 'is_published': res.is_published})

    @action(detail=True, methods=['post'])
    def toggle_feature(self, request, id=None):
        res = self.get_object()
        res.is_featured = not res.is_featured
        res.save(update_fields=['is_featured'])
        return Response({'id': res.id, 'is_featured': res.is_featured})

    @action(detail=True, methods=['post'])
    def ai_summary(self, request, id=None):
        import os
        import google.generativeai as genai

        resource = self.get_object()
        api_key = os.environ.get('GEMINI_API_KEY')
        if not api_key:
            return Response({'error': 'GEMINI_API_KEY not set.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        content = resource.markdown_content or resource.html_content or resource.latex_content or resource.short_description
        if not content:
            return Response({'error': 'Resource has no text content.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel('gemini-1.5-flash')
            prompt = f"Summarize this study resource in 2 concise sentences for exam prep:\nTitle: {resource.title}\nContent:\n{content[:3000]}"
            resp = model.generate_content(prompt)
            resource.ai_summary = resp.text.strip()
            resource.is_ai_generated = True
            resource.save(update_fields=['ai_summary', 'is_ai_generated'])
            return Response({'id': resource.id, 'ai_summary': resource.ai_summary})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
