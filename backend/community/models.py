from django.db import models
from django.contrib.auth.models import User
from quiz.models import Question


class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    avatar_char = models.CharField(max_length=1, blank=True)
    bio = models.TextField(blank=True)
    full_name = models.CharField(max_length=200, blank=True)
    show_profile_pic = models.BooleanField(default=True)

    # --- Gamification ---
    xp = models.IntegerField(default=0)
    streak = models.IntegerField(default=0)
    best_streak = models.IntegerField(default=0)
    last_activity = models.DateField(null=True, blank=True)

    # --- Denormalized counters (updated via signals, O(1) reads) ---
    total_solutions = models.IntegerField(default=0)
    total_comments = models.IntegerField(default=0)
    total_upvotes_received = models.IntegerField(default=0)
    total_views = models.IntegerField(default=0)
    uploads_approved = models.IntegerField(default=0)
    suggestions_approved = models.IntegerField(default=0)
    ai_verified_count = models.IntegerField(default=0)

    # --- Computed scores (updated via services) ---
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
    slug = models.SlugField(unique=True)
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


