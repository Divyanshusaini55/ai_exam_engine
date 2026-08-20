import re

with open('quiz/models.py', 'r') as f:
    content = f.read()

user_answer_old = """    exam = models.ForeignKey(Exam, related_name='user_answers', on_delete=models.CASCADE)
    question = models.ForeignKey(Question, on_delete=models.CASCADE)
    selected_answer = models.ForeignKey(Answer, null=True, blank=True, on_delete=models.SET_NULL)
    text_answer = models.TextField(blank=True)
    is_correct = models.BooleanField(default=False)"""

user_answer_new = """    exam = models.ForeignKey(Exam, related_name='user_answers', on_delete=models.CASCADE)
    question = models.ForeignKey(Question, on_delete=models.CASCADE)
    selected_options = models.JSONField(default=list, blank=True)
    answer_payload = models.JSONField(default=dict, blank=True)
    is_correct = models.BooleanField(default=False)"""

content = content.replace(user_answer_old, user_answer_new)

with open('quiz/models.py', 'w') as f:
    f.write(content)
