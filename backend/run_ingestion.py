import os
import sys
import django

sys.path.append("/Users/divyanshu/Desktop/ai_exam_engine/backend")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from quiz.models import Exam, Question
from quiz.ai import parse_exam_paper_with_ai
from django.core.files import File

def ingest():
    pdf_path = "/Users/divyanshu/Desktop/ai_exam_engine/backend/media/pdfs/RRB_NTPC_G_Answer_Key_Compilation_English-5-6-2025-Shift-I.pdf"
    
    if not os.path.exists(pdf_path):
        print(f"Warning: PDF path '{pdf_path}' does not exist.")
        return

    print("Creating new Exam record...")
    exam = Exam.objects.create(
        title="RRB NTPC CBT Question Paper 5-6-2025 Shift 1",
        description="Full extraction using the Multimodal 10/10 Pipeline.",
        duration_minutes=60,
        status="published"
    )
    
    print(f"Attaching PDF to Exam ID {exam.id}...")
    with open(pdf_path, 'rb') as f:
        exam.pdf_file.save('RRB_NTPC_CBT_Answer_Key_Compilation_English-5-6-2025-Shift-1.pdf', File(f))
    exam.save()
    
    print("Running new pipeline (parse_exam_paper_with_ai)...")
    count = parse_exam_paper_with_ai(exam)
    
    # Check what was saved
    saved_count = exam.exam_questions.count()
    print(f"\n✅ SUCCESS! Ingested {saved_count} questions into the database attached to Exam ID {exam.id}.")

if __name__ == "__main__":
    ingest()
