import os
import sys
import django
import uuid

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.contrib.auth.models import User
from rest_framework.test import APIClient
from quiz.models import Category, SubCategory, Exam, Question, ExamQuestion, UserAnswer, PracticeSession, ExamAttempt

def run_tests():
    print("========================================")
    print("🧪 RUNNING V2 HYBRID API VERIFICATION TEST")
    print("========================================")

    client = APIClient()

    # 1. Setup Category, SubCategory, and Exam
    category, _ = Category.objects.get_or_create(name="Engineering", slug="engineering")
    subcategory, _ = SubCategory.objects.get_or_create(category=category, name="GATE CS", slug="gate-cs")
    
    exam, _ = Exam.objects.get_or_create(
        slug="test-gate-cs-v2",
        defaults={
            "title": "GATE CS 2024 V2 Test",
            "subcategory": subcategory,
            "duration_minutes": 180,
            "status": "published",
            "marks_per_question": 2.0,
            "negative_marks": 0.66,
            "total_marks": 4.0,
            "total_questions": 2,
            "is_active": True,
        }
    )
    exam.status = "published"
    exam.is_active = True
    exam.negative_marks = 0.66
    exam.marks_per_question = 2.0
    exam.save()

    # Clear old questions
    ExamQuestion.objects.filter(exam=exam).delete()

    # 2. Create V2 Question 1 (Multiple Choice with options & Hindi translation)
    q1 = Question.objects.create(
        id=str(uuid.uuid4())[:8],
        origin="test_script",
        question_type="multiple_choice",
        verified=True,
        schema_payload={
            "question_text": "What is the time complexity of binary search?",
            "explanation": "Binary search divides the search space in half at each step, giving O(log n).",
            "subject": "Algorithms",
            "topic": "Searching",
            "difficulty": "Easy",
            "marks": 2.0,
            "options": [
                {"answer_text": "O(n)", "is_correct": False, "answer_text_hi": "O(n)"},
                {"answer_text": "O(log n)", "is_correct": True, "answer_text_hi": "O(log n)"},
                {"answer_text": "O(n log n)", "is_correct": False, "answer_text_hi": "O(n log n)"},
                {"answer_text": "O(1)", "is_correct": False, "answer_text_hi": "O(1)"}
            ],
            "question_text_hi": "बाइनरी सर्च की समय जटिलता क्या है?",
            "explanation_hi": "बाइनरी सर्च प्रत्येक चरण में खोज स्थान को आधा कर देता है, जिससे O(log n) प्राप्त होता है।"
        }
    )
    ExamQuestion.objects.create(exam=exam, question=q1, order=0)

    # 3. Create V2 Question 2
    q2 = Question.objects.create(
        id=str(uuid.uuid4())[:8],
        origin="test_script",
        question_type="multiple_choice",
        verified=True,
        schema_payload={
            "question_text": "Which data structure uses LIFO principle?",
            "explanation": "A Stack uses Last-In First-Out (LIFO).",
            "subject": "Data Structures",
            "topic": "Stacks",
            "difficulty": "Easy",
            "marks": 2.0,
            "options": [
                {"answer_text": "Queue", "is_correct": False},
                {"answer_text": "Stack", "is_correct": True},
                {"answer_text": "Tree", "is_correct": False},
                {"answer_text": "Graph", "is_correct": False}
            ]
        }
    )
    ExamQuestion.objects.create(exam=exam, question=q2, order=1)

    print(f"Created Exam '{exam.title}' (slug: {exam.slug}) with questions: {q1.id}, {q2.id}")

    # TEST 1: GET Questions (English)
    res = client.get(f"/api/exams/{exam.slug}/questions/?lang=en&mode=exam")
    assert res.status_code == 200, f"GET questions failed: {res.status_code} {res.data}"
    assert len(res.data) == 2, f"Expected 2 questions, got {len(res.data)}"
    q1_data = next(q for q in res.data if q['id'] == q1.id)
    assert q1_data['question_text'] == "What is the time complexity of binary search?"
    assert len(q1_data['answers']) == 4
    # In exam mode, is_correct must be hidden
    assert 'is_correct' not in q1_data['answers'][0]
    print("✅ TEST 1 PASSED: GET /api/exams/<slug>/questions/ (EN)")

    # TEST 2: GET Questions (Hindi)
    res_hi = client.get(f"/api/exams/{exam.slug}/questions/?lang=hi&mode=study")
    assert res_hi.status_code == 200
    q1_hi = next(q for q in res_hi.data if q['id'] == q1.id)
    assert q1_hi['question_text'] == "बाइनरी सर्च की समय जटिलता क्या है?"
    # In study mode, is_correct is visible
    assert q1_hi['answers'][1]['is_correct'] is True
    print("✅ TEST 2 PASSED: GET /api/exams/<slug>/questions/ (HI)")

    # TEST 3: POST Start Exam
    res_start = client.post(f"/api/exams/{exam.slug}/start/", {"mode": "exam"}, format="json")
    assert res_start.status_code == 200, f"Start failed: {res_start.status_code} {res_start.data}"
    session_id = res_start.data.get("session_id")
    assert session_id, "session_id missing in start response"
    print(f"✅ TEST 3 PASSED: POST /api/exams/<slug>/start/ (session_id={session_id})")

    # TEST 4: POST Submit Answer (Q1 -> Correct, opt index 1)
    res_ans1 = client.post(
        f"/api/exams/{exam.slug}/submit_answer/",
        {
            "session_id": session_id,
            "question_id": q1.id,
            "answer_id": "1",
            "is_flagged_for_review": False
        },
        format="json"
    )
    assert res_ans1.status_code == 200, f"Submit answer 1 failed: {res_ans1.status_code} {res_ans1.data}"
    assert res_ans1.data.get("is_correct") is True
    assert res_ans1.data.get("selected_answer") == 1
    assert res_ans1.data.get("selected_answer_text") == "O(log n)"
    print("✅ TEST 4 PASSED: POST /api/exams/<slug>/submit_answer/ (Correct Answer)")

    # TEST 5: POST Submit Answer (Q2 -> Wrong, opt index 0)
    res_ans2 = client.post(
        f"/api/exams/{exam.slug}/submit_answer/",
        {
            "session_id": session_id,
            "question_id": q2.id,
            "answer_id": "0",
            "is_flagged_for_review": True
        },
        format="json"
    )
    assert res_ans2.status_code == 200, f"Submit answer 2 failed: {res_ans2.status_code} {res_ans2.data}"
    assert res_ans2.data.get("is_correct") is False
    assert res_ans2.data.get("selected_answer") == 0
    assert res_ans2.data.get("selected_answer_text") == "Queue"
    print("✅ TEST 5 PASSED: POST /api/exams/<slug>/submit_answer/ (Wrong Answer)")

    # TEST 6: GET Progress
    res_prog = client.get(f"/api/exams/{exam.slug}/progress/?session_id={session_id}")
    assert res_prog.status_code == 200, f"Progress failed: {res_prog.status_code} {res_prog.data}"
    assert res_prog.data["answers"][q1.id] == "1"
    assert res_prog.data["answers"][q2.id] == "0"
    assert q2.id in res_prog.data["review"]
    print("✅ TEST 6 PASSED: GET /api/exams/<slug>/progress/")

    # TEST 7: POST Submit Exam
    res_submit = client.post(
        f"/api/exams/{exam.slug}/submit/",
        {"session_id": session_id, "mode": "exam"},
        format="json"
    )
    assert res_submit.status_code == 200, f"Submit exam failed: {res_submit.status_code} {res_submit.data}"
    # Q1: +2.0, Q2: -0.66 => Net = 1.34
    expected_score = round(2.0 - 0.66, 2)
    assert abs(res_submit.data["score"] - expected_score) < 0.01
    assert abs(res_submit.data["penalty"] - 0.66) < 0.01
    print(f"✅ TEST 7 PASSED: POST /api/exams/<slug>/submit/ (Score: {res_submit.data['score']})")

    # TEST 8: GET Results
    res_results = client.get(f"/api/exams/{exam.slug}/results/?session_id={session_id}")
    assert res_results.status_code == 200, f"Results failed: {res_results.status_code} {res_results.data}"
    assert len(res_results.data["answers"]) == 2
    assert len(res_results.data["questions"]) == 2
    assert res_results.data["correct_answers"] == 1
    assert res_results.data["wrong_answers"] == 1
    print("✅ TEST 8 PASSED: GET /api/exams/<slug>/results/")

    # TEST 9: POST Explain Question
    res_explain = client.post(
        "/api/exams/explain_question/",
        {"question_id": q1.id},
        format="json"
    )
    assert res_explain.status_code == 200
    assert "Binary search" in res_explain.data["explanation"]
    print("✅ TEST 9 PASSED: POST /api/exams/explain_question/")

    # TEST 10: Admin Questions ViewSet
    admin_user, _ = User.objects.get_or_create(username="admin_tester", defaults={"is_staff": True, "is_superuser": True})
    admin_user.is_staff = True
    admin_user.save()
    client.force_authenticate(user=admin_user)
    res_admin = client.get(f"/api/admin/questions/?exam_id={exam.id}")
    assert res_admin.status_code == 200, f"Admin questions failed: {res_admin.status_code} {res_admin.data}"
    assert len(res_admin.data) == 2
    print("✅ TEST 10 PASSED: GET /api/admin/questions/?exam_id=<id>")

    print("\n🎉 ALL 10 V2 INTEGRATION TESTS PASSED SUCCESSFULLY!\n")

if __name__ == "__main__":
    run_tests()
