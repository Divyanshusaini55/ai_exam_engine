import os
from django.core.management.base import BaseCommand
from quiz.models import Exam, Question
import google.generativeai as genai
from quiz.ai import configure_gemini
from django.conf import settings

class Command(BaseCommand):
    help = 'Generates an AI summary for a given exam based on its questions using Grok AI'

    def add_arguments(self, parser):
        parser.add_argument('exam_id', type=int, help='The ID of the Exam to generate a summary for')
        parser.add_argument('--force', action='store_true', help='Overwrite existing summary')

    def handle(self, *args, **options):
        exam_id = options['exam_id']
        force = options['force']
        
        try:
            exam = Exam.objects.get(id=exam_id)
        except Exam.DoesNotExist:
            self.stdout.write(self.style.ERROR(f'Exam with ID "{exam_id}" does not exist.'))
            return

        if exam.ai_summary and not force:
            self.stdout.write(self.style.WARNING(f'Summary already exists for exam "{exam.title}". Use --force to regenerate.'))
            return

        questions = Question.objects.filter(exam=exam).values('question_text', 'subject', 'topic', 'difficulty')
        
        if not questions.exists():
            self.stdout.write(self.style.ERROR(f'No questions found for exam "{exam.title}". Cannot generate summary.'))
            return

        self.stdout.write(self.style.SUCCESS(f'Generating Summary for "{exam.title}" using Grok ({questions.count()} questions)...'))

        configure_gemini()
        # Using 'models/' prefix as seen in list_models() output
        MODEL_NAME = "models/gemini-flash-lite-latest"
        print(" USING MODEL:", MODEL_NAME)
    
        model = genai.GenerativeModel(MODEL_NAME)   
        
        # Prepare a lightweight representation of the exam content
        question_list_text = ""
        for idx, q in enumerate(questions[:50]): # Limit to first 50 questions to avoid massive prompt sizes
            question_list_text += f"{idx+1}. Subject: {q.get('subject')}, Topic: {q.get('topic')}, Diff: {q.get('difficulty')}\n"
            question_list_text += f"   Q: {q.get('question_text')[:200]}...\n"

        prompt = f"""
        You are an expert academic evaluator.
        Please review the following question paper content for the exam titled "{exam.title}" and generate a structured, professional markdown summary.
        
        The summary should include:
        1. An introductory paragraph about the general difficulty and scope of the exam.
        2. A breakdown of the primary subjects/topics covered (use bullet points or sub-headings).
        3. Key focus areas or specific patterns observed in the questions (e.g. "Heavy emphasis on Data Structures and Trees").
        
        Format the response in clean Markdown. Do NOT include markdown code block wrappers (like ```markdown), just return the raw markdown string.
        
        Here is a sample of the questions from the exam:
        {question_list_text}
        """

        try:
            response = model.generate_content(prompt)
            
            output = response.text.strip()
            # Clean up accidental markdown code block wrappers
            if output.startswith("```markdown"):
                output = output[11:]
            if output.startswith("```"):
                output = output[3:]
            if output.endswith("```"):
                output = output[:-3]
            
            output = output.strip()

            exam.ai_summary = output
            exam.save()

            self.stdout.write(self.style.SUCCESS(f'Successfully generated and saved summary for "{exam.title}".'))

        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Failed to generate summary: {str(e)}'))
