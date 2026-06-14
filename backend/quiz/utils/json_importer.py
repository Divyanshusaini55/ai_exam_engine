import json
from django.db import transaction
from quiz.models import Exam, Question, Answer, Category, SubCategory

class ExamJSONImporter:
    """
    Utility to import an exam from a structured JSON file.
    Supports the comprehensive LLM-ready JSON schema.
    """
    
    @classmethod
    def import_from_json(cls, json_data, user=None):
        """
        Parses JSON data and creates Exam, Question, and Answer records.
        """
        try:
            with transaction.atomic():
                # Extract Exam Level Data
                title = json_data.get('title', 'Imported Exam')
                category_slug = json_data.get('category_slug')
                sub_category_slug = json_data.get('sub_category_slug')
                duration = json_data.get('duration_minutes', 60)
                negative_marks = json_data.get('negative_marks', 0)
                positive_marks = json_data.get('positive_marks', 1)
                
                # Try to resolve category and subcategory
                category = None
                sub_category = None
                if category_slug:
                    category = Category.objects.filter(slug=category_slug).first()
                if sub_category_slug and category:
                    sub_category = SubCategory.objects.filter(slug=sub_category_slug, category=category).first()

                # Create the Exam
                exam = Exam.objects.create(
                    title=title,
                    subcategory=sub_category,
                    duration_minutes=duration,
                    total_marks=0,  # Will calculate later
                    is_active=False # Keep inactive until reviewed
                )

                questions_data = json_data.get('questions', [])
                total_points = 0
                
                # Track bulk creations for performance
                questions_to_create = []
                
                for idx, q_data in enumerate(questions_data):
                    question_dict = q_data.get('question', {})
                    q_text = question_dict.get('text', '')
                    
                    classification = q_data.get('classification', {})
                    subject = classification.get('subject', '')
                    topic = classification.get('topic', '')
                    difficulty = classification.get('difficulty', 'Medium')
                    
                    explanation = q_data.get('explanation', '')
                    
                    # Store extra structured metadata for LLM fine-tuning
                    metadata = {}
                    if 'exam_history' in q_data:
                        metadata['exam_history'] = q_data['exam_history']
                    if 'source' in q_data:
                        metadata['source'] = q_data['source']
                    if 'subtopic' in classification:
                        metadata['subtopic'] = classification['subtopic']
                    if 'metadata' in q_data:
                        metadata.update(q_data['metadata'])

                    question = Question.objects.create(
                        exam=exam,
                        question_text=q_text,
                        question_type='multiple_choice',
                        order=idx,
                        points=positive_marks,
                        subject=subject,
                        topic=topic,
                        difficulty=difficulty,
                        explanation=explanation,
                        metadata=metadata
                    )
                    
                    total_points += positive_marks
                    
                    # Create Answers
                    options_data = q_data.get('options', [])
                    answer_data = q_data.get('answer', {})
                    correct_option_id = answer_data.get('correct_option', '')
                    
                    for opt_idx, opt in enumerate(options_data):
                        opt_id = opt.get('id', '')
                        opt_text = opt.get('text', '')
                        is_correct = (opt_id == correct_option_id)
                        
                        Answer.objects.create(
                            question=question,
                            answer_text=f"{opt_id}) {opt_text}" if opt_id else opt_text,
                            is_correct=is_correct,
                            order=opt_idx
                        )

                # Update exam total marks
                exam.total_marks = total_points
                exam.save()
                
                return True, f"Successfully imported exam '{exam.title}' with {len(questions_data)} questions."
                
        except Exception as e:
            return False, f"Failed to import JSON: {str(e)}"
