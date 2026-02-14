
import json
import time
from django.conf import settings
from .models import Exam, Question, Answer
import google.generativeai as genai
import PyPDF2


# ---------------------------------
# PDF TEXT EXTRACTION
# ---------------------------------
def extract_text_from_pdf(pdf_file):
    pdf_file.seek(0)
    reader = PyPDF2.PdfReader(pdf_file)
    text = ""
    for page in reader.pages:
        text += page.extract_text() or ""
    return text


# ---------------------------------
# TEXT CHUNKING (ANTI-REPEAT CORE)
# ---------------------------------
def chunk_text(text, chunk_size=5000, overlap=200):
    chunks = []
    start = 0

    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end])
        start = end - overlap

    return chunks


# ---------------------------------
# GEMINI CONFIGURATION
# ---------------------------------
def configure_gemini():
    api_key = settings.GEMINI_API_KEY
    if not api_key:
        raise ValueError("GEMINI_API_KEY not set")
    genai.configure(api_key=api_key)


# ---------------------------------
# PROMPT BUILDER (QUESTION GENERATION)
# ---------------------------------
def build_prompt(chunk, questions_per_chunk, part_no):
    return f"""
You are generating exam questions from PART {part_no} of a syllabus.

Generate exactly {questions_per_chunk} UNIQUE multiple choice questions
ONLY from the content below.

Rules:
- Do NOT repeat questions from previous parts
- Focus only on NEW concepts
- Avoid generic wording
- Each question must test a distinct concept

Content:
{chunk}

Return ONLY valid JSON:
{{
  "questions": [
    {{
      "question_text": "...",
      "answers": [
        {{"answer_text": "...", "is_correct": true}},
        {{"answer_text": "...", "is_correct": false}},
        {{"answer_text": "...", "is_correct": false}},
        {{"answer_text": "...", "is_correct": false}}
      ],
      "points": 1
    }}
  ]
}}
"""
# ---------------------------------
# SAFE JSON PARSER
# ---------------------------------
def extract_json_from_text(text):
    if not text:
        return None

    text = text.strip()

    if text.startswith("```"):
        text = text.replace("```json", "").replace("```", "").strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return None


# ---------------------------------
#  MAIN: PDF → QUESTIONS (FLASH LITE)
# ---------------------------------
def generate_questions_from_pdf(exam: Exam):
    print(" Gemini Question Generator CALLED")

    pdf_text = extract_text_from_pdf(exam.pdf_file)
    if not pdf_text.strip():
        raise ValueError("PDF text extraction failed")

    chunks = chunk_text(pdf_text)
    total_questions = exam.total_questions
    questions_per_chunk = max(1, total_questions // len(chunks))

    configure_gemini()
    # Using 'models/' prefix as seen in list_models() output
    MODEL_NAME = "models/gemini-flash-lite-latest"
    print(" USING MODEL:", MODEL_NAME)
    
    model = genai.GenerativeModel(MODEL_NAME)

    all_questions = []

    for i, chunk in enumerate(chunks):
        print(f" Chunk {i+1}/{len(chunks)}")
        prompt = build_prompt(chunk, questions_per_chunk, i + 1)

        data = None

        for attempt in range(2):
            try:
                response = model.generate_content(prompt)

                response_text = response.text.strip() if response.text else ""
                data = extract_json_from_text(response_text)

                if data:
                    break
                else:
                    print(f" Invalid JSON (chunk {i+1}) retry {attempt+1}")

            except Exception as e:
                wait = 5 + attempt * 5
                print(f" Rate limited or Error. Waiting {wait}s... Error: {e}")
                time.sleep(wait)

        if not data:
            print(f" Skipping chunk {i+1}")
            continue

        all_questions.extend(data.get("questions", []))

    # ---------------------------------
    # DEDUPLICATION
    # ---------------------------------
    unique_questions = {}
    for q in all_questions:
        key = q.get("question_text", "").strip().lower()
        if key:
            unique_questions[key] = q

    final_questions = list(unique_questions.values())[:total_questions]

    # ---------------------------------
    # SAVE TO DATABASE
    # ---------------------------------
    exam.questions.all().delete()

    for idx, q in enumerate(final_questions):
        question = Question.objects.create(
            exam=exam,
            question_text=q.get("question_text", ""),
            order=idx,
            points=q.get("points", 1),
        )

        for a_idx, a in enumerate(q.get("answers", [])):
            Answer.objects.create(
                question=question,
                answer_text=a.get("answer_text", ""),
                is_correct=a.get("is_correct", False),
                order=a_idx,
            )

    print(" Question generation completed")
    return True


# ---------------------------------
# ON-DEMAND AI EXPLANATION (PRO MODEL)
# ---------------------------------
def generate_explanation_for_question(question: Question):
    """
    Called ONLY when user clicks 'AI Explanation'
    """
    configure_gemini()
    
    # Use Flash Lite for speed and reliability (stops timeout issues)
    model = genai.GenerativeModel("models/gemini-flash-lite-latest")

    correct_answer = question.answers.filter(is_correct=True).first()
    correct_text = correct_answer.answer_text if correct_answer else "Unknown"

    prompt = f"""
Question: {question.question_text}
Correct Answer: {correct_text}

Provide a ONE-TWO SENTENCE explanation of why this answer is correct.
Keep it extremely concise and direct.
"""

    try:
        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception as e:
        print(" Explanation error:", e)
        return "Explanation could not be generated at this time."


# ---------------------------------
# AI EXAM PARSER (FULL PAPER)
# ---------------------------------
def parse_exam_paper_with_ai(exam: Exam):
    """
    Parses a full exam paper PDF into structued questions with 
    Subject, Topic, and Difficulty classification.
    """
    print(f"📄 Parsing Exam: {exam.title} (ID: {exam.id})")

    # 1. Extract Text
    pdf_text = extract_text_from_pdf(exam.pdf_file)
    if not pdf_text.strip():
        raise ValueError("PDF text extraction failed: Document is empty or unreadable.")

    # 2. Chunking (Large exams need chunking)
    # Using larger chunks for context
    chunks = chunk_text(pdf_text, chunk_size=8000, overlap=500)
    
    configure_gemini()
    model = genai.GenerativeModel("models/gemini-flash-lite-latest")

    all_parsed_questions = []

    for i, chunk in enumerate(chunks):
        print(f" Processing Chunk {i+1}/{len(chunks)}...")
        
        prompt = f"""
        You are an expert exam question parser.
        
        TASK:
        Extract multiple-choice questions from the text below and classify them.
        
        ALLOWED SUBJECTS:
        - Reasoning
        - Quantitative Aptitude
        - English
        - General Awareness
        - Hindi

        RULES:
        - Hindi language questions → Subject = Hindi
        - Math, numbers, calculation → Quantitative Aptitude
        - Logic, series, analogy → Reasoning
        - Grammar, vocabulary, comprehension → English
        - History, Polity, Science, Current Affairs → General Awareness
        - Maintain the original question number if possible.

        CONTENT:
        {chunk}

        OUTPUT FORMAT (STRICT JSON ARRAY):
        [
          {{
            "question_text": "...",
            "options": ["Option A", "Option B", "Option C", "Option D"],
            "correct_answer": "Option A", 
            "subject": "Reasoning",
            "topic": "Analogy",
            "difficulty": "Medium",
            "points": 1
          }}
        ]
        
        IMPORTANT: Return ONLY valid JSON. No markdown formatting.
        """

        try:
            response = model.generate_content(prompt)
            data = extract_json_from_text(response.text)
            
            if data and isinstance(data, list):
                all_parsed_questions.extend(data)
            else:
                print(f" Chunk {i+1} returned invalid data format.")

        except Exception as e:
            print(f" Error processing chunk {i+1}: {e}")
            time.sleep(2) # Backoff

    # 3. Save to Database
    print(f"Saving {len(all_parsed_questions)} questions to database...")
    
    # Optional: Clear existing questions if re-parsing
    exam.questions.all().delete()

    for idx, q_data in enumerate(all_parsed_questions):
        # Create Question
        question = Question.objects.create(
            exam=exam,
            question_text=q_data.get("question_text", "Untitled Question"),
            subject=q_data.get("subject", "General Awareness"),
            topic=q_data.get("topic", "General"),
            difficulty=q_data.get("difficulty", "Medium"),
            points=q_data.get("points", 1),
            order=idx
        )

        # Create Answers
        options = q_data.get("options", [])
        correct_option_text = q_data.get("correct_answer", "").strip()

        for opt_idx, opt_text in enumerate(options):
            is_correct = (opt_text.strip() == correct_option_text)
            # Fallback: if correct answer is index-based (e.g. "Option A" or "A")
            if not is_correct and len(correct_option_text) == 1:
                 # Check if this option index matches the letter (A=0, B=1...)
                 # A bit simplistic, but covers "A", "B" etc. 
                 if correct_option_text.upper() == chr(65 + opt_idx):
                     is_correct = True

            Answer.objects.create(
                question=question,
                answer_text=opt_text,
                is_correct=is_correct,
                order=opt_idx
            )

    print("Exam Parsing Completed!")
    return len(all_parsed_questions)
