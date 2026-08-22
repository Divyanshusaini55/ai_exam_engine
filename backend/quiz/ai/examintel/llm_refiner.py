from __future__ import annotations
import base64
import concurrent.futures
import json
import os
import re
import time
import urllib.request
import urllib.error
from pathlib import Path
from typing import List, Dict, Optional, Any, Callable, Tuple
from django.conf import settings
from pydantic import BaseModel, Field

from quiz.ai.examintel.models import QuestionBlock, QuestionOption
from quiz.ai.langfuse_client import observe


MATH_COMPLEXITY_REGEX = re.compile(
    r"(?:\\frac|\\sqrt|\^|_|\b(?:sin|cos|tan|cot|sec|cosec|log|ln|lim|int|dx|dy|matrix|det)\b|"
    r"[√∫∑∏±≠≤≥≈∞πθαβγλμσ\^°]|"
    r"\d+\s*[/÷]\s*\d+|\b[a-zA-Z]\s*=\s*[-+]?\d+|\b(?:Quantitative|Math|Aptitude|Physics|Chemistry|Table|Chart|Figure|Diagram)\b)",
    re.IGNORECASE
)

HINDI_UNICODE_REGEX = re.compile(r"[\u0900-\u097F]")


class RefinedOption(BaseModel):
    option_number: str = Field(..., description="Option identifier ('1', '2', '3', '4' or 'A', 'B', 'C', 'D')")
    option_text: str = Field(..., description="Clean option text formatted with KaTeX/LaTeX math where applicable")
    option_text_hi: Optional[str] = Field(default=None, description="Hindi translation/transcription if bilingual")
    is_correct: bool = Field(..., description="True if this option is the verified correct answer")
    image_url: Optional[str] = Field(default=None, description="Option diagram image path if present")


class RefinedQuestion(BaseModel):
    question_number: str = Field(..., description="Question number in exam sequence")
    global_question_number: Optional[int] = Field(default=None, description="1-indexed sequence across paper")
    question_id: Optional[str] = Field(default=None, description="System Question ID (e.g. '26433067336')")
    subject: Optional[str] = Field(default=None, description="Subject / Section name")
    topic: Optional[str] = Field(default=None, description="Topic classification (e.g. 'Trigonometry')")
    question_stem: str = Field(..., description="Clean question stem formatted with KaTeX/LaTeX math")
    question_stem_hi: Optional[str] = Field(default=None, description="Hindi translation/transcription if bilingual")
    language: str = Field(default="en", description="Question language: 'en', 'hi', or 'bilingual'")
    options: List[RefinedOption] = Field(default_factory=list, description="Standardized 4 options with KaTeX math")
    correct_option: Optional[str] = Field(default=None, description="Correct option identifier ('1', '2', '3', '4')")
    figure_urls: List[str] = Field(default_factory=list, description="Extracted diagram figure image paths")
    diagram_needed: bool = Field(default=False, description="True only if a genuine graphical chart/geometry figure is required that cannot be represented as text/KaTeX/table.")
    crop_image_url: Optional[str] = Field(default=None, description="Path to 300 DPI question crop image")
    provenance: str = Field(default="deterministic_signal", description="Origin of ground truth answer")


# Backward compatibility aliases
KaTeXRefinedOption = RefinedOption
KaTeXRefinedQuestion = RefinedQuestion


class RefinedChunkResult(BaseModel):
    chunk_index: int
    questions: List[RefinedQuestion]


def needs_math_or_bilingual_refinement(question: QuestionBlock) -> bool:
    """
    Returns True if question contains mathematical notation, scientific formulas,
    Devanagari Hindi text, or belongs to a STEM / Bilingual / Visual exam section.
    """
    all_text = (question.question_text or "") + " " + (question.section_name or "") + " "
    for opt in question.options:
        all_text += (opt.option_text or "") + " "

    has_math = bool(MATH_COMPLEXITY_REGEX.search(all_text))
    has_hindi = bool(HINDI_UNICODE_REGEX.search(all_text))
    diagram_paths = getattr(question, 'diagram_image_paths', getattr(question, 'diagram_paths', []))
    has_diagram = bool(diagram_paths)
    return has_math or has_hindi or has_diagram


needs_math_refinement = needs_math_or_bilingual_refinement


VISION_BILINGUAL_MATH_INSTRUCTION = """You are an expert Examination Question & Mathematical/Bilingual Transcriber Engine.
Your task is to transcribe the provided high-resolution 300 DPI crop of an exam question into clean JSON with full KaTeX/LaTeX mathematical formatting and accurate bilingual (English + Hindi) text separation.

MATHEMATICAL NOTATION RULES (STRICT):
1. Use standard LaTeX / KaTeX math notation:
   - Inline math: `$ ... $` (e.g. `$x^2 + y^2 = r^2$`, `$\\frac{5}{8}$`, `$2\\frac{1}{3}$`, `$\\sqrt{a^2+b^2}$`, `$\\angle ABC = 90^\\circ$`, `$30^\\circ$`, `$\\frac{\\cos 20^\\circ}{\\sin 70^\\circ}$`)
   - Block / Display equations: `$$ ... $$`
   - Fractions: Use `$\\frac{numerator}{denominator}$`
   - Radicals / Roots: Use `$\\sqrt{x}$` or `$\\sqrt[n]{x}$`
   - Subscripts/Exponents: Use `$a_{n}$`, `$x^{2}$`
   - Operators: Use `$\\times$`, `$\\div$`, `$\\pm$`, `$\\le$`, `$\\ge$`, `$\\neq$`, `$\\approx$`

VISUAL DIAGRAM & TABLE DEDUPLICATION RULES (CRITICAL):
1. If the crop contains a Mathematical Formula / Equation that you transcribed into KaTeX ($...$):
   -> Set "diagram_needed": false (do NOT render a duplicate image of the formula).
2. If the crop contains a Data Table with rows and columns that you transcribed into a clean Markdown table (| Col 1 | Col 2 |):
   -> Set "diagram_needed": false (do NOT render a duplicate image of the table).
3. If the crop contains a genuine graphical figure such as a Bar Chart, Pie Chart, Line Graph, Histogram, Geometry Angle Diagram, Triangle, Circle, Venn Diagram, Circuit, Map, Mirror Image, or Paper Folding figure that CANNOT be expressed as text:
   -> Set "diagram_needed": true (the graphical image must be displayed to the student).
4. If there are no images/figures at all:
   -> Set "diagram_needed": false.

BILINGUAL & INDIC TEXT RULES:
1. If the question crop contains BOTH English and Hindi:
   - `question_stem`: Clean English question stem (with KaTeX formulas / Markdown tables).
   - `question_stem_hi`: Clean printed Hindi question stem in proper Devanagari Unicode (with KaTeX formulas / Markdown tables).
   - In options: Output `option_text` for English and `option_text_hi` for Hindi.
   - Set `language`: "bilingual" (or "en").
2. If the question crop is Hindi-only (e.g. General Hindi section / सामान्य हिंदी):
   - `question_stem`: Clean Devanagari text.
   - `question_stem_hi`: null.
   - Set `language`: "hi".
3. If the question crop is English-only:
   - `question_stem`: Clean English text.
   - `question_stem_hi`: null.
   - Set `language`: "en".

GROUND TRUTH ANSWER INTEGRITY:
- If a detected ground-truth answer is specified in metadata, you MUST preserve it and set `is_correct: true` for that exact option.

SPEED & BREVITY:
- Do NOT generate explanations or solutions. Output pure JSON.
"""


def _encode_image_to_base64(image_path: Path) -> Optional[str]:
    try:
        if not image_path.is_file():
            return None
        with open(image_path, "rb") as f:
            return base64.b64encode(f.read()).decode("utf-8")
    except Exception:
        return None


@observe(name="refine_question_with_vision")
def refine_question_with_vision(
    question: QuestionBlock,
    api_key: Optional[str] = None,
    model_name: Optional[str] = None,
) -> RefinedQuestion:
    """
    Refines a single question crop into standardized KaTeX markdown, bilingual fields, and diagram requirement flag using Gemini Vision.
    Enforces deterministic ground-truth answer key locking (zero LLM hallucination).
    """
    key = api_key or getattr(settings, 'GEMINI_API_KEY', None) or os.environ.get("GEMINI_API_KEY")
    model = model_name or getattr(settings, 'GEMINI_SUMMARY_MODEL', 'models/gemini-flash-lite-latest')
    if model.startswith("models/"):
        model = model[len("models/"):]

    det_ans = question.detected_answer

    # Find 300 DPI crop file if available
    crop_file: Optional[Path] = None
    if question.crop_image_path:
        p = Path(question.crop_image_path)
        if p.is_file():
            crop_file = p
        elif (Path(settings.BASE_DIR) / question.crop_image_path).is_file():
            crop_file = Path(settings.BASE_DIR) / question.crop_image_path

    # Fallback directly if no API key
    if not key:
        return _build_fallback_refined_question(question)

    prompt = f"""{VISION_BILINGUAL_MATH_INSTRUCTION}

METADATA & GROUND TRUTH:
- Question Number: {question.question_number}
- Section: {question.section_name or 'General'}
- Deterministic Correct Option: {det_ans or 'Unknown'}

DRAFT TEXT:
{question.question_text}
Options:
"""
    for opt in question.options:
        is_c = getattr(opt, 'is_correct_signal', getattr(opt, 'is_correct', False))
        mark = " [CORRECT]" if (is_c or opt.option_number == det_ans) else ""
        prompt += f"  {opt.option_number}. {opt.option_text}{mark}\n"

    prompt += """
Respond ONLY with a JSON object:
{
  "question_number": "1",
  "subject": "Quantitative Aptitude",
  "topic": "Algebra",
  "question_stem": "If $x + \\\\frac{1}{x} = 5$, find $x^2 + \\\\frac{1}{x^2}$.",
  "question_stem_hi": "यदि $x + \\\\frac{1}{x} = 5$ है, तो $x^2 + \\\\frac{1}{x^2}$ का मान ज्ञात कीजिए।",
  "diagram_needed": false,
  "language": "bilingual",
  "options": [
    {"option_number": "1", "option_text": "$23$", "option_text_hi": "$23$", "is_correct": true},
    {"option_number": "2", "option_text": "$25$", "option_text_hi": "$25$", "is_correct": false},
    {"option_number": "3", "option_text": "$27$", "option_text_hi": "$27$", "is_correct": false},
    {"option_number": "4", "option_text": "$20$", "option_text_hi": "$20$", "is_correct": false}
  ],
  "correct_option": "1"
}
"""
    parts: List[Dict[str, Any]] = [{"text": prompt}]
    if crop_file:
        b64 = _encode_image_to_base64(crop_file)
        if b64:
            parts.append({
                "inline_data": {
                    "mime_type": "image/png",
                    "data": b64,
                }
            })

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
    payload = {
        "contents": [{"parts": parts}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.1,
        },
    }
    headers = {
        "Content-Type": "application/json",
        "X-goog-api-key": key,
    }

    diagram_paths = getattr(question, 'diagram_image_paths', getattr(question, 'diagram_paths', []))

    # Exponential Backoff Retry Loop (3 attempts)
    max_retries = 3
    for attempt in range(max_retries):
        try:
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers=headers,
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=30) as resp:
                resp_json = json.loads(resp.read().decode("utf-8"))
                candidate = resp_json.get("candidates", [{}])[0]
                content_part = candidate.get("content", {}).get("parts", [{}])[0].get("text", "{}")
                data = json.loads(content_part)

                # Authoritative Correct Option Enforcement
                llm_corr = str(data.get("correct_option", "")).strip()
                target_correct = str(det_ans).strip() if det_ans else llm_corr

                # Smart Diagram Deduplication
                diagram_needed = bool(data.get("diagram_needed", False))

                parsed_options: List[RefinedOption] = []
                for o in data.get("options", []):
                    opt_num = str(o.get("option_number", "")).strip()
                    is_c = bool(target_correct and opt_num == target_correct)
                    parsed_options.append(
                        RefinedOption(
                            option_number=opt_num,
                            option_text=o.get("option_text", ""),
                            option_text_hi=o.get("option_text_hi"),
                            is_correct=is_c,
                            image_url=o.get("image_url"),
                        )
                    )

                if not parsed_options and question.options:
                    for o in question.options:
                        opt_num = str(o.option_number).strip()
                        is_c = bool(target_correct and opt_num == target_correct)
                        parsed_options.append(
                            RefinedOption(
                                option_number=opt_num,
                                option_text=o.option_text,
                                option_text_hi=None,
                                is_correct=is_c,
                                image_url=o.option_image_path,
                            )
                        )

                stem_text = data.get("question_stem", question.question_text)
                
                # If diagram is not needed (because table or formula was transcribed),
                # strip redundant Markdown image tags from the stem
                if not diagram_needed:
                    stem_text = re.sub(r'!\[.*?\]\(.*?\)', '', stem_text).strip()
                    final_figures = []
                else:
                    final_figures = diagram_paths

                return RefinedQuestion(
                    question_number=str(data.get("question_number", question.question_number)),
                    global_question_number=question.global_question_number,
                    question_id=data.get("question_id") or question.question_id,
                    subject=data.get("subject") or question.section_name,
                    topic=data.get("topic"),
                    question_stem=stem_text,
                    question_stem_hi=data.get("question_stem_hi") or getattr(question, 'question_text_hi', None),
                    language=data.get("language") or getattr(question, 'language', 'en') or "en",
                    options=parsed_options,
                    correct_option=target_correct if target_correct else None,
                    figure_urls=final_figures,
                    diagram_needed=diagram_needed,
                    crop_image_url=question.crop_image_path if diagram_needed else None,
                    provenance=question.source if question.source != "none" else "multimodal_vision_refiner",
                )

        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < max_retries - 1:
                time.sleep(2 ** (attempt + 1))
                continue
            break
        except Exception:
            break

    return _build_fallback_refined_question(question)


def _build_fallback_refined_question(question: QuestionBlock) -> RefinedQuestion:
    """Builds a RefinedQuestion directly from local extracted QuestionBlock data without LLM."""
    det_ans = str(question.detected_answer).strip() if question.detected_answer else None
    if not det_ans:
        for o in question.options:
            is_c = getattr(o, 'is_correct_signal', getattr(o, 'is_correct', False))
            if is_c:
                det_ans = str(o.option_number).strip()
                break

    opts = []
    for o in question.options:
        opt_num = str(o.option_number).strip()
        is_c = bool(det_ans and opt_num == det_ans)
        opts.append(
            RefinedOption(
                option_number=opt_num,
                option_text=o.option_text,
                option_text_hi=None,
                is_correct=is_c,
                image_url=o.option_image_path,
            )
        )

    diagram_paths = getattr(question, 'diagram_image_paths', getattr(question, 'diagram_paths', []))
    has_diag = bool(diagram_paths)

    return RefinedQuestion(
        question_number=question.question_number,
        global_question_number=question.global_question_number,
        question_id=question.question_id,
        subject=question.section_name,
        topic=None,
        question_stem=question.question_text,
        question_stem_hi=getattr(question, 'question_text_hi', None),
        language=getattr(question, 'language', 'en') or "en",
        options=opts,
        correct_option=det_ans,
        figure_urls=diagram_paths,
        diagram_needed=has_diag,
        crop_image_url=question.crop_image_path,
        provenance=question.source if question.source != "none" else "deterministic_signal",
    )


def refine_questions_batch(
    questions: List[QuestionBlock],
    api_key: Optional[str] = None,
    model_name: Optional[str] = None,
    max_workers: int = 2,
) -> List[RefinedQuestion]:
    """
    Batches questions through Math & Bilingual Vision Refinement in parallel with Rate-Limit protection.
    Only questions with complex math/Indic/diagram triggers are sent to Vision; text-only questions use fast path.
    """
    results: List[Optional[RefinedQuestion]] = [None] * len(questions)

    def _process_one(idx_q: Tuple[int, QuestionBlock]) -> Tuple[int, RefinedQuestion]:
        idx, q = idx_q
        if needs_math_or_bilingual_refinement(q):
            res = refine_question_with_vision(q, api_key=api_key, model_name=model_name)
        else:
            res = _build_fallback_refined_question(q)
        return idx, res

    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = [executor.submit(_process_one, (i, q)) for i, q in enumerate(questions)]
        for f in concurrent.futures.as_completed(futures):
            idx, ref_q = f.result()
            results[idx] = ref_q

    return [r for r in results if r is not None]
