from django.db import models
from django.core.validators import RegexValidator
from django.contrib.auth.models import User
from quiz.models import Question


class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    avatar_char = models.CharField(max_length=1, blank=True)
    avatar_image = models.ImageField(upload_to='avatars/', null=True, blank=True)
    bio = models.TextField(blank=True)
    full_name = models.CharField(max_length=200, blank=True)
    show_profile_pic = models.BooleanField(default=True)

    # Gamification 
    xp = models.IntegerField(default=0)
    streak = models.IntegerField(default=0)
    best_streak = models.IntegerField(default=0)
    last_activity = models.DateField(null=True, blank=True)

    # Denormalized counters (updated via signals, O(1) reads)
    total_solutions = models.IntegerField(default=0)
    total_comments = models.IntegerField(default=0)
    total_upvotes_received = models.IntegerField(default=0)
    total_views = models.IntegerField(default=0)
    uploads_approved = models.IntegerField(default=0)
    suggestions_approved = models.IntegerField(default=0)
    ai_verified_count = models.IntegerField(default=0)

    # Computed scores (updated via services)
    reputation_score = models.FloatField(default=0.0)   # 0-100
    community_rank = models.IntegerField(default=0)
    percentile = models.FloatField(default=0.0)

    def __str__(self):
        return f"{self.user.username}'s Profile"


class Badge(models.Model):
    CRITERIA_TYPES = [
        ('solutions_count', 'Solutions Count'),
        ('xp_threshold', 'XP Threshold'),
        ('streak', 'Streak Days'),
        ('uploads', 'Uploads Approved'),
        ('suggestions', 'Suggestions Approved'),
        ('upvotes', 'Upvotes Received'),
        ('ai_verified', 'AI Verified Count'),
        ('manual', 'Manual Award'),
    ]
    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(unique=True, validators=[RegexValidator(regex=r'^[a-z0-9-]+$', message='Slug must be lowercase alphanumeric and hyphens only')])
    description = models.CharField(max_length=300)
    icon = models.CharField(max_length=50, default='sparkles')
    color_gradient = models.CharField(max_length=100, default='from-amber-400 to-orange-500')
    criteria_type = models.CharField(max_length=30, choices=CRITERIA_TYPES, default='manual')
    criteria_value = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

    class Meta:
        ordering = ['name']


class UserBadge(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='badges')
    badge = models.ForeignKey(Badge, on_delete=models.CASCADE, related_name='user_badges')
    awarded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'badge')
        ordering = ['-awarded_at']

    def __str__(self):
        return f"{self.user.username} — {self.badge.name}"


class ContributorActivity(models.Model):
    ACTIVITY_TYPES = [
        ('SOLUTION', 'Solution Posted'),
        ('COMMENT', 'Comment Posted'),
        ('UPLOAD', 'Paper Uploaded'),
        ('SUGGESTION', 'Correction Suggested'),
        ('EXAM', 'Exam Completed'),
        ('STREAK', 'Streak Milestone'),
        ('BADGE', 'Badge Earned'),
        ('ROADMAP', 'Roadmap Topic Done'),
    ]
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='activities')
    activity_type = models.CharField(max_length=20, choices=ACTIVITY_TYPES)
    description = models.CharField(max_length=500)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'created_at'], name='activity_user_date_idx'),
            models.Index(fields=['created_at'], name='activity_date_idx'),
        ]

    def __str__(self):
        return f"{self.user.username}: {self.activity_type}"


class Solution(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='solutions')
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name='community_solutions')
    content = models.TextField()
    upvotes = models.IntegerField(default=0)
    views = models.IntegerField(default=0)
    is_ai_generated = models.BooleanField(default=False)
    ai_score = models.FloatField(null=True, blank=True)
    ai_verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Solution by {self.user.username} for Q{self.question.id}"

    class Meta:
        indexes = [
            models.Index(fields=['question', 'created_at'], name='solution_question_date_idx'),
            models.Index(fields=['user', 'created_at'], name='solution_author_date_idx'),
        ]

class SolutionUpvote(models.Model):
    solution = models.ForeignKey(
        Solution,
        on_delete=models.CASCADE,
        related_name='upvote_records'
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='solution_upvotes'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [['solution', 'user']]
        indexes = [
            models.Index(fields=['solution', 'user'])
        ]


class Comment(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='comments')
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name='community_comments', null=True, blank=True)
    solution = models.ForeignKey(Solution, on_delete=models.CASCADE, related_name='comments', null=True, blank=True)
    parent = models.ForeignKey('self', on_delete=models.CASCADE, related_name='replies', null=True, blank=True)
    text = models.TextField()
    upvotes = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Comment by {self.user.username}"

    class Meta:
        ordering = ['-created_at']

class CommentUpvote(models.Model):
    comment = models.ForeignKey(
        Comment,
        on_delete=models.CASCADE,
        related_name='upvote_records'
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='comment_upvotes'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [['comment', 'user']]
        indexes = [
            models.Index(fields=['comment', 'user'])
        ]


class Notification(models.Model):
    TYPES = [
        ('REPLY', 'Reply to comment'),
        ('UPVOTE', 'Solution upvoted'),
        ('REWARD', 'XP Reward'),
        ('BADGE', 'Badge Earned'),
        ('SYSTEM', 'System notification'),
    ]
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    type = models.CharField(max_length=20, choices=TYPES)
    title = models.CharField(max_length=200)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Notification for {self.user.username}: {self.title}"

    class Meta:
        ordering = ['-created_at']


from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from cache import (
    invalidate_user_profile, 
    invalidate_user_dashboard, 
    invalidate_leaderboard
)

@receiver([post_save, post_delete], sender=Profile)
def invalidate_community_caches(sender, instance, **kwargs):
    # Triggers on UserProfile saves
    invalidate_user_profile(instance.user_id)
    invalidate_user_dashboard(instance.user_id)
    
    # Check if community_rank was updated
    update_fields = kwargs.get('update_fields')
    if update_fields is None or 'community_rank' in update_fields:
        invalidate_leaderboard()


from quiz.models import SubCategory

class UserSettings(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='settings')
    
    # Exam Preferences
    primary_exam = models.ForeignKey(SubCategory, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    secondary_exams = models.ManyToManyField(SubCategory, blank=True)
    preferred_language = models.CharField(max_length=10, choices=[('en', 'English'), ('hi', 'Hindi'), ('bi', 'Bilingual')], default='en')
    daily_study_goal = models.IntegerField(default=60) # Minutes
    
    # Notifications
    notify_exam_results = models.BooleanField(default=True)
    notify_roadmap_updates = models.BooleanField(default=True)
    notify_contributor_activity = models.BooleanField(default=True)
    notify_weekly_report = models.BooleanField(default=True)
    notify_new_resources = models.BooleanField(default=True)
    
    # Appearance
    theme = models.CharField(max_length=10, choices=[('light', 'Light'), ('dark', 'Dark'), ('system', 'System')], default='system')
    
    # Contributor Preferences
    is_public_profile = models.BooleanField(default=True)
    show_xp = models.BooleanField(default=True)
    show_streak = models.BooleanField(default=True)
    show_rank = models.BooleanField(default=True)
    show_contribution_activity = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.user.username}'s Settings"

