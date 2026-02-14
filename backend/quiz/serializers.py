
from rest_framework import serializers
from .models import Exam, Question, Answer, UserAnswer, Category, SubCategory, ContactMessage


# --------------------------------------------------
# CATEGORY & SUBCATEGORY SERIALIZERS
# --------------------------------------------------
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


# --------------------------------------------------
# ANSWER SERIALIZERS
# --------------------------------------------------
class AnswerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Answer
        fields = ['id', 'answer_text', 'order']
        read_only_fields = ['id']


class AnswerSerializerWithCorrect(serializers.ModelSerializer):
    class Meta:
        model = Answer
        fields = ['id', 'answer_text', 'is_correct', 'order']
        read_only_fields = ['id']


# --------------------------------------------------
# QUESTION SERIALIZER (WITH IMAGE SUPPORT)
# --------------------------------------------------
class QuestionSerializer(serializers.ModelSerializer):
    answers = serializers.SerializerMethodField()
    image = serializers.SerializerMethodField()

    class Meta:
        model = Question
        fields = [
            'id',
            'question_text',
            'question_type',
            'order',
            'points',
            'subject',    
            'topic',      
            'difficulty', 
            'explanation', 
            'image',      
            'answers'
        ]
        read_only_fields = ['id']

    def get_answers(self, obj):
        hide_correct = self.context.get('hide_correct', False)
        answers = obj.answers.all()
        if hide_correct:
            return AnswerSerializer(answers, many=True).data
        return AnswerSerializerWithCorrect(answers, many=True).data

    def get_image(self, obj):
        request = self.context.get('request')
        if hasattr(obj, 'image') and obj.image and request:
            return request.build_absolute_uri(obj.image.url)
        return None


# --------------------------------------------------
# EXAM SERIALIZER
# --------------------------------------------------
class ExamSerializer(serializers.ModelSerializer):
    question_count = serializers.IntegerField(read_only=True)
    subcategory_name = serializers.CharField(source='subcategory.name', read_only=True)
    category_name = serializers.CharField(source='subcategory.category.name', read_only=True)
    category_slug = serializers.CharField(source='subcategory.category.slug', read_only=True)

    class Meta:
        model = Exam
        fields = [
            'id',
            'title',
            'description',
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
            'total_marks',
            'question_count',
            'created_at',
            'is_active'
        ]
        read_only_fields = ['id', 'created_at']


# --------------------------------------------------
# USER ANSWER SERIALIZER
# --------------------------------------------------
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

# --------------------------------------------------
# EXAM RESULT SERIALIZER (FIXED)
# --------------------------------------------------
class ExamResultSerializer(serializers.Serializer):
    exam_id = serializers.IntegerField()
    exam_title = serializers.CharField()
    session_id = serializers.CharField()
    total_questions = serializers.IntegerField()
    answered_questions = serializers.IntegerField()
    correct_answers = serializers.IntegerField()
    total_points = serializers.IntegerField()
    max_points = serializers.IntegerField()
    percentage = serializers.FloatField()

    answers = UserAnswerSerializer(many=True, required=False)


# --------------------------------------------------
# AUTH SERIALIZERS
# --------------------------------------------------
from django.contrib.auth.models import User

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'date_joined']

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    email = serializers.EmailField(required=True)

    class Meta:
        model = User
        fields = ['username', 'email', 'password']

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password']
        )
        return user


class ContactMessageSerializer(serializers.ModelSerializer):
    """Serializer for contact form messages"""
    class Meta:
        model = ContactMessage
        fields = ['id', 'name', 'email', 'message', 'status', 'created_at']
        read_only_fields = ['id', 'created_at', 'status']