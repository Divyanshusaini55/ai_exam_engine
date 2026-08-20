import json
import os
import uuid
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils.text import slugify
from quiz.models import Exam, Question, ExamQuestion, Topic, Tag, Category, SubCategory

class Command(BaseCommand):
    help = 'Imports exam data from JSON into the new Hybrid schema'

    def add_arguments(self, parser):
        parser.add_argument('json_file', type=str, help='Path to the JSON file')

    def handle(self, *args, **kwargs):
        json_file = kwargs['json_file']
        
        if not os.path.exists(json_file):
            self.stderr.write(self.style.ERROR(f'File not found: {json_file}'))
            return
            
        with open(json_file, 'r', encoding='utf-8') as f:
            try:
                data = json.load(f)
            except json.JSONDecodeError as e:
                self.stderr.write(self.style.ERROR(f'Invalid JSON format: {e}'))
                return
                
        self.stdout.write(self.style.NOTICE(f'Importing exam into hybrid schema from {json_file}...'))
        
        try:
            with transaction.atomic():
                exam_title = data.get('exam_title', 'Imported Exam')
                slug = data.get('slug', '')
                duration = data.get('duration_minutes', 60)
                questions_data = data.get('questions', [])

                # Resolve category and subcategory
                category_slug = data.get('category_slug', '')
                subcategory_slug = data.get('subcategory_slug') or data.get('sub_category_slug', '')
                year = data.get('year')
                shift = data.get('shift', '')

                if not category_slug or not subcategory_slug:
                    if slug.startswith('ssc-cgl'):
                        category_slug = 'ssc'
                        subcategory_slug = 'ssc-cgl'
                    elif slug.startswith('ssc-chsl'):
                        category_slug = 'ssc'
                        subcategory_slug = 'ssc-chsl'
                    elif slug.startswith('ssc-mts'):
                        category_slug = 'ssc'
                        subcategory_slug = 'ssc-mts'
                    elif slug.startswith('rrb-') or 'ntpc' in slug:
                        category_slug = 'railways'
                        subcategory_slug = 'rrb-ntpc'
                    elif slug.startswith('upsc-'):
                        category_slug = 'upsc'
                        subcategory_slug = 'upsc-cse'
                    else:
                        category_slug = category_slug or 'ssc'
                        subcategory_slug = subcategory_slug or 'ssc-cgl'

                if not year:
                    import re
                    year_match = re.search(r'(20\d\d)', slug)
                    if year_match:
                        year = int(year_match.group(1))

                if not shift:
                    import re
                    shift_match = re.search(r'shift[-_ ]?(\d+)', slug, re.IGNORECASE)
                    if shift_match:
                        shift = f"Shift {shift_match.group(1)}"

                cat_names = {
                    'ssc': 'SSC',
                    'upsc': 'UPSC',
                    'banking': 'Banking',
                    'railways': 'Railways',
                    'defence': 'Defence',
                    'state-psc': 'State PSC',
                }
                subcat_names = {
                    'ssc-cgl': 'SSC CGL',
                    'ssc-chsl': 'SSC CHSL',
                    'ssc-mts': 'SSC MTS',
                    'rrb-ntpc': 'RRB NTPC',
                    'upsc-cse': 'UPSC CSE',
                }

                category, _ = Category.objects.get_or_create(
                    slug=category_slug,
                    defaults={'name': cat_names.get(category_slug, category_slug.replace('-', ' ').title())}
                )
                subcategory, _ = SubCategory.objects.get_or_create(
                    slug=subcategory_slug,
                    defaults={
                        'name': subcat_names.get(subcategory_slug, subcategory_slug.replace('-', ' ').upper()),
                        'category': category
                    }
                )
                if subcategory.category != category:
                    subcategory.category = category
                    subcategory.save()

                exam, created = Exam.objects.update_or_create(
                    slug=slug,
                    defaults={
                        'title': exam_title,
                        'subcategory': subcategory,
                        'year': year,
                        'shift': shift,
                        'duration_minutes': duration,
                        'is_active': True,
                        'status': 'published'
                    }
                )
                
                # Clear existing questions for this exam to avoid duplicates
                ExamQuestion.objects.filter(exam=exam).delete()

                total_marks = 0
                
                for idx, q_data in enumerate(questions_data):
                    topic_name = q_data.get('topic', 'General')
                    subject_name = q_data.get('subject', 'General')
                    topic_slug = slugify(topic_name) or 'general'
                    
                    # Create or get Topic
                    topic, _ = Topic.objects.get_or_create(
                        slug=topic_slug,
                        defaults={
                            'name': topic_name,
                            'subcategory': subcategory
                        }
                    )
                    
                    schema_payload = {
                        "question_text": q_data.get('question_text', ''),
                        "options": q_data.get('options', []),
                        "explanation": q_data.get('explanation', ''),
                        "subject": subject_name,
                        "difficulty": q_data.get('difficulty', 'Medium'),
                    }
                    
                    difficulty_map = {
                        'Easy': 1.0,
                        'Medium': 2.0,
                        'Hard': 3.0
                    }
                    difficulty_score = difficulty_map.get(q_data.get('difficulty', 'Medium'), 2.0)
                    
                    question_id = str(uuid.uuid4())
                    
                    question = Question.objects.create(
                        id=question_id,
                        origin='pyq',
                        question_type='mcq',
                        difficulty_score=difficulty_score,
                        topic=topic,
                        schema_payload=schema_payload,
                        verified=True
                    )
                    
                    # Link question to exam
                    ExamQuestion.objects.create(
                        exam=exam,
                        question=question,
                        order=idx
                    )
                    
                    marks = q_data.get('marks', 1)
                    total_marks += marks
                
                exam.total_marks = total_marks
                exam.save()

                self.stdout.write(self.style.SUCCESS(f'Successfully imported exam "{exam.title}" with {len(questions_data)} questions into Hybrid Schema.'))

        except Exception as e:
            self.stderr.write(self.style.ERROR(f'Failed to import JSON: {str(e)}'))
