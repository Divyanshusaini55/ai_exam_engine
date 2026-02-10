# from django.db import models
# from django.utils import timezone


# class Exam(models.Model):
#     title = models.CharField(max_length=200)
#     description = models.TextField(blank=True)
#     pdf_file = models.FileField(upload_to='pdfs/')
#     duration_minutes = models.IntegerField(default=60)
#     total_questions = models.IntegerField(default=10)
#     created_at = models.DateTimeField(auto_now_add=True)
#     updated_at = models.DateTimeField(auto_now=True)
#     is_active = models.BooleanField(default=True)

#     def __str__(self):
#         return self.title

#     class Meta:
#         ordering = ['-created_at']


# class Question(models.Model):
#     exam = models.ForeignKey(Exam, related_name='questions', on_delete=models.CASCADE)
#     question_text = models.TextField()

#     # 🔥 NEW FIELDS (IMAGE SUPPORT)
#     image = models.ImageField(
#         upload_to='question_images/',
#         null=True,
#         blank=True
#     )
#     is_image_based = models.BooleanField(default=False)

#     question_type = models.CharField(
#         max_length=20,
#         choices=[
#             ('multiple_choice', 'Multiple Choice'),
#             ('true_false', 'True/False'),
#             ('short_answer', 'Short Answer'),
#         ],
#         default='multiple_choice'
#     )
#     order = models.IntegerField(default=0)
#     points = models.IntegerField(default=1)
#     created_at = models.DateTimeField(auto_now_add=True)

#     def __str__(self):
#         return f"{self.exam.title} - Q{self.order + 1}"

#     class Meta:
#         ordering = ['order']



# class Answer(models.Model):
#     question = models.ForeignKey(Question, related_name='answers', on_delete=models.CASCADE)
#     answer_text = models.TextField()
#     is_correct = models.BooleanField(default=False)
#     order = models.IntegerField(default=0)

#     def __str__(self):
#         return f"{self.question} - {self.answer_text[:50]}"

#     class Meta:
#         ordering = ['order']


# class UserAnswer(models.Model):
#     exam = models.ForeignKey(Exam, related_name='user_answers', on_delete=models.CASCADE)
#     question = models.ForeignKey(Question, on_delete=models.CASCADE)
#     selected_answer = models.ForeignKey(Answer, null=True, blank=True, on_delete=models.SET_NULL)
#     text_answer = models.TextField(blank=True)
#     is_correct = models.BooleanField(default=False)
#     answered_at = models.DateTimeField(auto_now_add=True)
#     session_id = models.CharField(max_length=100, db_index=True)

#     def __str__(self):
#         return f"{self.session_id} - {self.question}"

#     class Meta:
#         unique_together = [('session_id', 'question')]
#         ordering = ['answered_at']

from django.db import models
from django.utils import timezone



class Category(models.Model):
    slug = models.SlugField(unique=True, help_text="URL-safe identifier (e.g. 'ssc')")
    name = models.CharField(max_length=100, help_text="Display name (e.g. 'SSC')")
    description = models.TextField(blank=True)
    icon = models.CharField(max_length=50, default='school', help_text="Material Symbol name")
    
    # Display and styling
    order = models.IntegerField(default=0, help_text="Display order (lower = first)")
    is_active = models.BooleanField(default=True, help_text="Show on frontend?")
    icon_color = models.CharField(max_length=20, default='blue', help_text="Tailwind color name (e.g. 'blue', 'purple')")
    bg_color = models.CharField(max_length=50, default='bg-blue-100', help_text="Tailwind background class")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name
    
    class Meta:
        verbose_name_plural = "Categories"
        ordering = ['order', 'name']


class SubCategory(models.Model):
    category = models.ForeignKey(Category, related_name='subcategories', on_delete=models.CASCADE)
    slug = models.SlugField(unique=True, help_text="URL-safe identifier (e.g. 'ssc-cgl')")
    name = models.CharField(max_length=100, help_text="Display name (e.g. 'SSC CGL')")
    description = models.TextField(blank=True)
    icon = models.CharField(max_length=50, default='school', help_text="Material Symbol name")
    
    # Display control
    order = models.IntegerField(default=0, help_text="Display order within category")
    is_active = models.BooleanField(default=True, help_text="Show on frontend?")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.category.name} - {self.name}"
        
    class Meta:
        verbose_name_plural = "SubCategories"
        ordering = ['order', 'name']


class Exam(models.Model):
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('published', 'Published'),
        ('archived', 'Archived'),
    ]

    # Required relationship to subcategory (null=True temporarily for migration)
    subcategory = models.ForeignKey(
        SubCategory, 
        related_name='exams', 
        on_delete=models.PROTECT,  # Prevent deletion if exams exist
        null=True,  # Temporarily allow null for existing data
        blank=True,
        help_text="Select the subcategory this exam belongs to"
    )

    title = models.CharField(max_length=200, help_text="Exam title")
    description = models.TextField(blank=True)
    
    # Exam metadata
    year = models.IntegerField(null=True, blank=True, help_text="Exam year (e.g., 2024)")
    shift = models.CharField(max_length=50, blank=True, help_text="e.g., 'Shift 1', 'Morning', 'Afternoon'")
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='draft',
        help_text="Draft exams are not visible to students"
    )

    pdf_file = models.FileField(upload_to='pdfs/')
    duration_minutes = models.IntegerField(default=60)
    total_questions = models.IntegerField(default=10)
    
    # Marking scheme
    marks_per_question = models.DecimalField(
        max_digits=5, 
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Marks awarded for each correct answer"
    )
    total_marks = models.IntegerField(
        null=True,
        blank=True,
        help_text="Total marks for this exam"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True, help_text="Inactive exams are hidden from students")

    def __str__(self):
        year_str = f" ({self.year})" if self.year else ""
        shift_str = f" - {self.shift}" if self.shift else ""
        return f"{self.title}{year_str}{shift_str}"

    class Meta:
        ordering = ['-created_at']



class Question(models.Model):
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
    points = models.IntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)

        # ... existing fields ...
    question_text = models.TextField()
    
    # 🔥 Add this new field
    explanation = models.TextField(blank=True, null=True) 

    # 🔥 AI Classification Fields
    subject = models.CharField(max_length=100, blank=True, null=True) # e.g. "Reasoning"
    topic = models.CharField(max_length=100, blank=True, null=True)   # e.g. "Blood Relations"
    difficulty = models.CharField(max_length=20, blank=True, null=True) # e.g. "Easy", "Medium", "Hard"

    def __str__(self):
        return f"{self.exam.title} - Q{self.order + 1}"

    class Meta:
        ordering = ['order']


class Answer(models.Model):
    question = models.ForeignKey(Question, related_name='answers', on_delete=models.CASCADE)
    answer_text = models.TextField()
    is_correct = models.BooleanField(default=False)
    order = models.IntegerField(default=0)

    def __str__(self):
        return f"{self.question} - {self.answer_text[:50]}"

    class Meta:
        ordering = ['order']


class UserAnswer(models.Model):
    exam = models.ForeignKey(Exam, related_name='user_answers', on_delete=models.CASCADE)
    question = models.ForeignKey(Question, on_delete=models.CASCADE)
    selected_answer = models.ForeignKey(Answer, null=True, blank=True, on_delete=models.SET_NULL)
    text_answer = models.TextField(blank=True)
    is_correct = models.BooleanField(default=False)
    answered_at = models.DateTimeField(auto_now_add=True)
    session_id = models.CharField(max_length=100, db_index=True)

    def __str__(self):
        return f"{self.session_id} - {self.question}"

    class Meta:
        unique_together = [('session_id', 'question')]
        ordering = ['answered_at']


from django.contrib.auth.models import User

class UserExamResult(models.Model):
    user = models.ForeignKey(User, related_name='exam_results', on_delete=models.CASCADE)
    exam = models.ForeignKey(Exam, related_name='results', on_delete=models.CASCADE)
    score = models.IntegerField()
    total_questions = models.IntegerField()
    correct_answers = models.IntegerField()
    percentage = models.FloatField()
    session_id = models.CharField(max_length=100, db_index=True)
    completed_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - {self.exam.title} ({self.percentage}%)"

    class Meta:
        ordering = ['-completed_at']


class ContactMessage(models.Model):
    """Model to store contact form submissions from users"""
    STATUS_CHOICES = [
        ('unread', 'Unread'),
        ('read', 'Read'),
    ]
    
    name = models.CharField(max_length=200)
    email = models.EmailField()
    message = models.TextField()
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='unread')
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.name} - {self.email} ({self.created_at.strftime('%Y-%m-%d %H:%M')})"
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = "Contact Message"
        verbose_name_plural = "Contact Messages"