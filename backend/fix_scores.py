import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from quiz.models import ExamAttempt, PracticeSession, UserAnswer
from django.db import models

for attempt in ExamAttempt.objects.all():
    user_answers = UserAnswer.objects.filter(exam=attempt.exam, session_id=attempt.session_id)
    correct_answers = user_answers.filter(is_correct=True).count()
    wrong_answers = user_answers.filter(is_correct=False).exclude(selected_answer__isnull=True).count()
    
    positive_score = user_answers.filter(is_correct=True).aggregate(
        total=models.Sum('question__marks')
    )['total'] or 0
    penalty = float(wrong_answers) * float(attempt.exam.negative_marks or 0.0)
    
    attempt.score = float(positive_score) - penalty
    attempt.save(update_fields=['score'])

for attempt in PracticeSession.objects.all():
    user_answers = UserAnswer.objects.filter(exam=attempt.exam, session_id=attempt.session_id)
    correct_answers = user_answers.filter(is_correct=True).count()
    wrong_answers = user_answers.filter(is_correct=False).exclude(selected_answer__isnull=True).count()
    
    positive_score = user_answers.filter(is_correct=True).aggregate(
        total=models.Sum('question__marks')
    )['total'] or 0
    penalty = float(wrong_answers) * float(attempt.exam.negative_marks or 0.0)
    
    attempt.score = float(positive_score) - penalty
    attempt.save(update_fields=['score'])

print("Scores recalculated successfully.")
