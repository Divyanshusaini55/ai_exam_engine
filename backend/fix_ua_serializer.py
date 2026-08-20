import re

with open('quiz/serializers.py', 'r') as f:
    content = f.read()

# Replace UserAnswerSerializer
old_ua_serializer = """class UserAnswerSerializer(serializers.ModelSerializer):
    question = QuestionSerializer(read_only=True)
    selected_answer_text = serializers.CharField(
        source='selected_answer.answer_text',
        read_only=True
    )
    
    class Meta:
        model = UserAnswer
        fields = [
            'id', 
            'question',
            'selected_answer',
            'selected_answer_text',
            'text_answer',
            'is_correct',
            'is_flagged_for_review',
            'is_bookmarked',
            'answered_at'
        ]"""

new_ua_serializer = """class UserAnswerSerializer(serializers.ModelSerializer):
    question = QuestionSerializer(read_only=True)
    
    class Meta:
        model = UserAnswer
        fields = [
            'id', 
            'question',
            'selected_options',
            'answer_payload',
            'is_correct',
            'is_flagged_for_review',
            'is_bookmarked',
            'answered_at'
        ]"""

content = content.replace(old_ua_serializer, new_ua_serializer)

with open('quiz/serializers.py', 'w') as f:
    f.write(content)
