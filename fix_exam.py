import re

with open('backend/quiz/models.py', 'r') as f:
    content = f.read()

# Add ManyToManyField to Exam
exam_search = "class Exam(models.Model):\n"
exam_replace = "class Exam(models.Model):\n    questions = models.ManyToManyField('Question', through='ExamQuestion', related_name='exams')\n"
content = content.replace(exam_search, exam_replace)

with open('backend/quiz/models.py', 'w') as f:
    f.write(content)
