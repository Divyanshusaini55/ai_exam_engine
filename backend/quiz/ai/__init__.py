import logging
import json
import re
from quiz.models import Exam, Question, ExamQuestion

logger = logging.getLogger(__name__)

def extract_json_from_text(text: str):
    """Extract and parse JSON from raw text or markdown code blocks."""
    if not text:
        return None
    cleaned = text.strip()
    # Match ```json ... ``` or ``` ... ```
    match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', cleaned, re.DOTALL)
    if match:
        cleaned = match.group(1).strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        # Try finding the first [ or { to the last ] or }
        start_brace = cleaned.find('{')
        start_bracket = cleaned.find('[')
        if start_brace != -1 and (start_bracket == -1 or start_brace < start_bracket):
            end_brace = cleaned.rfind('}')
            if end_brace != -1:
                try:
                    return json.loads(cleaned[start_brace:end_brace + 1])
                except Exception:
                    pass
        elif start_bracket != -1:
            end_bracket = cleaned.rfind(']')
            if end_bracket != -1:
                try:
                    return json.loads(cleaned[start_bracket:end_bracket + 1])
                except Exception:
                    pass
            
            # Auto-repair truncated JSON arrays (when Gemini hits output token limit)
            last_brace = cleaned.rfind('}')
            if last_brace != -1 and last_brace > start_bracket:
                try:
                    repaired = cleaned[start_bracket:last_brace + 1] + '\n]'
                    return json.loads(repaired)
                except Exception as e:
                    logger.warning(f"Auto-repair of truncated JSON failed: {e}")
                    pass
    return None

def parse_exam_paper_with_ai(exam: Exam):
    if not exam.pdf_file:
        logger.error("Exam has no pdf_file")
        return 0
        
    pdf_path = exam.pdf_file.path
    logger.info(f"Starting ExamIngestionGraph for {pdf_path}")
    print(f"[*] Starting new ExamIngestionGraph pipeline for {pdf_path}")
    
    from .langgraph.exam_ingestion_graph import ExamIngestionGraph
    
    graph = ExamIngestionGraph()
    result = graph.run(pdf_path)
    
    payloads = result.get("final_payloads", [])
    print(f"[*] Graph execution finished. Extracted {len(payloads)} questions.")
    
    # Save to database
    count = 0
    import uuid
    for idx, payload in enumerate(payloads):
        try:
            q_id = payload.get("id") or str(uuid.uuid4())[:8]
            q = Question.objects.create(
                id=q_id,
                question_type=payload.get("question_type", "multiple_choice"),
                origin=payload.get("origin", "pdf_extracted"),
                schema_version=payload.get("schema_version", "v2"),
                topic=(payload.get("classification") or {}).get("topic", "General"),
                schema_payload=payload,
                verified=bool((payload.get("verification") or {}).get("verified", True))
            )
            ExamQuestion.objects.create(
                exam=exam,
                question=q,
                order=idx
            )
            count += 1
            print(f"  [+] Saved question {idx+1}/{len(payloads)}: {q.id}")
        except Exception as e:
            print(f"  [-] Failed to save question {idx+1}: {e}")
    # Detect supported languages and update Exam
    has_hindi = any(
        bool(p.get("question_text_hi")) or (p.get("metadata") or {}).get("language") == "hi"
        for p in payloads
    )
    current_langs = set(exam.supported_languages or ["en"])
    if has_hindi:
        current_langs.add("hi")
    exam.supported_languages = sorted(list(current_langs))
    exam.save(update_fields=["supported_languages"])

    print(f"[*] Done. Total saved: {count}. Supported languages: {exam.supported_languages}")
    return count

generate_questions_from_pdf = parse_exam_paper_with_ai

def generate_explanation_for_question(question_or_id):
    if isinstance(question_or_id, Question):
        question = question_or_id
    else:
        try:
            question = Question.objects.get(id=question_or_id)
        except Question.DoesNotExist:
            return "Explanation could not be generated at this time."

    payload = question.schema_payload or {}
    q_text = payload.get('question_text', '')
    options = payload.get('options', [])
    subject = payload.get('subject', '')

    if not q_text:
        return "Explanation could not be generated at this time."

    prompt = (
        f"You are an expert exam tutor. Provide a clear, step-by-step explanation and final answer "
        f"for the following competitive examination question.\n\n"
        f"Subject: {subject}\n"
        f"Question: {q_text}\n"
        f"Options: {json.dumps(options)}\n\n"
        f"Requirements:\n"
        f"1. Explain the underlying concept briefly.\n"
        f"2. Show the step-by-step solution.\n"
        f"3. State clearly which option is correct and why other options are incorrect.\n"
        f"4. Format formulas using LaTeX ($...$)."
    )

    try:
        from quiz.ai.gemini_client import GeminiClient
        client = GeminiClient()
        res = client.generate_content(prompt)
        explanation = res.get('text', '').strip()
        if explanation:
            payload['explanation'] = explanation
            question.schema_payload = payload
            question.save(update_fields=['schema_payload'])
            return explanation
    except Exception as e:
        logger.error(f"Failed to generate explanation for Question {question.id}: {e}")

    return "Explanation could not be generated at this time."

def translate_question_to_hindi(question_or_id):
    if isinstance(question_or_id, Question):
        question = question_or_id
    else:
        try:
            question = Question.objects.get(id=question_or_id)
        except Question.DoesNotExist:
            return False

    payload = question.schema_payload or {}
    q_text = payload.get('question_text', '')
    options = payload.get('options', [])
    explanation = payload.get('explanation', '')

    if not q_text:
        return False

    prompt = (
        f"Translate the following question, options, and explanation into natural, accurate Hindi for competitive exams.\n\n"
        f"Question: {q_text}\n"
        f"Options: {json.dumps(options)}\n"
        f"Explanation: {explanation}\n\n"
        f"Respond ONLY in valid JSON matching this schema:\n"
        f"{{\n"
        f'  "question_text_hi": "...",\n'
        f'  "explanation_hi": "...",\n'
        f'  "options_hi": ["Option A in Hindi", "Option B in Hindi", ...]\n'
        f"}}"
    )

    try:
        from quiz.ai.gemini_client import GeminiClient
        client = GeminiClient()
        res = client.generate_content(prompt)
        data = extract_json_from_text(res.get('text', ''))
        if data and isinstance(data, dict):
            payload['question_text_hi'] = data.get('question_text_hi', '')
            payload['explanation_hi'] = data.get('explanation_hi', '')
            opts_hi = data.get('options_hi', [])
            for idx, opt in enumerate(payload.get('options', [])):
                if idx < len(opts_hi) and isinstance(opt, dict):
                    opt['answer_text_hi'] = opts_hi[idx]
            question.schema_payload = payload
            question.save(update_fields=['schema_payload'])
            return True
    except Exception as e:
        logger.error(f"Failed to translate question {question.id} to Hindi: {e}")

    return False
