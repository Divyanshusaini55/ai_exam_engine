from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404

from .models import Question
from .ai import generate_explanation_for_question
from .api_throttles import AIHeavyThrottle, AILightThrottle # We will extract throttles to api_throttles.py

class SummaryMixin:
    @action(detail=True, methods=['get', 'post'], permission_classes=[IsAuthenticated], throttle_classes=[AIHeavyThrottle])
    def summary(self, request, pk=None):
        exam = self.get_object()
        force = request.data.get('force', False) or request.query_params.get('force', 'false').lower() == 'true'
        if exam.ai_summary and not force:
            return Response({'ai_summary': exam.ai_summary})
            
        from jobs.models import BackgroundJob
        from jobs.services import create_job
        from tasks.summary_tasks import generate_exam_summary
        
        # Check if there is already an active job for this exam
        active_job = BackgroundJob.objects.filter(
            type='ai.summary',
            payload__exam_id=exam.id,
            status__in=['QUEUED', 'RUNNING']
        ).first()

        if active_job:
            return Response({
                'job_id': str(active_job.id),
                'status': active_job.status.lower(), 
                'message': 'AI summary is currently being generated. This takes about a minute. Please check back shortly.'
            }, status=202)

        job = create_job(
            type='ai.summary', 
            payload={'exam_id': exam.id, 'force': force}, 
            user=request.user if request.user.is_authenticated else None
        )
        generate_exam_summary.delay(str(job.id), exam.id)
            
        return Response({
            'job_id': str(job.id),
            'status': 'queued', 
            'message': 'AI summary is currently being generated. This takes about a minute. Please check back shortly.'
        }, status=202)

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated], throttle_classes=[AILightThrottle])
    def explain_question(self, request):
        question_id = request.data.get('question_id')
        
        if not question_id:
            return Response({'error': 'Question ID required'}, status=400)
            
        question = get_object_or_404(Question, id=question_id)
    
        if question.explanation and question.explanation != "Explanation could not be generated at this time.":
            return Response({'explanation': question.explanation})
            
        explanation = generate_explanation_for_question(question)
        
        if explanation != "Explanation could not be generated at this time.":
            question.explanation = explanation
            question.save()
            
        return Response({'explanation': explanation})
