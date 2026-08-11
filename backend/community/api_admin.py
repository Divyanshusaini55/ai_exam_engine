from rest_framework import viewsets, serializers
from rest_framework.permissions import IsAdminUser
from .models import Profile, Badge, UserBadge, Solution, Comment, ContributorActivity, Notification
from django.contrib.auth.models import User

# --- Serializers ---

class AdminProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    email = serializers.CharField(source='user.email', read_only=True)
    
    class Meta:
        model = Profile
        fields = '__all__'
        read_only_fields = ['user', 'community_rank', 'percentile', 'reputation_score', 'total_solutions', 'total_comments', 'total_upvotes_received', 'total_views']

class AdminBadgeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Badge
        fields = '__all__'

class AdminUserBadgeSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    badge_name = serializers.CharField(source='badge.name', read_only=True)
    
    class Meta:
        model = UserBadge
        fields = '__all__'

class AdminSolutionSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    question_text = serializers.CharField(source='question.question_text', read_only=True)
    
    class Meta:
        model = Solution
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at', 'upvotes', 'views']

class AdminCommentSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    question_text = serializers.CharField(source='question.question_text', read_only=True)
    
    class Meta:
        model = Comment
        fields = '__all__'
        read_only_fields = ['created_at', 'upvotes']

class AdminContributorActivitySerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = ContributorActivity
        fields = '__all__'

class AdminNotificationSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = Notification
        fields = '__all__'

# --- ViewSets ---

class AdminProfileViewSet(viewsets.ModelViewSet):
    queryset = Profile.objects.all().select_related('user')
    serializer_class = AdminProfileSerializer
    permission_classes = [IsAdminUser]
    pagination_class = None

class AdminBadgeViewSet(viewsets.ModelViewSet):
    queryset = Badge.objects.all()
    serializer_class = AdminBadgeSerializer
    permission_classes = [IsAdminUser]
    pagination_class = None

class AdminUserBadgeViewSet(viewsets.ModelViewSet):
    queryset = UserBadge.objects.all().select_related('user', 'badge')
    serializer_class = AdminUserBadgeSerializer
    permission_classes = [IsAdminUser]
    pagination_class = None

class AdminSolutionViewSet(viewsets.ModelViewSet):
    queryset = Solution.objects.all().select_related('user', 'question').order_by('-created_at')
    serializer_class = AdminSolutionSerializer
    permission_classes = [IsAdminUser]
    pagination_class = None

class AdminCommentViewSet(viewsets.ModelViewSet):
    queryset = Comment.objects.all().select_related('user', 'question').order_by('-created_at')
    serializer_class = AdminCommentSerializer
    permission_classes = [IsAdminUser]
    pagination_class = None

class AdminContributorActivityViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ContributorActivity.objects.all().select_related('user').order_by('-created_at')
    serializer_class = AdminContributorActivitySerializer
    permission_classes = [IsAdminUser]
    pagination_class = None

class AdminNotificationViewSet(viewsets.ModelViewSet):
    queryset = Notification.objects.all().select_related('user').order_by('-created_at')
    serializer_class = AdminNotificationSerializer
    permission_classes = [IsAdminUser]
    pagination_class = None
