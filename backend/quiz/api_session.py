from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny

from .models import UserAnswer, PracticeSession, ExamAttempt

class SessionMixin:
    @action(detail=True, methods=['get'])
    def progress(self, request, slug=None, pk=None, **kwargs):
        exam = self.get_object()
        session_id = request.query_params.get('session_id')
        if not session_id:
            return Response({'error': 'session_id is required'}, status=400)
        
        user_answers = UserAnswer.objects.filter(exam=exam, session_id=session_id).select_related('question')
        
        answers_dict = {}
        for ua in user_answers:
            q_payload = ua.question.schema_payload or {}
            q_type = q_payload.get('question_type') or ua.question.question_type or 'mcq_single'
            if q_type == 'mcq_multi':
                answers_dict[str(ua.question_id)] = ua.selected_options or []
            elif q_type in ['nat', 'subjective']:
                answers_dict[str(ua.question_id)] = (ua.answer_payload or {}).get('text_answer', '')
            else:
                if ua.selected_options and len(ua.selected_options) > 0:
                    answers_dict[str(ua.question_id)] = ua.selected_options[0]
        
        review_list = [str(ua.question_id) for ua in user_answers if ua.is_flagged_for_review]
        bookmarked_list = [str(ua.question_id) for ua in user_answers if ua.is_bookmarked]
        visited_list = [str(q_id) for q_id in user_answers.values_list('question_id', flat=True)]
        
        return Response({
            'answers': answers_dict,
            'review': review_list,
            'bookmarked': bookmarked_list,
            'visited': visited_list
        })

    @action(detail=True, methods=['post'], permission_classes=[AllowAny])
    def update_session(self, request, slug=None, pk=None, **kwargs):
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
        
        # Persist visited question tracking
        if question_id:
            try:
                from .models import Question
                question = Question.objects.filter(id=question_id, exams=exam).first()
                if question:
                    UserAnswer.objects.get_or_create(
                        session_id=session_id,
                        question=question,
                        defaults={
                            'exam': exam,
                            'selected_options': [],
                            'answer_payload': {}
                        }
                    )
            except Exception:
                pass
            
        return Response({'success': True})

    @action(detail=True, methods=['post'], permission_classes=[AllowAny])
    def pause(self, request, slug=None, pk=None, **kwargs):
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
    def reset(self, request, slug=None, pk=None, **kwargs):
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
