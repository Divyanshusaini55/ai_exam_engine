from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.shortcuts import get_object_or_404
from django.db.models import Count, Sum
from django.db import models # ✅ Added missing import
from django.contrib.auth.models import User

from .ai import generate_explanation_for_question, parse_exam_paper_with_ai

from .models import Exam, Question, Answer, UserAnswer, UserExamResult, Category, SubCategory
from .serializers import (
    ExamSerializer,
    QuestionSerializer,
    UserAnswerSerializer,
    ExamResultSerializer,
    CategorySerializer,
    SubCategorySerializer,
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

    # -------------------------------------------------
    # PARSE EXAM PDF (AI)
    # -------------------------------------------------
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
            print(f"❌ Parse Error: {e}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    # -------------------------------------------------
    # GET QUESTIONS (NO CORRECT ANSWERS)
    # -------------------------------------------------
    @action(detail=True, methods=['get'])
    def questions(self, request, pk=None):
        exam = self.get_object()
        questions = exam.questions.all().prefetch_related('answers')

        serializer = QuestionSerializer(
            questions,
            many=True,
            context={
                'request': request,
                'hide_correct': True
            }
        )
        return Response(serializer.data)

    # -------------------------------------------------
    # SUBMIT ANSWER
    # -------------------------------------------------
    @action(detail=True, methods=['post'])
    def submit_answer(self, request, pk=None):
        exam = self.get_object()

        session_id = request.data.get('session_id')
        question_id = request.data.get('question_id')
        answer_id = request.data.get('answer_id')
        text_answer = request.data.get('text_answer', '')

        if not session_id:
            return Response(
                {'error': 'session_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        question = get_object_or_404(Question, id=question_id, exam=exam)

        selected_answer = None
        is_correct = False

        if answer_id:
            selected_answer = get_object_or_404(
                Answer,
                id=answer_id,
                question=question
            )
            is_correct = selected_answer.is_correct

        user_answer, _ = UserAnswer.objects.update_or_create(
            session_id=session_id,
            question=question,
            defaults={
                'exam': exam,
                'selected_answer': selected_answer,
                'text_answer': text_answer,
                'is_correct': is_correct
            }
        )

        serializer = UserAnswerSerializer(user_answer)
        return Response(serializer.data)

    # -------------------------------------------------
    # SUBMIT EXAM (FINISH)
    # -------------------------------------------------
    @action(detail=True, methods=['post'])
    def submit_exam(self, request, pk=None):
        """
        Calculates the final score and creates a UserExamResult.
        """
        exam = self.get_object()
        session_id = request.data.get('session_id')

        if not request.user.is_authenticated:
             return Response(
                {'error': 'Authentication required to submit exam.'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        if not session_id:
            return Response(
                {'error': 'Session ID required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Quick: Calculate answers from DB
        user_answers = UserAnswer.objects.filter(exam=exam, session_id=session_id)
        total_questions = exam.questions.count()
        correct_answers = user_answers.filter(is_correct=True).count()
        
        # Calculate Score
        score = user_answers.filter(is_correct=True).aggregate(
            total=models.Sum('question__points')
        )['total'] or 0

        # Create Result
        # We use update_or_create to prevent duplicates if user hits submit twice
        result, created = UserExamResult.objects.update_or_create(
            user=request.user,
            exam=exam,
            defaults={
                'score': score,
                'total_questions': total_questions,
                'correct_answers': correct_answers,
                'percentage': round((correct_answers / total_questions * 100) if total_questions > 0 else 0, 2),
                'session_id': session_id
            }
        )

        return Response({
            'message': 'Exam submitted successfully!',
            'result_id': result.id,
            'score': score,
            'percentage': result.percentage
        })

    # -------------------------------------------------
    # RESULTS (SAVES DATA NOW)
    # -------------------------------------------------
    @action(detail=True, methods=['get'])
    def results(self, request, pk=None):
        """
        Get exam results for the authenticated user.
        🛡️ SECURITY: Results are scoped to user + exam to prevent data leakage.
        """
        exam = self.get_object()
        
        # 🔒 REQUIRE AUTHENTICATION
        if not request.user.is_authenticated:
            return Response(
                {'error': 'Authentication required to view results'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # 🔍 CHECK IF USER HAS COMPLETED THIS EXAM
        try:
            user_result = UserExamResult.objects.get(
                user=request.user,
                exam=exam
            )
        except UserExamResult.DoesNotExist:
            return Response(
                {'error': 'No results found for this exam. Please complete the exam first.'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # ✅ FETCH USER'S ANSWERS using the session_id from their result
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
        
        percentage = round(
            (correct_answers / total_questions * 100)
            if total_questions > 0 else 0,
            2
        )

        # ✅ SUMMARY DATA (using saved result)
        summary_data = {
            'exam_id': exam.id,
            'exam_title': exam.title,
            'session_id': user_result.session_id,
            'total_questions': user_result.total_questions,
            'answered_questions': user_answers.count(),
            'correct_answers': user_result.correct_answers,
            'total_points': user_result.score,
            'max_points': max_points,
            'percentage': user_result.percentage,
            'completed_at': user_result.completed_at,
        }

        summary_serializer = ExamResultSerializer(summary_data)

        # ✅ ANSWERS SERIALIZED SEPARATELY
        answers_data = UserAnswerSerializer(
            user_answers,
            many=True
        ).data

        # 🔥 FULL QUESTIONS WITH CORRECT ANSWERS (FOR REVIEW)
        all_questions = exam.questions.all().prefetch_related('answers')
        questions_data = QuestionSerializer(
            all_questions,
            many=True,
            context={'hide_correct': False} # Explicitly Show Correct Answers
        ).data

        return Response({
            **summary_serializer.data,
            "answers": answers_data,
            "questions": questions_data # ✅ New Field
        })

    # -------------------------------------------------
    # DASHBOARD STATS
    # -------------------------------------------------
    @action(detail=False, methods=['get'])
    def dashboard_stats(self, request):
        print(f"📊 DASHBOARD DEBUG: User={request.user}, Auth={request.auth}")
        if not request.user.is_authenticated:
            return Response(
                {'error': 'Authentication required'}, 
                status=status.HTTP_401_UNAUTHORIZED
            )

        results = UserExamResult.objects.filter(user=request.user)
        
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

    # -------------------------------------------------
    # LEADERBOARD (Global & Per-Exam)
    # -------------------------------------------------
    @action(detail=False, methods=['get'])
    def leaderboard(self, request):
        exam_id = request.query_params.get('exam_id')
        leaderboard_data = []

        if exam_id:
            # 🏆 Per-Exam Leaderboard (Highest Score per User)
            # We want each user to appear only once with their BEST score for this exam.
            
            # Subquery to find the best score for each user for this exam
            all_results = UserExamResult.objects.filter(exam_id=exam_id)
            
            # Group by user and find max score (using annotation tricks or python sorting)
            # For simplicity and cross-db compatibility:
            # We fetch all, then distinct by user keeping highest score.
            
            # Using Django's distinct on fields is only for Postgres, so we do it in Python for SQLite safety
            results = UserExamResult.objects.filter(exam_id=exam_id).select_related('user', 'exam').order_by('user', '-score')
            
            user_best_map = {}
            for r in results:
                if r.user_id not in user_best_map:
                    user_best_map[r.user_id] = r
            
            sorted_results = sorted(user_best_map.values(), key=lambda x: x.score, reverse=True)
            
            rank = 1
            for r in sorted_results:
                leaderboard_data.append({
                    "rank": rank,
                    "username": r.user.username,
                    "score": r.score,
                    "total_questions": r.total_questions,
                    "percentage": r.percentage,
                    "date": r.completed_at,
                    "exam_title": r.exam.title
                })
                rank += 1
                
        else:
            # 🌍 Global Leaderboard (Reputation / Total Score sum)
            # Sum of all scores for each user
            users = User.objects.annotate(
                total_score=Sum('exam_results__score'),
                exams_taken=Count('exam_results')
            ).filter(total_score__isnull=False).order_by('-total_score')

            rank = 1
            for u in users:
                leaderboard_data.append({
                    "rank": rank,
                    "username": u.username,
                    "score": u.total_score,
                    "exams_taken": u.exams_taken,
                    "date": "-", # Global doesn't have a single date
                    "exam_title": "All Exams"
                })
                rank += 1

        return Response(leaderboard_data)


# ==================================================
# CONTACT SUPPORT API ENDPOINTS
# ==================================================

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
