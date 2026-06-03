from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status

from .ai import parse_exam_paper_with_ai
from .api_throttles import AIHeavyThrottle

class UploadMixin:
    """
    Mixin for ExamViewSet.
    Handles AI PDF parsing and paper uploads.
    """

    @action(detail=True, methods=['post'], throttle_classes=[AIHeavyThrottle])
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
