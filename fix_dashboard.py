import re

with open('backend/quiz/api_dashboard.py', 'r') as f:
    content = f.read()

# Replace selected_answer select_related
old_select = ".select_related('question', 'selected_answer')"
new_select = ".select_related('question')"
content = content.replace(old_select, new_select)

# Replace wrong_answers
old_wrong_answers = "wrong_answers = user_answers.filter(is_correct=False).exclude(selected_answer__isnull=True).count()"
new_wrong_answers = "wrong_answers = user_answers.filter(is_correct=False).exclude(selected_options=[]).count()"
content = content.replace(old_wrong_answers, new_wrong_answers)

with open('backend/quiz/api_dashboard.py', 'w') as f:
    f.write(content)
