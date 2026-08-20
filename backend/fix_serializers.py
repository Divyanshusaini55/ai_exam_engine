import re

with open('quiz/serializers.py', 'r') as f:
    content = f.read()

# 1. Imports removal
content = re.sub(r'Exam, Question, Answer, UserAnswer,', 'Exam, Question, UserAnswer,', content)

# 2. Remove AnswerSerializer and AnswerSerializerWithCorrect
content = re.sub(r'class AnswerSerializer\(serializers\.ModelSerializer\):.*?return data\n\n\n', '', content, flags=re.DOTALL)
content = re.sub(r'class AnswerSerializerWithCorrect\(serializers\.ModelSerializer\):.*?return data\n\n\n', '', content, flags=re.DOTALL)

# 3. Rewrite QuestionSerializer
question_serializer_new = """class QuestionSerializer(serializers.ModelSerializer):
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
        return len(obj.community_comments.all())
        
    def get_question_text(self, obj):
        payload = obj.schema_payload or {}
        return payload.get('question_text', '')
        
    def get_explanation(self, obj):
        payload = obj.schema_payload or {}
        return payload.get('explanation', '')
        
    def get_subject(self, obj):
        payload = obj.schema_payload or {}
        return payload.get('subject', '')
        
    def get_difficulty(self, obj):
        payload = obj.schema_payload or {}
        return payload.get('difficulty', 'medium')
        
    def get_marks(self, obj):
        payload = obj.schema_payload or {}
        return payload.get('marks', 1)

    def get_answers(self, obj):
        hide_correct = self.context.get('hide_correct', False)
        lang = self.context.get('lang', 'en')
        if not lang and self.context.get('request'):
            lang = self.context.get('request').query_params.get('lang', 'en')
            
        payload = obj.schema_payload or {}
        options = payload.get('options', [])
        
        results = []
        for idx, opt in enumerate(options):
            # Fallback to English if translation is missing, otherwise use Hindi
            answer_text = opt.get('answer_text', '')
            if lang == 'hi' and opt.get('answer_text_hi'):
                answer_text = opt.get('answer_text_hi')
                
            ans_dict = {
                'id': str(idx),
                'answer_text': answer_text,
                'order': idx,
            }
            if not hide_correct:
                ans_dict['is_correct'] = opt.get('is_correct', False)
                ans_dict['answer_text_hi'] = opt.get('answer_text_hi', '')
            results.append(ans_dict)
            
        return results

    def get_image(self, obj):
        request = self.context.get('request')
        # In V2, images are via QuestionImage model.
        img = obj.images.first()
        if img and img.image_file and request:
            return request.build_absolute_uri(img.image_file.url)
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
            
        if lang == 'hi':
            payload = instance.schema_payload or {}
            if payload.get('question_text_hi'):
                data['question_text'] = payload.get('question_text_hi')
            if payload.get('explanation_hi'):
                data['explanation'] = payload.get('explanation_hi')
        
        # Admin expects hi translations to be present always in form
        payload = instance.schema_payload or {}
        data['question_text_hi'] = payload.get('question_text_hi', '')
        data['explanation_hi'] = payload.get('explanation_hi', '')
        
        return data
"""

content = re.sub(r'class QuestionSerializer\(serializers\.ModelSerializer\):.*?return data\n', question_serializer_new, content, flags=re.DOTALL)

with open('quiz/serializers.py', 'w') as f:
    f.write(content)
