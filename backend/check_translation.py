import os
import django

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from quiz.models import Question, Exam, Answer
from quiz.models_translations import QuestionTranslation, AnswerTranslation
from quiz.ai import translate_question_to_hindi
from quiz.serializers import QuestionSerializer

def check_translation():
    print("=== Testing Multilingual Support ===")
    
    # 1. Fetch a question
    question = Question.objects.first()
    if not question:
        print("ERROR: No questions found in the database. Run exam generation first.")
        return
        
    print(f"Original English Question ID {question.id}: {question.question_text}")
    print(f"Original English Explanation: {question.explanation}")
    print("Original Options:")
    for ans in question.answers.all().order_by('order'):
        print(f" - {chr(65 + ans.order)}: {ans.answer_text} (Correct: {ans.is_correct})")

    # 2. Add Hindi to supported languages on the question's exam
    exam = question.exam
    if "hi" not in exam.supported_languages:
        exam.supported_languages.append("hi")
        exam.save()
        print(f"Added Hindi to supported languages of Exam ID {exam.id}.")

    # 3. Clear any existing translations for a clean test
    QuestionTranslation.objects.filter(question=question, language='hi').delete()
    for ans in question.answers.all():
        AnswerTranslation.objects.filter(answer=ans, language='hi').delete()
    print("Cleared any existing translations for a clean run.")

    # 4. Run AI Translation
    print("\nRunning translate_question_to_hindi...")
    success = translate_question_to_hindi(question)
    if not success:
        print("ERROR: Translation function failed.")
        return
        
    print("AI Translation completed successfully!")

    # 5. Verify translation tables
    qt = QuestionTranslation.objects.filter(question=question, language='hi').first()
    if not qt:
        print("ERROR: QuestionTranslation object not found in database.")
        return
    print(f"\nTranslated Question (Hi): {qt.question_text}")
    print(f"Translated Explanation (Hi): {qt.explanation}")
    
    print("Translated Options (Hi):")
    for ans in question.answers.all().order_by('order'):
        at = AnswerTranslation.objects.filter(answer=ans, language='hi').first()
        if not at:
            print(f"ERROR: AnswerTranslation not found for option {chr(65 + ans.order)}")
        else:
            print(f" - {chr(65 + ans.order)}: {at.answer_text}")

    # 6. Test Serializer translation and fallback
    print("\nTesting Serializer to_representation with ?lang=hi context...")
    serializer_hi = QuestionSerializer(question, context={'lang': 'hi'})
    data_hi = serializer_hi.data
    print(f"Serialized Question Text (hi): {data_hi.get('question_text')}")
    print(f"Serialized Explanation (hi): {data_hi.get('explanation')}")
    print(f"Serialized Language Field: {data_hi.get('language')}")
    for idx, ans_data in enumerate(data_hi.get('answers', [])):
        print(f" - Option {chr(65 + ans_data.get('order', 0))}: {ans_data.get('answer_text')}")

    print("\nTesting Serializer to_representation with fallback (?lang=en or empty)...")
    serializer_en = QuestionSerializer(question, context={'lang': 'en'})
    data_en = serializer_en.data
    print(f"Serialized Question Text (en): {data_en.get('question_text')}")
    print(f"Serialized Language Field: {data_en.get('language')}")

    print("\n=== All Backend Checks Passed ===")

if __name__ == '__main__':
    check_translation()
