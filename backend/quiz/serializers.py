
from pathlib import Path
from django.conf import settings
from rest_framework import serializers
from .models import (
    Exam, Question, UserAnswer, Category, SubCategory, Topic,
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


class TopicSerializer(serializers.ModelSerializer):
    subcategory_name = serializers.CharField(source='subcategory.name', read_only=True)
    subcategory_slug = serializers.CharField(source='subcategory.slug', read_only=True)
    exam_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Topic
        fields = ['id', 'slug', 'name', 'description', 'icon', 'order', 
                  'is_active', 'subcategory', 'subcategory_name', 'subcategory_slug', 'exam_count', 'created_at']
    
    def get_exam_count(self, obj):
        return obj.exams.filter(status='published', is_active=True).count()


class QuestionSerializer(serializers.ModelSerializer):
    answers = serializers.SerializerMethodField()
    image = serializers.SerializerMethodField()
    comment_count = serializers.SerializerMethodField()
    
    question_text = serializers.SerializerMethodField()
    explanation = serializers.SerializerMethodField()
    subject = serializers.SerializerMethodField()
    difficulty = serializers.SerializerMethodField()
    marks = serializers.SerializerMethodField()

    class Meta:
        model = Question
        fields = [
            'id',
            'question_text',
            'question_type',
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
        all_comments = getattr(obj, '_prefetched_objects_cache', {}).get('community_comments')
        if all_comments is not None:
            return len(all_comments)
        return obj.community_comments.count()
        
    def get_question_text(self, obj):
        lang = self.context.get('lang', 'en')
        payload = obj.schema_payload or {}
        if lang == 'hi':
            if payload.get('question_text_hi'):
                return payload.get('question_text_hi')
            if isinstance(payload.get('content'), dict) and payload['content'].get('text_hi'):
                return payload['content'].get('text_hi')
        if 'question_text' in payload:
            return payload.get('question_text', '')
        if isinstance(payload.get('content'), dict):
            return payload['content'].get('text', '')
        return ""
        
    def get_explanation(self, obj):
        payload = obj.schema_payload or {}
        exp = payload.get('explanation')
        if isinstance(exp, str):
            return exp
        if isinstance(exp, dict):
            return exp.get('text', '')
        return ""
        
    def get_subject(self, obj):
        payload = obj.schema_payload or {}
        if 'subject' in payload:
            return payload.get('subject', '')
        if isinstance(payload.get('classification'), dict):
            return payload['classification'].get('subject', '')
        return ""
        
    def get_difficulty(self, obj):
        payload = obj.schema_payload or {}
        if 'difficulty' in payload:
            return payload.get('difficulty', 'medium')
        if isinstance(payload.get('classification'), dict):
            return payload['classification'].get('difficulty_label', 'medium')
        return "medium"
        
    def get_marks(self, obj):
        payload = obj.schema_payload or {}
        if 'marks' in payload:
            return payload.get('marks', 1)
        if isinstance(payload.get('marking'), dict):
            return payload['marking'].get('positive', 1)
        return 1

    def get_answers(self, obj):
        hide_correct = self.context.get('hide_correct', False)
        lang = self.context.get('lang', 'en')
        if not lang and self.context.get('request'):
            lang = self.context.get('request').query_params.get('lang', 'en')
            
        payload = obj.schema_payload or {}
        options = payload.get('options', [])
        if options is None:
            return []
            
        correct_options = (payload.get('answer') or {}).get('correct_options', [])
        
        results = []
        for idx, opt in enumerate(options):
            if isinstance(opt, dict):
                answer_text = opt.get('answer_text') or opt.get('text', '')
                if answer_text is None:
                    answer_text = ""
                if lang == 'hi' and (opt.get('answer_text_hi') or opt.get('text_hi')):
                    answer_text = opt.get('answer_text_hi') or opt.get('text_hi')
                    
                is_correct = opt.get('is_correct', False) or (opt.get('id') in correct_options) or (chr(65 + idx) in correct_options)
                
                ans_dict = {
                    'id': str(idx),
                    'option_label': opt.get('id', chr(65 + idx)),
                    'answer_text': answer_text,
                    'answer_text_hi': opt.get('answer_text_hi') or opt.get('text_hi') or '',
                    'image_url': self._resolve_image_url(opt.get('image_url'), obj),
                    'order': idx,
                }
                if not hide_correct:
                    ans_dict['is_correct'] = is_correct
                results.append(ans_dict)
            else:
                results.append({
                    'id': str(idx),
                    'option_label': chr(65 + idx),
                    'answer_text': str(opt),
                    'answer_text_hi': '',
                    'image_url': None,
                    'order': idx,
                    **({} if hide_correct else {'is_correct': (idx == 0)})
                })
            
        return results

    def _resolve_image_url(self, url: str | None, obj=None) -> str | None:
        if not url or not isinstance(url, str):
            return None
        url = url.strip()
        if not url:
            return None
        if url.startswith("http://") or url.startswith("https://"):
            return url

        clean_subpath = url.lstrip("./").lstrip("/")

        # Determine exam slug
        exam_slug = self.context.get('exam_slug')
        if not exam_slug and obj:
            cached_exam = getattr(obj, '_cached_exam', None)
            if cached_exam:
                exam_slug = getattr(cached_exam, 'slug', None)
            else:
                exams_rel = getattr(obj, 'exams', None)
                if exams_rel:
                    first_exam = exams_rel.first()
                    if first_exam:
                        exam_slug = first_exam.slug

        request = self.context.get('request')
        backend_base = (request.build_absolute_uri('/')[:-1] if request else getattr(settings, 'BACKEND_PUBLIC_URL', 'http://127.0.0.1:8000')).rstrip('/')

        # 1. If local file exists on disk in media/exam_assets/<exam_slug>/<clean_subpath>
        if exam_slug:
            local_disk_path = Path(settings.MEDIA_ROOT) / "exam_assets" / exam_slug / clean_subpath
            if local_disk_path.exists():
                return f"{backend_base}/media/exam_assets/{exam_slug}/{clean_subpath}"

        # 2. Check Cloudflare R2 custom domain
        r2_domain = getattr(settings, 'R2_CUSTOM_DOMAIN', None)
        if r2_domain and ("r2.dev" in r2_domain or "cloudfront" in r2_domain or "cdn" in r2_domain):
            domain = r2_domain.rstrip('/')
            if exam_slug and not clean_subpath.startswith(f"exams/{exam_slug}"):
                return f"{domain}/exams/{exam_slug}/{clean_subpath}"
            return f"{domain}/{clean_subpath}"

        # 3. Fallback to local media URL
        if exam_slug and not clean_subpath.startswith(f"exam_assets/{exam_slug}"):
            return f"{backend_base}/media/exam_assets/{exam_slug}/{clean_subpath}"
        return f"{backend_base}/media/{clean_subpath}"

    def get_image(self, obj):
        # 1. Check schema_payload content.images first (instant in-memory)
        payload = obj.schema_payload or {}
        images_dict = (payload.get('content') or {}).get('images', {})
        if images_dict and isinstance(images_dict, dict):
            first_img = next(iter(images_dict.values()), None)
            if isinstance(first_img, dict) and first_img.get('url'):
                return self._resolve_image_url(first_img.get('url'), obj)
            elif isinstance(first_img, str):
                return self._resolve_image_url(first_img, obj)

        # 2. Check prefetched QuestionImage model
        request = self.context.get('request')
        all_imgs = getattr(obj, '_prefetched_objects_cache', {}).get('images')
        if all_imgs is not None:
            img = all_imgs[0] if len(all_imgs) > 0 else None
        else:
            img = obj.images.first()
        if img and img.image_file:
            raw_url = request.build_absolute_uri(img.image_file.url) if request else img.image_file.url
            return self._resolve_image_url(raw_url, obj)
        return None

    def to_representation(self, instance):
        data = super().to_representation(instance)
        hide_correct = self.context.get('hide_correct', False)
        lang = self.context.get('lang')
        if not lang:
            request = self.context.get('request')
            if request:
                lang = request.query_params.get('lang', 'en')
        if not lang:
            lang = 'en'
            
        payload = instance.schema_payload or {}
        if lang == 'hi':
            if payload.get('question_text_hi'):
                data['question_text'] = payload.get('question_text_hi')
            if payload.get('explanation_hi'):
                data['explanation'] = payload.get('explanation_hi')
        
        # Expose rich V2 properties
        data['schema_version'] = instance.schema_version
        data['passage_id'] = payload.get('passage_id')
        data['marking'] = payload.get('marking', {})
        data['classification'] = payload.get('classification', {})
        raw_content_images = (payload.get('content') or {}).get('images', {})
        resolved_content_images = {}
        if isinstance(raw_content_images, dict):
            for k, img_val in raw_content_images.items():
                if isinstance(img_val, dict):
                    resolved_content_images[k] = {
                        **img_val,
                        'url': self._resolve_image_url(img_val.get('url'), instance)
                    }
                elif isinstance(img_val, str):
                    resolved_content_images[k] = self._resolve_image_url(img_val, instance)
        data['content_images'] = resolved_content_images
        data['exam_history'] = payload.get('exam_history', [])
        data['question_text_hi'] = payload.get('question_text_hi', '')
        data['options'] = data.get('answers', [])
        
        # Anti-cheat: strip explanations and tutor hints/steps during exam mode
        if hide_correct:
            data['explanation'] = ""
            data['explanation_hi'] = ""
            data['tutor_data'] = {'hints': [], 'solution_steps': []}
        else:
            data['explanation_hi'] = payload.get('explanation_hi', '')
            data['tutor_data'] = payload.get('tutor_data', {})
        
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
    question_text = serializers.SerializerMethodField()
    question_text_hi = serializers.SerializerMethodField()
    selected_answer = serializers.SerializerMethodField()
    selected_answer_text = serializers.SerializerMethodField()
    correct_answer_text = serializers.SerializerMethodField()
    explanation = serializers.SerializerMethodField()
    explanation_hi = serializers.SerializerMethodField()
    tutor_data = serializers.SerializerMethodField()

    class Meta:
        model = UserAnswer
        fields = [
            'id',
            'question',
            'question_text',
            'question_text_hi',
            'selected_answer',
            'selected_options',
            'answer_payload',
            'selected_answer_text',
            'correct_answer_text',
            'explanation',
            'explanation_hi',
            'tutor_data',
            'is_correct',
            'is_flagged_for_review',
            'is_bookmarked',
            'answered_at'
        ]
        read_only_fields = ['id', 'answered_at']

    def get_question_text(self, obj):
        if not obj.question:
            return ""
        payload = obj.question.schema_payload or {}
        lang = self.context.get('lang', 'en')
        if not lang and self.context.get('request'):
            lang = self.context.get('request').query_params.get('lang', 'en')
            
        if lang == 'hi' and payload.get('question_text_hi'):
            return payload.get('question_text_hi')
        if 'question_text' in payload:
            return payload.get('question_text', '')
        if isinstance(payload.get('content'), dict):
            return payload['content'].get('text', '')
        return ""

    def get_question_text_hi(self, obj):
        if not obj.question:
            return ""
        payload = obj.question.schema_payload or {}
        return payload.get('question_text_hi', '')

    def get_selected_answer(self, obj):
        if obj.selected_options and len(obj.selected_options) > 0:
            return obj.selected_options[0]
        return None

    def get_selected_answer_text(self, obj):
        if not obj.question:
            return ""
        payload = obj.question.schema_payload or {}
        # Check text_answer from answer_payload (for NAT/Subjective)
        if obj.answer_payload and obj.answer_payload.get('text_answer'):
            return str(obj.answer_payload.get('text_answer'))
            
        if not obj.selected_options:
            return ""
            
        options = payload.get('options', [])
        lang = self.context.get('lang', 'en')
        if not lang and self.context.get('request'):
            lang = self.context.get('request').query_params.get('lang', 'en')

        selected_texts = []
        for idx in obj.selected_options:
            try:
                int_idx = int(idx)
                if 0 <= int_idx < len(options):
                    opt = options[int_idx]
                    if isinstance(opt, dict):
                        txt = opt.get('answer_text_hi') if lang == 'hi' and opt.get('answer_text_hi') else (opt.get('answer_text') or opt.get('text', ''))
                        selected_texts.append(txt)
                    else:
                        selected_texts.append(str(opt))
            except (ValueError, TypeError, IndexError):
                pass
        return ", ".join(selected_texts) if selected_texts else ""

    def get_correct_answer_text(self, obj):
        if not obj.question:
            return ""
        payload = obj.question.schema_payload or {}
        q_type = payload.get('question_type') or obj.question.question_type or 'mcq_single'
        
        lang = self.context.get('lang', 'en')
        if not lang and self.context.get('request'):
            lang = self.context.get('request').query_params.get('lang', 'en')

        # NAT Numerical
        if q_type == 'nat':
            ans_info = payload.get('answer') or {}
            unit = ans_info.get('unit', '')
            if ans_info.get('min') is not None and ans_info.get('max') is not None:
                return f"{ans_info['min']} - {ans_info['max']} {unit}".strip()
            if ans_info.get('value') is not None:
                return f"{ans_info['value']} {unit}".strip()
            return ""

        # Subjective
        if q_type == 'subjective':
            ans_info = payload.get('answer') or {}
            return ans_info.get('model_answer', '')

        # MCQ Single / Multi
        options = payload.get('options', [])
        correct_options = (payload.get('answer') or {}).get('correct_options', [])
        correct_texts = []
        for idx, opt in enumerate(options):
            if isinstance(opt, dict):
                is_correct = opt.get('is_correct', False) or (opt.get('id') in correct_options) or (chr(65 + idx) in correct_options)
                if is_correct:
                    txt = opt.get('answer_text_hi') if lang == 'hi' and opt.get('answer_text_hi') else (opt.get('answer_text') or opt.get('text', ''))
                    correct_texts.append(txt)
            elif idx == 0:
                correct_texts.append(str(opt))
        return ", ".join(correct_texts) if correct_texts else ""

    def get_explanation(self, obj):
        if not obj.question:
            return ""
        payload = obj.question.schema_payload or {}
        lang = self.context.get('lang', 'en')
        if not lang and self.context.get('request'):
            lang = self.context.get('request').query_params.get('lang', 'en')
            
        if lang == 'hi' and payload.get('explanation_hi'):
            return payload.get('explanation_hi')
        exp = payload.get('explanation')
        if isinstance(exp, str):
            return exp
        if isinstance(exp, dict):
            return exp.get('text', '')
        return ""

    def get_explanation_hi(self, obj):
        if not obj.question:
            return ""
        payload = obj.question.schema_payload or {}
        return payload.get('explanation_hi', '')

    def get_tutor_data(self, obj):
        if not obj.question:
            return {}
        payload = obj.question.schema_payload or {}
        return payload.get('tutor_data', {})

class ExamResultSerializer(serializers.Serializer):
    exam_id = serializers.CharField()
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
    name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'name', 'date_joined', 'avatar_image', 'is_staff', 'is_superuser']

    def get_name(self, obj):
        if hasattr(obj, 'profile') and obj.profile and obj.profile.full_name:
            return obj.profile.full_name
        full_name = obj.get_full_name()
        if full_name and full_name.strip():
            return full_name.strip()
        if obj.first_name:
            return f"{obj.first_name} {obj.last_name}".strip()
        return obj.username

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
