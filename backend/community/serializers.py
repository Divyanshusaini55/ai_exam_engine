from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Profile, Solution, Comment, Notification

class ProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    email = serializers.CharField(source='user.email', read_only=True)
    
    class Meta:
        model = Profile
        fields = ['username', 'email', 'avatar_char', 'xp', 'streak', 'best_streak', 'show_profile_pic', 'bio']

class SolutionSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    
    class Meta:
        model = Solution
        fields = ['id', 'username', 'question', 'content', 'upvotes', 'views', 'is_ai_generated', 'created_at']

class CommentSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    exam_id = serializers.IntegerField(source='question.exam.id', read_only=True)
    exam_title = serializers.CharField(source='question.exam.title', read_only=True)
    
    class Meta:
        model = Comment
        fields = ['id', 'user', 'username', 'question', 'exam_id', 'exam_title', 'solution', 'parent', 'text', 'upvotes', 'created_at']
        read_only_fields = ['user']

class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ['id', 'type', 'title', 'message', 'is_read', 'created_at']
