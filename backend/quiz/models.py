
from django.db import models
from django.core.validators import RegexValidator
from django.utils import timezone
from django.utils.text import slugify
from django.contrib.postgres.indexes import GinIndex
from django.contrib.postgres.search import SearchVector



class Category(models.Model):
    slug = models.SlugField(unique=True, validators=[RegexValidator(regex=r'^[a-z0-9-]+$', message='Slug must be lowercase alphanumeric and hyphens only')], help_text="URL-safe identifier (e.g. 'ssc')")
    name = models.CharField(max_length=100, help_text="Display name (e.g. 'SSC')")
    description = models.TextField(blank=True)
    icon = models.CharField(max_length=50, default='school', help_text="Material Symbol name")
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
    slug = models.SlugField(unique=True, validators=[RegexValidator(regex=r'^[a-z0-9-]+$', message='Slug must be lowercase alphanumeric and hyphens only')], help_text="URL-safe identifier (e.g. 'ssc-cgl')")
    name = models.CharField(max_length=100, help_text="Display name (e.g. 'SSC CGL')")
    description = models.TextField(blank=True)
    icon = models.CharField(max_length=50, default='school', help_text="Material Symbol name")
    
    # Display control
    order = models.IntegerField(default=0, help_text="Display order within category")
    is_active = models.BooleanField(default=True, help_text="Show on frontend?")
    
    syllabus_pdf = models.FileField(
        upload_to='syllabus_pdfs/',
        null=True,
        blank=True,
        help_text="Syllabus PDF file for automated roadmap generation"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.category.name} - {self.name}"
        
    class Meta:
        verbose_name_plural = "SubCategories"
        ordering = ['order', 'name']


def get_default_languages():
    return ["en"]


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
    ai_summary = models.TextField(blank=True, null=True, help_text="Markdown formatted AI summary")

    # SEO-friendly globally unique slug (e.g. 'ssc-cgl-2024-shift-1')
    slug = models.SlugField(
        max_length=250,
        unique=True,
        blank=True,
        help_text="Auto-generated from subcategory + year + shift. Override only if needed.",
    )

    # Exam metadata
    year = models.IntegerField(null=True, blank=True, help_text="Exam year (e.g., 2024)")
    shift = models.CharField(max_length=50, blank=True, help_text="e.g., 'Shift 1', 'Morning', 'Afternoon'")
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='draft',
        help_text="Draft exams are not visible to students"
    )

    pdf_file = models.FileField(upload_to='pdfs/', null=True, blank=True)
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
    negative_marks = models.DecimalField(
        max_digits=5, 
        decimal_places=2,
        default=0.00,
        help_text="Marks deducted for each wrong answer"
    )
    total_marks = models.IntegerField(
        null=True,
        blank=True,
        help_text="Total marks for this exam"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True, help_text="Inactive exams are hidden from students")
    supported_languages = models.JSONField(default=get_default_languages, help_text="Supported languages for this exam")

    def __str__(self):
        year_str = f" ({self.year})" if self.year else ""
        shift_str = f" - {self.shift}" if self.shift else ""
        return f"{self.title}{year_str}{shift_str}"

    def _generate_slug(self):
        """Build a unique slug: {subcategory_slug}-{year}-{slugified_shift}."""
        parts = []
        if self.subcategory and self.subcategory.slug:
            parts.append(self.subcategory.slug)
        if self.year:
            parts.append(str(self.year))
        if self.shift:
            parts.append(slugify(self.shift))
        base = '-'.join(parts) if parts else 'exam'
        # Ensure uniqueness
        slug = base
        qs = Exam.objects.exclude(pk=self.pk)
        n = 1
        while qs.filter(slug=slug).exists():
            slug = f"{base}-{n}"
            n += 1
        return slug

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        old_marks_per_question = None
        if not is_new:
            old_exam = Exam.objects.filter(pk=self.pk).first()
            if old_exam:
                old_marks_per_question = old_exam.marks_per_question

        # Auto-generate slug if not set
        if not self.slug:
            self.slug = self._generate_slug()

        super().save(*args, **kwargs)

        if self.marks_per_question is not None:
            if is_new or old_marks_per_question != self.marks_per_question:
                self.questions.all().update(marks=self.marks_per_question)

        # Recalculate total marks
        if self.pk:
            from django.db.models import Sum
            total = self.questions.aggregate(total=Sum('marks'))['total'] or 0
            if self.total_marks != total:
                self.total_marks = total
                super().save(update_fields=['total_marks'])

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
    is_flagged_for_review = models.BooleanField(default=False)
    is_bookmarked = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.session_id} - {self.question}"

    class Meta:
        unique_together = [('session_id', 'question')]
        ordering = ['answered_at']


from django.contrib.auth.models import User

class ExamAttempt(models.Model):
    user = models.ForeignKey(User, related_name='exam_results', on_delete=models.SET_NULL, null=True, blank=True)
    guest_name = models.CharField(max_length=100, null=True, blank=True)
    guest_email = models.EmailField(null=True, blank=True)
    exam = models.ForeignKey(Exam, related_name='results', on_delete=models.CASCADE)
    score = models.FloatField()
    total_questions = models.IntegerField()
    correct_answers = models.IntegerField()
    percentage = models.FloatField()
    session_id = models.CharField(max_length=100, db_index=True)
    completed_at = models.DateTimeField(auto_now_add=True)
    duration = models.IntegerField(default=0, null=True, blank=True)
    is_completed = models.BooleanField(default=False)
    current_question_index = models.IntegerField(default=0)

    def __str__(self):
        username = self.user.username if self.user else (self.guest_name or "Guest")
        return f"{username} - {self.exam.title} ({self.percentage}%)"

    class Meta:
        ordering = ['-completed_at']
        indexes = [
            models.Index(fields=['user', 'completed_at'], name='attempt_user_date_idx'),
        ]


class PracticeSession(models.Model):
    user = models.ForeignKey(User, related_name='practice_sessions', on_delete=models.SET_NULL, null=True, blank=True)
    exam = models.ForeignKey(Exam, related_name='practice_sessions', on_delete=models.CASCADE)
    score = models.FloatField()
    total_questions = models.IntegerField()
    correct_answers = models.IntegerField()
    accuracy = models.FloatField()
    session_id = models.CharField(max_length=100, db_index=True)
    submitted_at = models.DateTimeField(auto_now_add=True)
    duration = models.IntegerField(default=0, null=True, blank=True)
    is_completed = models.BooleanField(default=False)
    current_question_index = models.IntegerField(default=0)
    is_paused = models.BooleanField(default=False)

    def __str__(self):
        username = self.user.username if self.user else "Guest"
        return f"{username} - {self.exam.title} ({self.accuracy}%) - Practice"

    class Meta:
        ordering = ['-submitted_at']


# Alias for backward compatibility
UserExamResult = ExamAttempt



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
class QuestionPaperUpload(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending Review'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('processed', 'Processed'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    category = models.ForeignKey(Category, on_delete=models.CASCADE)
    subject = models.CharField(max_length=200)
    exam_date = models.DateField()
    file = models.FileField(upload_to='question_papers/')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.category.name if self.category else 'Unknown'} - {self.subject} ({self.status})"

    class Meta:
        ordering = ['-created_at']

class CorrectionSuggestion(models.Model):
    TYPE_CHOICES = [
        ('question_text', 'Question Text'),
        ('correct_answer', 'Correct Answer'),
        ('option_text', 'Option Text'),
    ]
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='suggestions')
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name='suggestions')
    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    suggestion_data = models.JSONField()
    note = models.TextField(blank=True)
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    upvotes = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Suggestion by {self.user.username} for Q{self.question.id}"

    class Meta:
        ordering = ['-created_at']

class CurrentAffair(models.Model):
    title = models.CharField(max_length=500)
    slug = models.SlugField(unique=True, max_length=600, validators=[RegexValidator(regex=r'^[a-z0-9-]+$', message='Slug must be lowercase alphanumeric and hyphens only')])
    content = models.TextField(help_text="Full summarized content from AI")
    summary = models.TextField(blank=True, help_text="Short 2-sentence summary for list view")
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True)
    image_url = models.URLField(max_length=1000, blank=True, null=True)
    source_name = models.CharField(max_length=200, blank=True)
    source_url = models.URLField(max_length=1000, blank=True)
    published_date = models.DateField(default=timezone.now)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.published_date} - {self.title}"

    class Meta:
        ordering = ['-published_date', '-created_at']
        verbose_name_plural = "Current Affairs"

class ExamRoadmap(models.Model):
    subcategory = models.OneToOneField(SubCategory, on_delete=models.CASCADE, related_name='roadmap')
    title = models.CharField(max_length=200, help_text="e.g. 'Complete Syllabus for SSC CGL'")
    description = models.TextField(blank=True)
    bookmarks = models.ManyToManyField(User, related_name='bookmarked_roadmaps', blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Roadmap: {self.title}"

class RoadmapPhase(models.Model):
    roadmap = models.ForeignKey(ExamRoadmap, on_delete=models.CASCADE, related_name='phases')
    title = models.CharField(max_length=200, help_text="e.g. 'Phase 1: Basic Numeracy'")
    description = models.TextField(blank=True)
    order = models.IntegerField(default=0, help_text="Order in the timeline")

    def __str__(self):
        return f"{self.roadmap.title} - {self.title}"

    class Meta:
        ordering = ['order', 'id']

class RoadmapTopic(models.Model):
    phase = models.ForeignKey(RoadmapPhase, on_delete=models.CASCADE, related_name='topics')
    title = models.CharField(max_length=200, help_text="e.g. 'Percentage Basics'")
    slug = models.SlugField(unique=True, null=True, blank=True, validators=[RegexValidator(regex=r'^[a-z0-9-]+$', message='Slug must be lowercase alphanumeric and hyphens only')])
    description = models.TextField(blank=True)
    estimated_minutes = models.IntegerField(default=60, help_text="Estimated study time in minutes")
    order = models.IntegerField(default=0)
    resources = models.JSONField(default=list, blank=True, help_text="List of resources e.g. [{'type': 'video', 'url': '...', 'title': '...'}]")
    prerequisites = models.ManyToManyField(
        'self',
        symmetrical=False,
        blank=True,
        related_name='dependent_topics',
        help_text="Prerequisites required before studying this topic"
    )

    def __str__(self):
        return self.title

    class Meta:
        ordering = ['order', 'id']

class UserTopicProgress(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('in_progress', 'In Progress'),
        ('done', 'Done'),
        ('skip', 'Skip'),
    ]
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='roadmap_progress')
    topic = models.ForeignKey(RoadmapTopic, on_delete=models.CASCADE, related_name='progress')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    completed_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('user', 'topic')

    def __str__(self):
        return f"{self.user.username} - {self.topic.title} - {self.get_status_display()}"

class ResourceTag(models.Model):
    name = models.CharField(max_length=50, unique=True)
    slug = models.SlugField(unique=True, validators=[RegexValidator(regex=r'^[a-z0-9-]+$', message='Slug must be lowercase alphanumeric and hyphens only')])
    color = models.CharField(
        max_length=20,
        default='gray',
        help_text="Tailwind color name e.g. 'blue', 'green', 'purple'"
    )

    def __str__(self):
        return self.name

    class Meta:
        ordering = ['name']


class TopicResource(models.Model):

    RESOURCE_TYPE_CHOICES = [
        ('article',        'Article'),
        ('markdown_note',  'Markdown Note'),
        ('html_note',      'HTML Note'),
        ('latex_note',     'LaTeX Note'),
        ('video',          'Video'),
        ('pdf',            'PDF'),
        ('external_link',  'External Link'),
        ('ai_note',        'AI Note'),
        ('formula_sheet',  'Formula Sheet'),
        ('quiz',           'Quiz / Practice Set'),
    ]

    CONTENT_FORMAT_CHOICES = [
        ('markdown',  'Markdown'),
        ('html',      'HTML'),
        ('latex',     'LaTeX'),
        ('plaintext', 'Plain Text'),
        ('url',       'URL Only'),
    ]

    DIFFICULTY_CHOICES = [
        ('beginner',     'Beginner'),
        ('intermediate', 'Intermediate'),
        ('advanced',     'Advanced'),
    ]

    topic = models.ForeignKey(
        RoadmapTopic,
        on_delete=models.CASCADE,
        related_name='topic_resources',
        help_text="The roadmap topic this resource belongs to"
    )
    tags = models.ManyToManyField(ResourceTag, blank=True, related_name='resources')
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='created_resources',
        help_text="Admin/staff who created this resource"
    )
    title = models.CharField(max_length=500)
    slug = models.SlugField(max_length=550, blank=True, unique=True, validators=[RegexValidator(regex=r'^[a-z0-9-]+$', message='Slug must be lowercase alphanumeric and hyphens only')], help_text="Auto-generated from title")
    short_description = models.TextField(
        blank=True,
        help_text="One-line summary shown in resource cards"
    )
    resource_type = models.CharField(
        max_length=30,
        choices=RESOURCE_TYPE_CHOICES,
        default='article',
        db_index=True,
        help_text="What kind of content is this?"
    )
    content_format = models.CharField(
        max_length=20,
        choices=CONTENT_FORMAT_CHOICES,
        default='markdown',
        help_text="Primary content format for the reader to render"
    )

    markdown_content = models.TextField(
        blank=True,
        help_text="Markdown source. Supports GFM, math ($$…$$), fenced code blocks, tables."
    )
    html_content = models.TextField(
        blank=True,
        help_text="Raw HTML content. Will be sanitized via DOMPurify on the frontend."
    )
    latex_content = models.TextField(
        blank=True,
        help_text="LaTeX source for formula sheets or derivation notes."
    )
    external_url = models.URLField(
        blank=True,
        max_length=2000,
        help_text="External link (YouTube, PDF URL, article URL, etc.)"
    )

    thumbnail = models.ImageField(
        upload_to='resource_thumbnails/',
        null=True, blank=True,
        help_text="Optional thumbnail image for resource cards"
    )
    estimated_read_minutes = models.PositiveIntegerField(
        default=5,
        help_text="Estimated reading/watching time in minutes"
    )
    difficulty = models.CharField(
        max_length=20,
        choices=DIFFICULTY_CHOICES,
        default='beginner',
        db_index=True
    )
    order = models.PositiveIntegerField(
        default=0,
        help_text="Display order within the topic (lower = first)"
    )
    is_featured = models.BooleanField(
        default=False,
        help_text="Pinned/highlighted at top of the resource hub"
    )
    is_published = models.BooleanField(
        default=False,
        db_index=True,
        help_text="Only published resources appear on the frontend"
    )
    is_ai_generated = models.BooleanField(
        default=False,
        help_text="True if content was generated by AI"
    )
    ai_summary = models.TextField(
        blank=True,
        help_text="Short AI-generated summary shown as a callout in the article reader"
    )
    view_count = models.PositiveIntegerField(
        default=0,
        editable=False,
        help_text="Auto-incremented on each API read"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"[{self.get_resource_type_display()}] {self.title}"

    def save(self, *args, **kwargs):
        from django.utils.text import slugify
        if self.slug:
            self.slug = slugify(self.slug)
        elif self.title:
            base_slug = slugify(self.title)[:500]
            slug = base_slug
            counter = 1
            while TopicResource.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                slug = f"{base_slug}-{counter}"
                counter += 1
            self.slug = slug
        super().save(*args, **kwargs)

    class Meta:
        ordering = ['order', 'created_at']
        verbose_name = "Topic Resource"
        verbose_name_plural = "Topic Resources"


class ResourceProgress(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='resource_progress'
    )
    resource = models.ForeignKey(
        TopicResource,
        on_delete=models.CASCADE,
        related_name='user_progress'
    )
    is_completed = models.BooleanField(default=False)
    last_viewed_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('user', 'resource')
        verbose_name = "Resource Progress"
        verbose_name_plural = "Resource Progress"

    def __str__(self):
        status = "✓" if self.is_completed else "○"
        return f"{status} {self.user.username} — {self.resource.title}"


class ResourceBookmark(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='resource_bookmarks'
    )
    resource = models.ForeignKey(
        TopicResource,
        on_delete=models.CASCADE,
        related_name='bookmarks'
    )
    bookmarked_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'resource')
        ordering = ['-bookmarked_at']
        verbose_name = "Resource Bookmark"
        verbose_name_plural = "Resource Bookmarks"

    def __str__(self):
        return f"♥ {self.user.username} — {self.resource.title}"


from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.core.cache import cache

def clear_exam_cache(exam_id):
    if exam_id:
        for lang in ['en', 'hi']:
            cache.delete(f"exam:{exam_id}:{lang}")
            cache.delete(f"exam_questions:{exam_id}:{lang}")

@receiver([post_save, post_delete], sender=Exam)
def exam_cache_clear(sender, instance, **kwargs):
    clear_exam_cache(instance.id)

@receiver([post_save, post_delete], sender=Question)
def question_cache_clear(sender, instance, **kwargs):
    clear_exam_cache(instance.exam_id)

@receiver([post_save, post_delete], sender=Answer)
def answer_cache_clear(sender, instance, **kwargs):
    if hasattr(instance, 'question') and instance.question:
        clear_exam_cache(instance.question.exam_id)

@receiver([post_save, post_delete], sender='quiz.QuestionTranslation')
def question_translation_cache_clear(sender, instance, **kwargs):
    if hasattr(instance, 'question') and instance.question:
        clear_exam_cache(instance.question.exam_id)

@receiver([post_save, post_delete], sender='quiz.AnswerTranslation')
def answer_translation_cache_clear(sender, instance, **kwargs):
    if hasattr(instance, 'answer') and instance.answer and hasattr(instance.answer, 'question') and instance.answer.question:
        clear_exam_cache(instance.answer.question.exam_id)

from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from cache import (
    invalidate_exam_summary,
    invalidate_exam_roadmap,
    invalidate_user_dashboard
)

@receiver([post_save, post_delete], sender=Exam)
def invalidate_exam_caches(sender, instance, **kwargs):
    invalidate_exam_summary(instance.id)
    invalidate_exam_roadmap(instance.id)

@receiver([post_save, post_delete], sender=ExamAttempt)
def invalidate_dashboard_on_attempt(sender, instance, **kwargs):
    if hasattr(instance, 'user_id'):
        invalidate_user_dashboard(instance.user_id)
