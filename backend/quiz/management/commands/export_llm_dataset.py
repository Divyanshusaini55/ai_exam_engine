import json
import os
from django.core.management.base import BaseCommand
from quiz.models import Exam, Question

class Command(BaseCommand):
    help = 'Exports verified questions and explanations to an OpenAI JSONL format for LLM fine-tuning'

    def add_arguments(self, parser):
        parser.add_argument('output_file', type=str, help='Path to output the .jsonl file')
        parser.add_argument('--limit', type=int, default=0, help='Maximum number of questions to export (0 = unlimited)')

    def handle(self, *args, **kwargs):
        output_file = kwargs['output_file']
        limit = kwargs['limit']
        
        # Get questions that have explanations (crucial for fine-tuning)
        questions = Question.objects.exclude(explanation__isnull=True).exclude(explanation__exact='')
        
        # Only take multiple choice for now
        questions = questions.filter(question_type='multiple_choice').prefetch_related('answers', 'exam')
        
        if limit > 0:
            questions = questions[:limit]
            
        count = 0
        
        with open(output_file, 'w', encoding='utf-8') as f:
            for q in questions:
                # Need to build the Prompt
                system_prompt = f"You are an expert tutor in {q.subject or 'general studies'}."
                
                user_content = f"Question: {q.question_text}\nOptions:\n"
                
                correct_answer_str = ""
                
                # Format answers
                for ans in q.answers.all():
                    # We assume ans.answer_text includes the option like "A) text" or just "text"
                    user_content += f"- {ans.answer_text}\n"
                    if ans.is_correct:
                        correct_answer_str = ans.answer_text
                        
                # Only export if we have a correct answer
                if not correct_answer_str:
                    continue
                    
                assistant_content = f"The correct answer is: {correct_answer_str}\n\nExplanation: {q.explanation}"
                
                # Format as OpenAI Chat JSONL
                jsonl_line = {
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_content.strip()},
                        {"role": "assistant", "content": assistant_content}
                    ]
                }
                
                f.write(json.dumps(jsonl_line) + "\n")
                count += 1
                
        self.stdout.write(self.style.SUCCESS(f'Successfully exported {count} questions to {output_file}'))
