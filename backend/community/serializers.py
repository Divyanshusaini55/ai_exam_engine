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
    exam_slug = serializers.CharField(source='question.exam.slug', read_only=True)
    exam_title = serializers.CharField(source='question.exam.title', read_only=True)
    has_upvoted = serializers.SerializerMethodField()
    
    class Meta:
        model = Comment
        fields = ['id', 'user', 'username', 'question', 'exam_id', 'exam_slug', 'exam_title', 'solution', 'parent', 'text', 'upvotes', 'has_upvoted', 'created_at']
        read_only_fields = ['user']

    def get_has_upvoted(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.upvote_records.filter(user=request.user).exists()
        return False

class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ['id', 'type', 'title', 'message', 'is_read', 'created_at']
