from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny

from .models import UserAnswer, PracticeSession, ExamAttempt

class SessionMixin:
    """
    Mixin for ExamViewSet.
    Handles session state management: progress, update_session, pause, reset.
    """

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
