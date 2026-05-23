from django.db import models
from .models import Question, Answer

class QuestionTranslation(models.Model):
    LANGUAGE_CHOICES = [
        ('en', 'English'),
        ('hi', 'Hindi'),
    ]
    
    question = models.ForeignKey(
        Question,
        related_name='translations',
        on_delete=models.CASCADE,
        help_text="The question being translated"
    )
    language = models.CharField(
        max_length=10,
        choices=LANGUAGE_CHOICES,
        help_text="Target language"
    )
    question_text = models.TextField(help_text="Translated question text")
    explanation = models.TextField(
        blank=True,
        null=True,
        help_text="Translated explanation text"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('question', 'language')
        indexes = [
            models.Index(fields=['question', 'language']),
        ]
        verbose_name = "Question Translation"
        verbose_name_plural = "Question Translations"

    def __str__(self):
        return f"{self.question} ({self.language})"


class AnswerTranslation(models.Model):
    LANGUAGE_CHOICES = [
        ('en', 'English'),
        ('hi', 'Hindi'),
    ]

    answer = models.ForeignKey(
        Answer,
        related_name='translations',
        on_delete=models.CASCADE,
        help_text="The answer choice being translated"
    )
    language = models.CharField(
        max_length=10,
        choices=LANGUAGE_CHOICES,
        help_text="Target language"
    )
    answer_text = models.TextField(help_text="Translated answer text")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('answer', 'language')
        verbose_name = "Answer Translation"
        verbose_name_plural = "Answer Translations"

    def __str__(self):
        return f"{self.answer} ({self.language})"
