import re

with open('backend/quiz/api.py', 'r') as f:
    content = f.read()

# Replace submit_answer logic
old_submit_answer = """        if answer_id is not None:
            if answer_id:
                selected_answer = get_object_or_404(
                    Answer,
                    id=answer_id,
                    question=question
                )
                defaults['selected_answer'] = selected_answer
                defaults['is_correct'] = selected_answer.is_correct
            else:
                defaults['selected_answer'] = None
                defaults['is_correct'] = False"""

new_submit_answer = """        if answer_id is not None:
            if str(answer_id).strip() != "":
                try:
                    ans_idx = int(answer_id)
                    options = question.schema_payload.get('options', [])
                    if 0 <= ans_idx < len(options):
                        defaults['selected_options'] = [ans_idx]
                        defaults['is_correct'] = options[ans_idx].get('is_correct', False)
                    else:
                        defaults['selected_options'] = []
                        defaults['is_correct'] = False
                except (ValueError, TypeError):
                    defaults['selected_options'] = []
                    defaults['is_correct'] = False
            else:
                defaults['selected_options'] = []
                defaults['is_correct'] = False"""

content = content.replace(old_submit_answer, new_submit_answer)

# Replace submit_exam logic
old_wrong_answers = "wrong_answers = user_answers.filter(is_correct=False).exclude(selected_answer__isnull=True).count()"
new_wrong_answers = "wrong_answers = user_answers.filter(is_correct=False).exclude(selected_options=[]).count()"
content = content.replace(old_wrong_answers, new_wrong_answers)

# Calculate marks dynamically in submit_exam
old_positive_score = """        positive_score = user_answers.filter(is_correct=True).aggregate(
            total=models.Sum('question__marks')
        )['total'] or 0"""

new_positive_score = """        # Cannot easily aggregate over JSONField, calculate in Python
        positive_score = sum(
            float(ua.question.schema_payload.get('marks', 1))
            for ua in user_answers.filter(is_correct=True).select_related('question')
        )"""
content = content.replace(old_positive_score, new_positive_score)

with open('backend/quiz/api.py', 'w') as f:
    f.write(content)
