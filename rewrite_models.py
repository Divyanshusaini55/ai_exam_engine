import re

with open('backend/quiz/models.py', 'r') as f:
    content = f.read()

# Remove Answer model
content = re.sub(r'class Answer\(models\.Model\):.*?def __str__\(self\):\n        return self\.answer_text\[:50\]\n\n\n', '', content, flags=re.DOTALL)
# Remove Answer if there's no __str__
content = re.sub(r'class Answer\(models\.Model\):.*?order = models\.IntegerField\(default=0\)\n\n\n', '', content, flags=re.DOTALL)

# Remove the Question model
content = re.sub(r'class Question\(models\.Model\):.*?topic = models\.CharField\(max_length=100, blank=True, null=True\)   \n\n\n', '', content, flags=re.DOTALL)

# Insert the V2 Question models before class UserAnswer
v2_models = """import uuid

class Tag(models.Model):
    name = models.CharField(max_length=100, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

class Question(models.Model):
    id = models.CharField(max_length=10, primary_key=True, editable=False)
    question_type = models.CharField(max_length=50, default='multiple_choice')
    origin = models.CharField(max_length=50, blank=True, help_text="e.g. ssc_cgl_2023, manual")
    schema_version = models.CharField(max_length=10, default='v2')
    schema_payload = models.JSONField(default=dict)
    
    difficulty_score = models.FloatField(default=1.0)
    topic = models.CharField(max_length=100, blank=True)
    tags = models.ManyToManyField(Tag, blank=True)
    verified = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if not self.id:
            self.id = str(uuid.uuid4())[:8]
        super().save(*args, **kwargs)

class ExamQuestion(models.Model):
    exam = models.ForeignKey(Exam, related_name='exam_questions', on_delete=models.CASCADE)
    question = models.ForeignKey(Question, on_delete=models.CASCADE)
    order = models.PositiveIntegerField(default=0)
    
    class Meta:
        ordering = ['order']

class QuestionImage(models.Model):
    question = models.ForeignKey(Question, related_name='images', on_delete=models.CASCADE)
    image_file = models.ImageField(upload_to='question_images/')
    ocr_text = models.TextField(blank=True)


"""
content = content.replace("class UserAnswer(models.Model):", v2_models + "class UserAnswer(models.Model):")

# Remove Answer and translations from signals
content = re.sub(r'@receiver\(\[post_save, post_delete\], sender=Answer\)\ndef answer_cache_clear.*?clear_exam_cache\(instance\.answer\.question\.exam_id\)\n\n', '', content, flags=re.DOTALL)

with open('backend/quiz/models.py', 'w') as f:
    f.write(content)
