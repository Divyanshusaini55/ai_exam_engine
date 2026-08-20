import re

with open('backend/quiz/models.py', 'r') as f:
    content = f.read()

# Remove the first Question class
# It starts with "class Question(models.Model):" (the one before "class Answer(models.Model):")
# We can find all class Question and remove the first one.

parts = content.split("class Question(models.Model):")
if len(parts) > 2:
    # There's more than one Question class!
    # The first one ends before "class Answer(models.Model):"
    first_part = parts[0]
    middle_part = parts[1]
    
    # We want to remove middle_part (which is the body of the first Question class)
    # AND we want to remove the Answer class which is probably in middle_part or part[2]
    # Let's just use string replace.

old_question = """class Question(models.Model):
    exam = models.ForeignKey(Exam, related_name='questions', on_delete=models.CASCADE)
    question_text = models.TextField()

    # Image Support
    image = models.ImageField(
        upload_to='question_images/',
        null=True,
        blank=True
    )
    is_image_based = models.BooleanField(default=False)

    question_type = models.CharField(
        max_length=20,
        choices=[
            ('multiple_choice', 'Multiple Choice'),
            ('true_false', 'True/False'),
            ('short_answer', 'Short Answer'),
        ],
        default='multiple_choice'
    )
    order = models.IntegerField(default=0)
    marks = models.IntegerField(default=1)
    
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    question_text = models.TextField()
    
    explanation = models.TextField(blank=True, null=True) 

    subject = models.CharField(max_length=100, blank=True, null=True) 
    topic = models.CharField(max_length=100, blank=True, null=True)   
    difficulty = models.CharField(max_length=20, blank=True, null=True) 

    def __str__(self):
        return f"{self.exam.title} - Q{self.order + 1}"

    class Meta:
        ordering = ['order']"""

old_answer = """class Answer(models.Model):
    question = models.ForeignKey(Question, related_name='answers', on_delete=models.CASCADE)
    answer_text = models.TextField()
    is_correct = models.BooleanField(default=False)
    order = models.IntegerField(default=0)

    def __str__(self):
        return f"{self.question} - {self.answer_text[:50]}"

    class Meta:
        ordering = ['order']"""

with open('backend/quiz/models.py', 'w') as f:
    c = content.replace(old_question, "")
    c = c.replace(old_answer, "")
    f.write(c)

