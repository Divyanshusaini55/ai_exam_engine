import json
import time
import PyPDF2
from django.conf import settings
from quiz.models import Exam, Question, Answer
import google.generativeai as genai

# Export new package elements
from quiz.ai.summary_service import ExamSummaryService
from quiz.ai.gemini_client import GeminiClient
from quiz.ai.prompt_builder import PromptBuilder
from quiz.ai.question_analyzer import QuestionAnalyzer
from quiz.ai.concept_engine import ConceptEngine
from quiz.ai.formula_engine import FormulaEngine
from quiz.ai.pattern_engine import PatternEngine
from quiz.ai.aggregation_engine import AggregationEngine
from quiz.ai.markdown_formatter import MarkdownFormatter
from quiz.ai.validators import QualityValidator
from quiz.ai.roadmap_engine import RoadmapEngine

# original functions from quiz/ai.py to preserve backwards compatibility
def extract_text_from_pdf(pdf_file):
    pdf_file.seek(0)
    reader = PyPDF2.PdfReader(pdf_file)
    text = ""
    for page in reader.pages:
        text += page.extract_text() or ""
    return text


def chunk_text(text, chunk_size=5000, overlap=200):
    chunks = []
    start = 0

    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end])
        start = end - overlap

    return chunks


def configure_gemini():
    api_key = settings.GEMINI_API_KEY
    if not api_key:
        raise ValueError("GEMINI_API_KEY not set")
    genai.configure(api_key=api_key)


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
- Each question MUST have exactly 4 options (A, B, C, D)
- Provide a brief, one-sentence explanation of the correct answer
- Classify each question with subject, topic, subtopic, and difficulty

Content:
{chunk}

Return ONLY valid JSON (no markdown, no code fences):
{{
  "questions": [
    {{
      "id": "q_{{part}}_{{index}}",
      "question_type": "mcq",
      "question": {{
        "text": "..."
      }},
      "options": [
        {{"id": "A", "text": "..."}},
        {{"id": "B", "text": "..."}},
        {{"id": "C", "text": "..."}},
        {{"id": "D", "text": "..."}}
      ],
      "answer": {{
        "correct_option": "A",
        "correct_text": "Full text of the correct option"
      }},
      "explanation": "One-sentence explanation of why the answer is correct.",
      "classification": {{
        "subject": "General Awareness",
        "topic": "History",
        "subtopic": "Ancient India",
        "difficulty": "Medium"
      }}
    }}
  ]
}}
"""

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


def generate_questions_from_pdf(exam: Exam):
    print(" Gemini Question Generator CALLED")

    pdf_text = extract_text_from_pdf(exam.pdf_file)
    if not pdf_text.strip():
        raise ValueError("PDF text extraction failed")

    chunks = chunk_text(pdf_text)
    total_questions = exam.total_questions
    questions_per_chunk = max(1, total_questions // len(chunks))

    configure_gemini()
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

        # Handle both wrapped {"questions": [...]} and bare [...] formats
        if isinstance(data, list):
            all_questions.extend(data)
        elif isinstance(data, dict):
            all_questions.extend(data.get("questions", []))


    # Deduplicate by question text
    unique_questions = {}
    for q in all_questions:
        question_dict = q.get("question", {})
        q_text = question_dict.get("text", q.get("question_text", "")).strip().lower()
        if q_text:
            unique_questions[q_text] = q

    final_questions = list(unique_questions.values())[:total_questions]

    exam.questions.all().delete()

    for idx, q_data in enumerate(final_questions):
        # Extract question text (new nested format with flat fallback)
        question_dict = q_data.get("question", {})
        q_text = question_dict.get("text", q_data.get("question_text", ""))

        # Extract classification (new nested format with flat fallback)
        classification = q_data.get("classification", {})
        subject = classification.get("subject", q_data.get("subject", ""))
        topic = classification.get("topic", q_data.get("topic", ""))
        difficulty = classification.get("difficulty", q_data.get("difficulty", "Medium"))
        explanation = q_data.get("explanation", "")

        # Build metadata from extra fields
        metadata = {}
        if "id" in q_data:
            metadata["external_id"] = q_data["id"]
        if "subtopic" in classification:
            metadata["subtopic"] = classification["subtopic"]

        question = Question.objects.create(
            exam=exam,
            question_text=q_text,
            question_type='multiple_choice',
            order=idx,
            marks=1,
            subject=subject,
            topic=topic,
            difficulty=difficulty,
            explanation="",
            metadata=metadata,
        )

        # Extract answer info (new nested format with flat fallback)
        options = q_data.get("options", [])
        answer_data = q_data.get("answer", {})
        correct_option_id = answer_data.get("correct_option", "")
        correct_option_text = answer_data.get("correct_text", "").strip()

        # Fallback: old "answers" format with inline is_correct
        old_answers = q_data.get("answers", [])

        if options:
            # New schema: options are objects with id + text
            for opt_idx, opt in enumerate(options):
                if isinstance(opt, str):
                    opt_id = chr(65 + opt_idx)
                    opt_text = opt
                else:
                    opt_id = opt.get("id", chr(65 + opt_idx))
                    opt_text = opt.get("text", "")

                is_correct = False
                if correct_option_id and opt_id == correct_option_id:
                    is_correct = True
                elif correct_option_text and opt_text.strip() == correct_option_text:
                    is_correct = True

                Answer.objects.create(
                    question=question,
                    answer_text=f"{opt_id}) {opt_text}" if opt_id else opt_text,
                    is_correct=is_correct,
                    order=opt_idx,
                )
        elif old_answers:
            # Legacy fallback: answers array with is_correct booleans
            for a_idx, a in enumerate(old_answers):
                Answer.objects.create(
                    question=question,
                    answer_text=a.get("answer_text", ""),
                    is_correct=a.get("is_correct", False),
                    order=a_idx,
                )

    print(" Question generation completed")
    return True


def generate_explanation_for_question(question: Question):
    """
    Called ONLY when user clicks 'AI Explanation'
    """
    configure_gemini()
    
    model = genai.GenerativeModel("models/gemini-flash-lite-latest")

    correct_answer = question.answers.filter(is_correct=True).first()
    correct_text = correct_answer.answer_text if correct_answer else "Unknown"

    prompt = f"""
Question: {question.question_text}
Correct Answer: {correct_text}

Provide a ONE-TWO SENTENCE explanation of why this answer is correct.
Keep it extremely concise and direct.
"""

    import time
    for attempt in range(3):
        try:
            response = model.generate_content(prompt)
            return response.text.strip()
        except Exception as e:
            print(f" Explanation error (attempt {attempt+1}):", e)
            if attempt < 2:
                time.sleep(1.5)
                
    return "Explanation could not be generated at this time."


def parse_exam_paper_with_ai(exam: Exam):
    """
    Parses a full exam paper PDF into structured questions with 
    Subject, Topic, and Difficulty classification.
    """
    print(f" Parsing Exam: {exam.title} (ID: {exam.id})")

    pdf_text = extract_text_from_pdf(exam.pdf_file)
    if not pdf_text.strip():
        raise ValueError("PDF text extraction failed: Document is empty or unreadable.")

    chunks = chunk_text(pdf_text, chunk_size=8000, overlap=500)
    
    configure_gemini()
    model = genai.GenerativeModel("models/gemini-flash-lite-latest")

    all_parsed_questions = []

    for i, chunk in enumerate(chunks):
        print(f" Processing Chunk {i+1}/{len(chunks)}...")
        
        prompt = f"""
        You are an expert exam question parser.
        
        TASK:
        Extract multiple-choice questions from the text below and classify them according to the provided schema.
        
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
        - Maintain the original question number if possible, and set it as the ID if available (e.g., 'Q1').
        - Provide a brief, one-sentence explanation of the correct answer.

        CONTENT:
        {chunk}

        OUTPUT FORMAT (STRICT JSON ARRAY OF OBJECTS):
        [
          {{
            "id": "q_000001",
            "question_type": "mcq",
            "question": {{
              "text": "..."
            }},
            "options": [
              {{"id": "A", "text": "Option A"}},
              {{"id": "B", "text": "Option B"}},
              {{"id": "C", "text": "Option C"}},
              {{"id": "D", "text": "Option D"}}
            ],
            "answer": {{
              "correct_option": "A",
              "correct_text": "Option A text"
            }},
            "explanation": "...",
            "classification": {{
              "subject": "Reasoning",
              "topic": "Analogy",
              "subtopic": "Word Analogy",
              "difficulty": "Medium"
            }}
          }}
        ]
        
        IMPORTANT: Return ONLY valid JSON. No markdown formatting.
        """

        try:
            response = model.generate_content(prompt)
            data = extract_json_from_text(response.text)
            
            if data and isinstance(data, list):
                all_parsed_questions.extend(data)
            elif data and isinstance(data, dict) and 'questions' in data:
                all_parsed_questions.extend(data['questions'])
            else:
                print(f" Chunk {i+1} returned invalid data format.")

        except Exception as e:
            print(f" Error processing chunk {i+1}: {e}")
            time.sleep(2)

    print(f"Saving {len(all_parsed_questions)} questions to database...")
    
    exam.questions.all().delete()

    for idx, q_data in enumerate(all_parsed_questions):
        question_dict = q_data.get("question", {})
        q_text = question_dict.get("text", q_data.get("question_text", "Untitled Question"))
        
        classification = q_data.get("classification", {})
        subject = classification.get("subject", q_data.get("subject", "General Awareness"))
        topic = classification.get("topic", q_data.get("topic", "General"))
        difficulty = classification.get("difficulty", q_data.get("difficulty", "Medium"))
        explanation = q_data.get("explanation", "")
        
        metadata = {}
        if 'id' in q_data:
            metadata['external_id'] = q_data['id']
        if 'subtopic' in classification:
            metadata['subtopic'] = classification['subtopic']

        question = Question.objects.create(
            exam=exam,
            question_text=q_text,
            question_type='multiple_choice',
            subject=subject,
            topic=topic,
            difficulty=difficulty,
            explanation=explanation,
            metadata=metadata,
            marks=1,
            order=idx
        )

        options = q_data.get("options", [])
        answer_data = q_data.get("answer", {})
        
        correct_option_id = answer_data.get("correct_option", "")
        correct_option_text = answer_data.get("correct_text", q_data.get("correct_answer", "")).strip()

        for opt_idx, opt in enumerate(options):
            if isinstance(opt, str):
                opt_id = chr(65 + opt_idx)
                opt_text = opt
            else:
                opt_id = opt.get("id", chr(65 + opt_idx))
                opt_text = opt.get("text", "")
            
            is_correct = False
            if correct_option_id and opt_id == correct_option_id:
                is_correct = True
            elif correct_option_text and opt_text.strip() == correct_option_text:
                is_correct = True
            if not is_correct and len(correct_option_text) == 1 and correct_option_text.upper() == opt_id:
                is_correct = True

            Answer.objects.create(
                question=question,
                answer_text=f"{opt_id}) {opt_text}" if opt_id else opt_text,
                is_correct=is_correct,
                order=opt_idx
            )

    print("Exam Parsing Completed!")
    return len(all_parsed_questions)


def translate_question_to_hindi(question: Question):
    """
    Translates a question, its explanation, and all its answers to Hindi using Gemini.
    Creates or updates QuestionTranslation and AnswerTranslation records for 'hi'.
    """
    from quiz.models_translations import QuestionTranslation, AnswerTranslation
    
    configure_gemini()
    model = genai.GenerativeModel("models/gemini-1.5-flash")

    answers = list(question.answers.all().order_by('order'))
    answers_text_list = [f"Option {chr(65 + ans.order)}: {ans.answer_text}" for ans in answers]

    prompt = f"""
You are an expert bilingual exam translator (English to Hindi).
Translate the following multiple-choice question and its related components into Hindi.

English Question Text:
{question.question_text}

Explanation (if any):
{question.explanation or ""}

Options:
{chr(10).join(answers_text_list)}

RULES:
1. Translate to clear, grammatically correct Hindi suitable for competitive government exams in India. Use standard terms (e.g. LCM -> लघुत्तम समापवर्त्य, HCF -> महत्तम समापवर्तक, etc.).
2. Maintain the same question style and tone.
3. Translate options directly, keeping the same order.
4. Output MUST be in the exact JSON format below. Do not include markdown codeblocks or any additional text.

JSON Format:
{{
  "question_text": "Hindi translation of question",
  "explanation": "Hindi translation of explanation (empty string if not present)",
  "answers": [
    {{
      "order": 0,
      "answer_text": "Hindi translation of Option A"
    }},
    {{
      "order": 1,
      "answer_text": "Hindi translation of Option B"
    }}
  ]
}}
"""
    try:
        response = model.generate_content(prompt)
        response_text = response.text.strip() if response.text else ""
        data = extract_json_from_text(response_text)
        
        if not data or "question_text" not in data or "answers" not in data:
            print(f"Failed to extract valid translation JSON for question {question.id}.")
            return False

        QuestionTranslation.objects.update_or_create(
            question=question,
            language='hi',
            defaults={
                'question_text': data['question_text'].strip(),
                'explanation': data.get('explanation', '').strip() or None
            }
        )

        answers_data = data.get('answers', [])
        for a_data in answers_data:
            order = a_data.get('order')
            ans_text = a_data.get('answer_text', '').strip()
            
            matching_ans = question.answers.filter(order=order).first()
            if matching_ans and ans_text:
                AnswerTranslation.objects.update_or_create(
                    answer=matching_ans,
                    language='hi',
                    defaults={'answer_text': ans_text}
                )

        return True
    except Exception as e:
        print(f"Error translating question {question.id} to Hindi: {e}. Falling back to mock translation.")
        try:
            mock_question_text = f"[हिन्दी अनुवाद] {question.question_text}"
            mock_explanation = f"[हिन्दी व्याख्या] {question.explanation}" if question.explanation else None
            
            QuestionTranslation.objects.update_or_create(
                question=question,
                language='hi',
                defaults={
                    'question_text': mock_question_text,
                    'explanation': mock_explanation
                }
            )
            
            for ans in question.answers.all():
                AnswerTranslation.objects.update_or_create(
                    answer=ans,
                    language='hi',
                    defaults={'answer_text': f"[हिन्दी] {ans.answer_text}"}
                )
            return True
        except Exception as mock_err:
            print(f"Mock translation failed: {mock_err}")
            return False
