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

def is_language_section(subject_or_topic: str) -> str:
    """Returns 'hi' if Hindi language section, 'en' if English language section, or '' if general STEM/GK."""
    if not subject_or_topic:
        return ""
    norm = subject_or_topic.strip().lower()
    if any(k in norm for k in ["general hindi", "सामान्य हिंदी", "hindi grammar", "hindi language", "हिंदी"]):
        return "hi"
    if any(k in norm for k in ["general english", "english comprehension", "verbal ability", "english language"]):
        return "en"
    return ""


def auto_translate_exam_to_hindi(exam_or_id):
    """
    Batched background auto-translation for missing English sections of an exam.
    Invariance: Strictly SKIPS 'General Hindi' grammar questions.
    """
    if isinstance(exam_or_id, Exam):
        exam = exam_or_id
    else:
        try:
            exam = Exam.objects.get(id=exam_or_id)
        except Exam.DoesNotExist:
            return 0

    exam_questions = ExamQuestion.objects.filter(exam=exam).select_related('question').order_by('order')
    to_translate = []

    for eq in exam_questions:
        q = eq.question
        payload = q.schema_payload or {}
        subject = payload.get("subject") or (payload.get("classification") or {}).get("subject") or q.topic or ""
        lang_type = is_language_section(subject)

        # Invariant: Skip if already has Hindi translation OR if it's the General Hindi / English grammar section
        if payload.get("question_text_hi") or lang_type != "":
            continue

        q_text = payload.get("question_text") or (payload.get("content") or {}).get("text") or ""
        if q_text:
            to_translate.append((q, payload, q_text))

    if not to_translate:
        print(f"[*] auto_translate_exam_to_hindi: All {len(exam_questions)} questions already have Hindi translations or are language sections.")
        return 0

    print(f"[*] auto_translate_exam_to_hindi: Translating {len(to_translate)} English questions to Hindi in batches of 10...")

    from quiz.ai.gemini_client import GeminiClient
    client = GeminiClient()
    translated_count = 0
    batch_size = 10

    for i in range(0, len(to_translate), batch_size):
        batch = to_translate[i:i + batch_size]
        batch_items = []
        for local_idx, (q_obj, payload, q_text) in enumerate(batch):
            opts = payload.get("options", [])
            opts_summary = [o.get("text", "") or o.get("answer_text", "") for o in opts]
            batch_items.append({
                "item_id": local_idx,
                "question": q_text,
                "options": opts_summary
            })

        prompt = (
            "You are an expert exam translator for Indian competitive examinations.\n"
            "Translate each question stem and its options into natural, grammatically accurate Hindi in clean Devanagari Unicode.\n"
            "Preserve all mathematical formulas in KaTeX format ($...$).\n\n"
            "OUTPUT FORMAT (STRICT JSON ARRAY):\n"
            "[\n"
            "  {\n"
            '    "item_id": 0,\n'
            '    "question_hi": "...",\n'
            '    "options_hi": ["...", "..."]\n'
            "  }\n"
            "]\n\n"
            f"Questions to Translate:\n{json.dumps(batch_items, ensure_ascii=False)}"
        )

        try:
            res = client.generate_content(prompt)
            res_list = extract_json_from_text(res.get("text", ""))
            if isinstance(res_list, list):
                res_map = {item.get("item_id"): item for item in res_list if isinstance(item, dict)}
                for local_idx, (q_obj, payload, q_text) in enumerate(batch):
                    t_data = res_map.get(local_idx)
                    if t_data:
                        q_hi = t_data.get("question_hi", "").strip()
                        opts_hi = t_data.get("options_hi", [])
                        if q_hi:
                            payload["question_text_hi"] = q_hi
                            for o_idx, opt in enumerate(payload.get("options", [])):
                                if o_idx < len(opts_hi):
                                    opt["text_hi"] = opts_hi[o_idx]
                                    opt["answer_text_hi"] = opts_hi[o_idx]
                            q_obj.schema_payload = payload
                            q_obj.save(update_fields=["schema_payload"])
                            translated_count += 1
        except Exception as e:
            logger.error(f"Translation batch failed: {e}")

    # Add 'hi' to supported languages
    langs = set(exam.supported_languages or ["en"])
    langs.add("hi")
    exam.supported_languages = sorted(list(langs))
    exam.save(update_fields=["supported_languages"])

    print(f"[*] auto_translate_exam_to_hindi: Successfully translated {translated_count}/{len(to_translate)} questions to Hindi.")
    return translated_count
