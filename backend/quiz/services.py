import traceback
from .models import Exam
from .ai import generate_questions_from_pdf

def extract_questions_async(exam_id):
    """
    Retrieves the exam by ID and triggers AI question generation.
    Designed to be run in a background thread.
    """
    print(f"🧵 Starting Gemini extraction background thread for Exam ID: {exam_id}")
    
    try:
        # Re-fetch exam to ensure we have fresh data and it exists
        exam = Exam.objects.get(id=exam_id)
        
        if not exam.pdf_file:
            print(f"⚠️ Exam ID {exam_id} has no PDF file. Skipping AI generation.")
            return

        print(f"🚀 Triggering AI generation for '{exam.title}'...")
        success = generate_questions_from_pdf(exam)
        
        if success:
            print(f"✅ Background AI generation COMPLETED for Exam ID: {exam_id}")
        else:
            print(f"⚠️ Background AI generation finished but returned False for Exam ID: {exam_id}")

    except Exam.DoesNotExist:
        print(f"❌ Error: Exam ID {exam_id} not found in background thread.")
    except Exception as e:
        print(f"❌ CRITICAL ERROR in background AI thread for Exam ID {exam_id}: {str(e)}")
        traceback.print_exc()
