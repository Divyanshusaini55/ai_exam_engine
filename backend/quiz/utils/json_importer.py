import json
import uuid
from django.db import transaction
from quiz.models import Exam, Question, ExamQuestion, Category, SubCategory

class ExamJSONImporter:
    """
    Utility to import an exam from a structured JSON file.
    Supports the comprehensive LLM-ready JSON schema.
    """
    
    @classmethod
    def import_from_json(cls, json_data, user=None):
        """
        Parses JSON data and creates Exam, Question, and ExamQuestion records.
        Supports both raw schemav2.json lists and wrapped exam JSON envelopes.
        """
        try:
            with transaction.atomic():
                if isinstance(json_data, list):
                    questions_data = json_data
                    first_q = questions_data[0] if questions_data else {}
                    first_exam_hist = (first_q.get('exam_history') or [{}])[0] if first_q.get('exam_history') else {}
                    title = first_exam_hist.get('exam') or "Imported Exam (V2 Schema)"
                    if first_exam_hist.get('year'):
                        title += f" {first_exam_hist.get('year')}"
                    if first_exam_hist.get('shift'):
                        title += f" ({first_exam_hist.get('shift')})"
                    slug = None
                    category_slug = None
                    sub_category_slug = None
                    duration = 60
                    negative_marks = (first_q.get('marking') or {}).get('negative') or 0.0
                    positive_marks = (first_q.get('marking') or {}).get('positive') or 2.0
                else:
                    title = json_data.get('title') or json_data.get('exam_title', 'Imported Exam')
                    slug = json_data.get('slug')
                    category_slug = json_data.get('category_slug')
                    sub_category_slug = json_data.get('sub_category_slug')
                    duration = json_data.get('duration_minutes', 60)
                    negative_marks = json_data.get('negative_marks', 0.0)
                    positive_marks = json_data.get('positive_marks', 1.0)
                    questions_data = json_data.get('questions', [])
                
                # Try to resolve category and subcategory
                category = None
                sub_category = None
                if category_slug:
                    category = Category.objects.filter(slug=category_slug).first()
                if sub_category_slug and category:
                    sub_category = SubCategory.objects.filter(slug=sub_category_slug, category=category).first()

                # Create the Exam
                exam_create_kwargs = {
                    'title': title,
                    'subcategory': sub_category,
                    'duration_minutes': duration,
                    'marks_per_question': positive_marks,
                    'negative_marks': negative_marks,
                    'total_marks': 0,
                    'is_active': False
                }
                if slug:
                    exam_create_kwargs['slug'] = slug
                exam = Exam.objects.create(**exam_create_kwargs)

                total_marks = 0
                questions_to_create = []
                exam_questions_to_create = []
                
                for idx, q_data in enumerate(questions_data):
                    # Check if already canonical V2 schema format
                    if q_data.get('schema_version') == 'v2' or 'content' in q_data:
                        q_id = q_data.get('id') or f"q_{str(uuid.uuid4())[:8]}"
                        q_type = q_data.get('question_type', 'multiple_choice')
                        q_topic = (q_data.get('classification') or {}).get('topic', '')
                        q_origin = q_data.get('origin', 'pyq_extracted')
                        q_verified = (q_data.get('verification') or {}).get('verified', True)
                        q_marks = (q_data.get('marking') or {}).get('positive') or positive_marks

                        question = Question(
                            id=q_id,
                            origin=q_origin,
                            question_type=q_type,
                            schema_version='v2',
                            topic=q_topic,
                            schema_payload=q_data,
                            verified=q_verified
                        )
                        questions_to_create.append(question)
                        exam_questions_to_create.append(
                            ExamQuestion(exam=exam, question=question, order=idx)
                        )
                        total_marks += float(q_marks or 0.0)
                    else:
                        question_dict = q_data.get('question', {})
                        q_text = question_dict.get('text', '') if isinstance(question_dict, dict) else q_data.get('question_text', '')
                        if not q_text:
                            q_text = q_data.get('question_text', '')
                        
                        classification = q_data.get('classification', {})
                        subject = classification.get('subject', q_data.get('subject', ''))
                        topic = classification.get('topic', q_data.get('topic', ''))
                        difficulty = classification.get('difficulty', q_data.get('difficulty', 'Medium'))
                        
                        explanation = q_data.get('explanation', '')
                        if isinstance(explanation, dict):
                            explanation = explanation.get('text', '')
                        
                        question_type_raw = q_data.get('question_type', 'mcq')
                        question_type = 'multiple_choice' if question_type_raw in ['mcq', 'mcq_single'] else question_type_raw
                        
                        # Prepare options
                        options_data = q_data.get('options', [])
                        answer_data = q_data.get('answer', {})
                        correct_options = answer_data.get('correct_options', [])
                        correct_option_id = answer_data.get('correct_option', '')
                        
                        formatted_options = []
                        for opt_idx, opt in enumerate(options_data):
                            if isinstance(opt, dict):
                                opt_id = opt.get('id', str(opt_idx))
                                opt_text = opt.get('text', opt.get('answer_text', ''))
                                is_correct = opt.get('is_correct', False) or (opt_id in correct_options) or (opt_id == correct_option_id)
                                formatted_options.append({
                                    'id': opt_id,
                                    'text': opt_text,
                                    'answer_text': opt_text,
                                    'is_correct': is_correct
                                })
                            else:
                                formatted_options.append({
                                    'id': chr(65 + opt_idx),
                                    'text': str(opt),
                                    'answer_text': str(opt),
                                    'is_correct': (opt_idx == 0)
                                })

                        schema_payload = {
                            'id': q_data.get('id') or f"q_{str(uuid.uuid4())[:8]}",
                            'schema_version': 'v2',
                            'question_type': question_type,
                            'content': {'text': q_text, 'images': {}},
                            'question_text': q_text,
                            'options': formatted_options,
                            'explanation': {'text': explanation, 'images': {}},
                            'classification': {
                                'subject': subject,
                                'topic': topic,
                                'difficulty_label': difficulty
                            },
                            'marking': {
                                'positive': positive_marks,
                                'negative': negative_marks
                            }
                        }

                        q_id = schema_payload['id']
                        question = Question(
                            id=q_id,
                            origin='imported_json',
                            question_type=question_type,
                            schema_version='v2',
                            topic=topic,
                            schema_payload=schema_payload,
                            verified=True
                        )
                        questions_to_create.append(question)
                        exam_questions_to_create.append(
                            ExamQuestion(exam=exam, question=question, order=idx)
                        )
                        total_marks += positive_marks

                Question.objects.bulk_create(questions_to_create, ignore_conflicts=True)
                ExamQuestion.objects.bulk_create(exam_questions_to_create, ignore_conflicts=True)

                exam.total_questions = len(questions_data)
                exam.total_marks = total_marks
                exam.save(update_fields=['total_questions', 'total_marks'])
                
                return True, f"Successfully imported exam '{exam.title}' with {len(questions_data)} questions."
                
        except Exception as e:
            return False, f"Failed to import JSON: {str(e)}"
