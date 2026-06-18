
from rest_framework import serializers
from .models import (
    Exam, Question, Answer, UserAnswer, Category, SubCategory,
    ContactMessage, QuestionPaperUpload, CorrectionSuggestion, CurrentAffair,
    ResourceTag, TopicResource, ResourceProgress, ResourceBookmark,
)


class CategorySerializer(serializers.ModelSerializer):
    exam_count = serializers.SerializerMethodField()
    subcategory_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Category
        fields = ['id', 'slug', 'name', 'description', 'icon', 'icon_color', 
                  'bg_color', 'order', 'is_active', 'exam_count', 'subcategory_count', 'created_at']
    
    def get_exam_count(self, obj):
        return Exam.objects.filter(subcategory__category=obj, status='published', is_active=True).count()
    
    def get_subcategory_count(self, obj):
        return obj.subcategories.filter(is_active=True).count()


class SubCategorySerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    category_slug = serializers.CharField(source='category.slug', read_only=True)
    exam_count = serializers.SerializerMethodField()
    
    class Meta:
        model = SubCategory
        fields = ['id', 'slug', 'name', 'description', 'icon', 'order', 
                  'is_active', 'category', 'category_name', 'category_slug', 'exam_count', 'created_at']
    
    def get_exam_count(self, obj):
        return obj.exams.filter(status='published', is_active=True).count()


class AnswerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Answer
        fields = ['id', 'answer_text', 'order']
        read_only_fields = ['id']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        lang = self.context.get('lang')
        if not lang:
            request = self.context.get('request')
            if request:
                lang = request.query_params.get('lang', 'en')
        if not lang:
            lang = 'en'
            
        if lang != 'en':
            translation = instance.translations.filter(language=lang).first()
            if translation:
                data['answer_text'] = translation.answer_text
        return data


class AnswerSerializerWithCorrect(serializers.ModelSerializer):
    class Meta:
        model = Answer
        fields = ['id', 'answer_text', 'is_correct', 'order']
        read_only_fields = ['id']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        lang = self.context.get('lang')
        if not lang:
            request = self.context.get('request')
            if request:
                lang = request.query_params.get('lang', 'en')
        if not lang:
            lang = 'en'
            
        if lang != 'en':
            translation = instance.translations.filter(language=lang).first()
            if translation:
                data['answer_text'] = translation.answer_text
        return data


class QuestionSerializer(serializers.ModelSerializer):
    answers = serializers.SerializerMethodField()
    image = serializers.SerializerMethodField()
    comment_count = serializers.SerializerMethodField()

    class Meta:
        model = Question
        fields = [
            'id',
            'question_text',
            'question_type',
            'order',
            'marks',
            'subject',    
            'topic',      
            'difficulty', 
            'explanation', 
            'image',      
            'answers',
            'comment_count'
        ]
        read_only_fields = ['id']

    def get_comment_count(self, obj):
        return obj.community_comments.count()

    def get_answers(self, obj):
        hide_correct = self.context.get('hide_correct', False)
        answers = obj.answers.all()
        if hide_correct:
            return AnswerSerializer(answers, many=True, context=self.context).data
        return AnswerSerializerWithCorrect(answers, many=True, context=self.context).data

    def get_image(self, obj):
        request = self.context.get('request')
        if hasattr(obj, 'image') and obj.image and request:
            return request.build_absolute_uri(obj.image.url)
        return None

    def to_representation(self, instance):
        data = super().to_representation(instance)
        lang = self.context.get('lang')
        if not lang:
            request = self.context.get('request')
            if request:
                lang = request.query_params.get('lang', 'en')
        if not lang:
            lang = 'en'
            
        data['language'] = lang
        if lang != 'en':
            translation = instance.translations.filter(language=lang).first()
            if translation:
                data['question_text'] = translation.question_text
                if translation.explanation:
                    data['explanation'] = translation.explanation
        return data


class ExamSerializer(serializers.ModelSerializer):
    question_count = serializers.IntegerField(read_only=True)
    subcategory_name = serializers.CharField(source='subcategory.name', read_only=True)
    category_name = serializers.CharField(source='subcategory.category.name', read_only=True)
    category_slug = serializers.CharField(source='subcategory.category.slug', read_only=True)

    class Meta:
        model = Exam
        fields = [
            'id',
            'slug',
            'title',
            'description',
            'ai_summary',
            'subcategory',
            'subcategory_name',
            'category_name',
            'category_slug',
            'year',
            'shift',
            'status',
            'duration_minutes',
            'total_questions',
            'marks_per_question',
            'negative_marks',
            'total_marks',
            'question_count',
            'supported_languages',
            'created_at',
            'is_active'
        ]
        read_only_fields = ['id', 'slug', 'created_at']


class UserAnswerSerializer(serializers.ModelSerializer):
    question_text = serializers.CharField(
        source='question.question_text',
        read_only=True
    )
    selected_answer_text = serializers.CharField(
        source='selected_answer.answer_text',
        read_only=True
    )
    
    # Field definitions
    correct_answer_text = serializers.SerializerMethodField()
    explanation = serializers.CharField(source='question.explanation', read_only=True)

    class Meta:
        model = UserAnswer
        fields = [
            'id',
            'question',
            'question_text',
            'selected_answer',
            'selected_answer_text',
            'correct_answer_text', 
            'explanation',         
            'text_answer',
            'is_correct',
            'answered_at'
        ]
        read_only_fields = ['id', 'answered_at']

    def get_correct_answer_text(self, obj):
        correct_ans = obj.question.answers.filter(is_correct=True).first()
        return correct_ans.answer_text if correct_ans else "Unknown"

class ExamResultSerializer(serializers.Serializer):
    exam_id = serializers.IntegerField()
    exam_title = serializers.CharField()
    session_id = serializers.CharField()
    total_questions = serializers.IntegerField()
    answered_questions = serializers.IntegerField()
    correct_answers = serializers.IntegerField()
    total_marks = serializers.FloatField()
    max_marks = serializers.FloatField()
    percentage = serializers.FloatField()
    penalty = serializers.FloatField(required=False)
    wrong_answers = serializers.IntegerField(required=False)

    answers = UserAnswerSerializer(many=True, required=False)

from django.contrib.auth.models import User

class UserSerializer(serializers.ModelSerializer):
    avatar_image = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'date_joined', 'avatar_image']

    def get_avatar_image(self, obj):
        request = self.context.get('request')
        if hasattr(obj, 'profile') and obj.profile and obj.profile.avatar_image:
            if request:
                return request.build_absolute_uri(obj.profile.avatar_image.url)
            return obj.profile.avatar_image.url
        return None

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    email = serializers.EmailField(required=True)

    class Meta:
        model = User
        fields = ['username', 'email', 'password']

    def validate_password(self, value):
        from django.contrib.auth.password_validation import validate_password
        import re
        
        # Explicit complexity checks
        if len(value) < 8:
            raise serializers.ValidationError("Password must be at least 8 characters long.")
        if not re.search(r'\d', value):
            raise serializers.ValidationError("Password must contain at least one number.")
        if not re.search(r'[a-zA-Z]', value):
            raise serializers.ValidationError("Password must contain at least one letter.")
            
        # Apply Django's built-in validators
        validate_password(value)
        return value

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password']
        )
        return user


class ContactMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContactMessage
        fields = ['id', 'name', 'email', 'message', 'status', 'created_at']
        read_only_fields = ['id', 'created_at', 'status']
class QuestionPaperUploadSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True)

    class Meta:
        model = QuestionPaperUpload
        fields = ['id', 'user', 'username', 'category', 'category_name', 'subject', 'exam_date', 'file', 'status', 'created_at']
        read_only_fields = ['id', 'user', 'status', 'created_at']

class CorrectionSuggestionSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    
    class Meta:
        model = CorrectionSuggestion
        fields = ['id', 'user', 'username', 'question', 'type', 'suggestion_data', 'note', 'status', 'upvotes', 'created_at']
        read_only_fields = ['user', 'status', 'upvotes', 'created_at']

class CurrentAffairSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    
    class Meta:
        model = CurrentAffair
        fields = ['id', 'title', 'slug', 'content', 'summary', 'category', 'category_name', 'image_url', 'source_name', 'source_url', 'published_date', 'created_at']


from .models import ExamRoadmap, RoadmapPhase, RoadmapTopic, UserTopicProgress
class ResourceTagSerializer(serializers.ModelSerializer):
    class Meta:
        model = ResourceTag
        fields = ['id', 'name', 'slug', 'color']


class TopicResourceSerializer(serializers.ModelSerializer):
    tags = ResourceTagSerializer(many=True, read_only=True)
    is_bookmarked = serializers.SerializerMethodField()
    is_completed = serializers.SerializerMethodField()
    resource_type_display = serializers.CharField(source='get_resource_type_display', read_only=True)
    difficulty_display = serializers.CharField(source='get_difficulty_display', read_only=True)
    content_format_display = serializers.CharField(source='get_content_format_display', read_only=True)
    thumbnail_url = serializers.SerializerMethodField()

    class Meta:
        model = TopicResource
        fields = [
            'id',
            'topic',
            'title',
            'slug',
            'short_description',
            'resource_type',
            'resource_type_display',
            'content_format',
            'content_format_display',
            'markdown_content',
            'html_content',
            'latex_content',
            'external_url',
            'thumbnail_url',
            'estimated_read_minutes',
            'difficulty',
            'difficulty_display',
            'order',
            'is_featured',
            'is_published',
            'is_ai_generated',
            'ai_summary',
            'is_bookmarked',
            'is_completed',
            'view_count',
            'tags',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'slug', 'view_count', 'created_at', 'updated_at']

    def get_is_bookmarked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return ResourceBookmark.objects.filter(user=request.user, resource=obj).exists()
        return False

    def get_is_completed(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            progress = ResourceProgress.objects.filter(user=request.user, resource=obj).first()
            return progress.is_completed if progress else False
        return False

    def get_thumbnail_url(self, obj):
        request = self.context.get('request')
        if obj.thumbnail and request:
            return request.build_absolute_uri(obj.thumbnail.url)
        return None


class TopicResourceListSerializer(serializers.ModelSerializer):
    tags = ResourceTagSerializer(many=True, read_only=True)
    is_bookmarked = serializers.SerializerMethodField()
    is_completed = serializers.SerializerMethodField()
    resource_type_display = serializers.CharField(source='get_resource_type_display', read_only=True)
    difficulty_display = serializers.CharField(source='get_difficulty_display', read_only=True)
    thumbnail_url = serializers.SerializerMethodField()

    class Meta:
        model = TopicResource
        fields = [
            'id', 'topic', 'title', 'slug', 'short_description',
            'resource_type', 'resource_type_display',
            'content_format', 'difficulty', 'difficulty_display',
            'external_url', 'thumbnail_url',
            'estimated_read_minutes', 'order',
            'is_featured', 'is_published', 'is_ai_generated',
            'ai_summary', 'is_bookmarked', 'is_completed',
            'view_count', 'tags', 'created_at',
        ]

    def get_is_bookmarked(self, obj):
        if hasattr(obj, 'prefetched_bookmarks'):
            return len(obj.prefetched_bookmarks) > 0
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return ResourceBookmark.objects.filter(user=request.user, resource=obj).exists()
        return False

    def get_is_completed(self, obj):
        if hasattr(obj, 'prefetched_progress'):
            progress = obj.prefetched_progress[0] if obj.prefetched_progress else None
            return progress.is_completed if progress else False
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            progress = ResourceProgress.objects.filter(user=request.user, resource=obj).first()
            return progress.is_completed if progress else False
        return False

    def get_thumbnail_url(self, obj):
        request = self.context.get('request')
        if obj.thumbnail and request:
            return request.build_absolute_uri(obj.thumbnail.url)
        return None

class RoadmapTopicSerializer(serializers.ModelSerializer):
    status = serializers.SerializerMethodField()
    topic_resources = serializers.SerializerMethodField()
    prerequisites = serializers.SerializerMethodField()

    class Meta:
        model = RoadmapTopic
        fields = ['id', 'title', 'description', 'estimated_minutes', 'order', 'status', 'resources', 'topic_resources', 'prerequisites']

    def get_status(self, obj):
        if hasattr(obj, 'prefetched_user_progress'):
            progress = obj.prefetched_user_progress[0] if obj.prefetched_user_progress else None
            if progress:
                return progress.status
        else:
            user = self.context.get('request').user if self.context.get('request') else None
            if user and user.is_authenticated:
                progress = UserTopicProgress.objects.filter(user=user, topic=obj).first()
                if progress:
                    return progress.status
        return 'pending'

    def get_topic_resources(self, obj):
        if hasattr(obj, 'published_resources'):
            qs = obj.published_resources
        else:
            qs = obj.topic_resources.filter(is_published=True).order_by('order', 'created_at')
        return TopicResourceListSerializer(qs, many=True, context=self.context).data

    def get_prerequisites(self, obj):
        return [{'id': p.id, 'title': p.title} for p in obj.prerequisites.all()]

class RoadmapPhaseSerializer(serializers.ModelSerializer):
    topics = RoadmapTopicSerializer(many=True, read_only=True)

    class Meta:
        model = RoadmapPhase
        fields = ['id', 'title', 'description', 'order', 'topics']

class ExamRoadmapSerializer(serializers.ModelSerializer):
    phases = RoadmapPhaseSerializer(many=True, read_only=True)
    subcategory_name = serializers.CharField(source='subcategory.name', read_only=True)
    is_bookmarked = serializers.SerializerMethodField()

    class Meta:
        model = ExamRoadmap
        fields = ['id', 'subcategory', 'subcategory_name', 'title', 'description', 'phases', 'is_bookmarked', 'created_at', 'updated_at']

    def get_is_bookmarked(self, obj):
        user = self.context.get('request').user if self.context.get('request') else None
        if user and user.is_authenticated:
            return obj.bookmarks.filter(id=user.id).exists()
        return False

class BookmarkedRoadmapSerializer(serializers.ModelSerializer):
    subcategory_name = serializers.CharField(source='subcategory.name', read_only=True)
    subcategory_slug = serializers.CharField(source='subcategory.slug', read_only=True)
    subcategory_icon = serializers.CharField(source='subcategory.icon', read_only=True)

    class Meta:
        model = ExamRoadmap
        fields = ['id', 'title', 'description', 'subcategory_name', 'subcategory_slug', 'subcategory_icon']
