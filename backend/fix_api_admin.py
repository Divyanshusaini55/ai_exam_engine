import re

with open('quiz/api_admin.py', 'r') as f:
    content = f.read()

# Imports
content = re.sub(r'Exam, Question, Answer, UserAnswer, ExamAttempt, Category, SubCategory,', 'Exam, Question, UserAnswer, ExamAttempt, Category, SubCategory,', content)
content = re.sub(r'from \.models_translations import QuestionTranslation, AnswerTranslation\n', '', content)

# Dashboard queries: Count('answers')
content = re.sub(r'\.annotate\([^)]*Count\(\'answers\'\)[^)]*\)', '', content)

# Remove the Answer translation save logic block (which is used in the import process)
content = re.sub(r'# Process options\n.*?if answer_text_hi:\n.*?AnswerTranslation\.objects\.update_or_create\(.*?\)\n', '', content, flags=re.DOTALL)
content = re.sub(r'ans = Answer\.objects\.create\([^)]*\)\n', '', content)

with open('quiz/api_admin.py', 'w') as f:
    f.write(content)
