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
        questions = Question.objects.filter(question_type='multiple_choice')
        
        if limit > 0:
            questions = questions[:limit]
            
        count = 0
        
        with open(output_file, 'w', encoding='utf-8') as f:
            for q in questions:
                payload = q.schema_payload or {}
                q_text = payload.get('question_text', '')
                explanation = payload.get('explanation', '')
                subject = payload.get('subject', q.topic or 'general studies')
                options = payload.get('options', [])

                if not q_text or not explanation:
                    continue

                system_prompt = f"You are an expert tutor in {subject}."
                user_content = f"Question: {q_text}\nOptions:\n"
                correct_answer_str = ""
                
                for ans in options:
                    if isinstance(ans, dict):
                        ans_text = ans.get('answer_text', '')
                        user_content += f"- {ans_text}\n"
                        if ans.get('is_correct'):
                            correct_answer_str = ans_text
                    else:
                        user_content += f"- {str(ans)}\n"
                        
                if not correct_answer_str:
                    continue
                    
                assistant_content = f"The correct answer is: {correct_answer_str}\n\nExplanation: {explanation}"
                
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
