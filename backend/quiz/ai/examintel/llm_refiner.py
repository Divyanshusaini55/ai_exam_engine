from __future__ import annotations
import base64
import concurrent.futures
import json
import logging
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
from quiz.ai.examintel.indic_font_repair import repair_indic_text, has_corrupted_indic_glyphs
from quiz.ai.langfuse_client import observe

logger = logging.getLogger(__name__)


MATH_COMPLEXITY_REGEX = re.compile(
    r"(?:\\frac|\\sqrt|\^|\b(?:sin|cos|tan|cot|sec|cosec|log|ln|lim|matrix|det)\b|"
    r"[√∫∑∏±≠≤≥≈∞πθαβγλμ°]|"
    r"\b\d+\s*[/÷]\s*\d+\b|"
    r"\b[a-z]\s*[\^²³]\s*\d*|\b[a-z]\s*[23]\s*[\+\-\=])",
    re.IGNORECASE
)

TABLE_DATA_REGEX = re.compile(
    r"(?:तालिका|सारणी|\btables?\b|\bmatrices\b|\bmatrix\b|data\s+interpretation|study\s+the\s+following\s+table|"
    r"\bchart\s+given\s+below\b|\bdistribution\s+of\b)",
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
    shared_context: Optional[str] = Field(default=None, description="Shared reading comprehension passage or cloze test text")
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
    unformatted data interpretation tables, corrupted legacy Indic font glyphs,
    or visual diagram/image elements that benefit from Vision KaTeX refinement.
    Pristine text-only questions bypass the LLM for 0.00s instant deterministic processing.
    """
    q_content = (question.question_text or "") + " "
    for opt in question.options:
        q_content += (opt.option_text or "") + " "

    has_math = bool(MATH_COMPLEXITY_REGEX.search(q_content))
    has_corrupted_indic = has_corrupted_indic_glyphs(q_content)
    has_table = bool(TABLE_DATA_REGEX.search(q_content))
    diagram_paths = getattr(question, 'diagram_image_paths', getattr(question, 'diagram_paths', []))
    has_diagram = bool(diagram_paths)
    has_img_opts = any(bool(getattr(opt, 'option_image_path', None) or getattr(opt, 'image_url', None)) for opt in question.options)
    has_empty_stem = not (question.question_text or "").strip() and bool(question.crop_image_path)
    return has_math or has_corrupted_indic or has_table or has_diagram or has_img_opts or has_empty_stem


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
    output_dir: Optional[Path] = None,
) -> RefinedQuestion:
    """
    Refines a single question crop into standardized KaTeX markdown, bilingual fields, and diagram requirement flag using Gemini Vision.
    Enforces deterministic ground-truth answer key locking (zero LLM hallucination).
    """
    from quiz.ai.gemini_client import GeminiClient
    from vertexai.generative_models import Part
    from quiz.ai import extract_json_from_text

    client = GeminiClient()
    model = model_name or getattr(settings, 'GEMINI_SUMMARY_MODEL', 'gemini-3.8-flash')
    if model.startswith("models/"):
        model = model[len("models/"):]

    det_ans = question.detected_answer

    # Find 300 DPI crop file if available
    crop_file: Optional[Path] = None
    if question.crop_image_path:
        p = Path(question.crop_image_path)
        candidates = [
            p,
            Path(settings.BASE_DIR) / question.crop_image_path,
            Path(settings.BASE_DIR) / "output" / question.crop_image_path,
        ]
        if hasattr(settings, 'MEDIA_ROOT') and settings.MEDIA_ROOT:
            candidates.append(Path(settings.MEDIA_ROOT) / question.crop_image_path)
            candidates.append(Path(settings.MEDIA_ROOT) / "exam_assets" / question.crop_image_path)
        if output_dir:
            out_p = Path(output_dir)
            candidates.insert(0, out_p / question.crop_image_path)
            candidates.insert(1, out_p / p.name)
            candidates.insert(2, out_p / "assets" / "crops" / p.name)
        for cand in candidates:
            if cand.is_file():
                crop_file = cand
                break
        if not crop_file:
            # Deep search in media and output folders
            search_roots = []
            if hasattr(settings, 'MEDIA_ROOT') and settings.MEDIA_ROOT:
                search_roots.append(Path(settings.MEDIA_ROOT))
            search_roots.append(Path(settings.BASE_DIR) / "output")
            for root in search_roots:
                if root.exists():
                    matches = list(root.glob(f"**/{p.name}"))
                    if matches:
                        crop_file = matches[0]
                        break

    if not crop_file and not (question.question_text and question.question_text.strip()):
        logger.warning(f"Q{question.question_number}: Neither crop image nor draft text available. Skipping LLM call.")
        return _build_fallback_refined_question(question)

    prompt = f"""{VISION_BILINGUAL_MATH_INSTRUCTION}

STRICT QUESTION INTEGRITY RULES (CRITICAL):
1. You MUST transcribe and refine the EXACT question given in DRAFT TEXT and the attached CROP image.
2. Under NO circumstances should you invent, hallucinate, or substitute a different question.
3. If DRAFT TEXT contains the question statement and options, PRESERVE its exact content, wording, names, and logic, converting mathematical formulas/equations into KaTeX ($...$).

METADATA & GROUND TRUTH:
- Question Number: {question.question_number}
- Section: {question.section_name or 'General'}
- Deterministic Correct Option: {det_ans or 'Unknown'}

DRAFT TEXT:
{question.question_text or '(Question text and mathematical expressions are in the attached crop image - transcribe accurately into KaTeX math)'}
Options:
"""
    for opt in question.options:
        is_c = getattr(opt, 'is_correct_signal', getattr(opt, 'is_correct', False))
        mark = " [CORRECT]" if (is_c or opt.option_number == det_ans) else ""
        opt_desc = opt.option_text or f"(Option {opt.option_number} image/formula in crop)"
        prompt += f"  {opt.option_number}. {opt_desc}{mark}\n"

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
    parts = [prompt]
    if crop_file:
        try:
            with open(crop_file, "rb") as f:
                image_bytes = f.read()
            image_part = Part.from_data(data=image_bytes, mime_type="image/png")
            parts.append(image_part)
        except Exception as e:
            pass

    diagram_paths = getattr(question, 'diagram_image_paths', getattr(question, 'diagram_paths', []))

    try:
        res = client.generate_content(
            parts, 
            model_name=model, 
            temperature=0.1, 
            response_mime_type="application/json"
        )
        data = extract_json_from_text(res.get('text', '{}'))
        if not isinstance(data, dict):
            data = {}

        # Authoritative Correct Option Enforcement
        llm_corr = str(data.get("correct_option", "")).strip()
        target_correct = str(det_ans).strip() if det_ans else llm_corr

        # Check if original options used letter format ('A', 'B', 'C', 'D')
        orig_numbers = [str(opt.option_number).strip().upper() for opt in question.options]
        orig_is_letter = any(n in {"A", "B", "C", "D"} for n in orig_numbers)

        # Normalize target_correct format to match original question options
        if orig_is_letter and target_correct in {"1": "A", "2": "B", "3": "C", "4": "D"}:
            target_correct = {"1": "A", "2": "B", "3": "C", "4": "D"}[target_correct]
        elif not orig_is_letter and target_correct in {"A": "1", "B": "2", "C": "3", "D": "4"}:
            target_correct = {"A": "1", "B": "2", "C": "3", "D": "4"}[target_correct]

        # Smart Diagram Deduplication
        diagram_needed = bool(data.get("diagram_needed", False))

        # If original options have extracted images (e.g. mirror images, visual patterns), diagram is ALWAYS needed
        orig_opt_img_map = {
            str(opt.option_number).strip().upper(): (getattr(opt, 'option_image_path', None) or getattr(opt, 'image_url', None))
            for opt in question.options
            if getattr(opt, 'option_image_path', None) or getattr(opt, 'image_url', None)
        }
        if orig_opt_img_map:
            diagram_needed = True

        parsed_options: List[RefinedOption] = []
        for opt_idx, o in enumerate(data.get("options", [])):
            raw_num = str(o.get("option_number", "")).strip().upper()
            if orig_is_letter:
                num_to_let = {"1": "A", "2": "B", "3": "C", "4": "D"}
                opt_num = num_to_let.get(raw_num, raw_num)
                if opt_num not in {"A", "B", "C", "D"} and opt_idx < len(orig_numbers):
                    opt_num = orig_numbers[opt_idx]
            else:
                let_to_num = {"A": "1", "B": "2", "C": "3", "D": "4"}
                opt_num = let_to_num.get(raw_num, raw_num)
                if opt_num not in {"1", "2", "3", "4"} and opt_idx < len(orig_numbers):
                    opt_num = orig_numbers[opt_idx]

            is_c = bool(target_correct and opt_num == target_correct)
            orig_img = orig_opt_img_map.get(opt_num)
            img_url = (o.get("image_url") or orig_img) if diagram_needed else None

            opt_txt = o.get("option_text", "") or ""
            # If option has an image and text is only a placeholder like "image" or "Option A", clear text
            if img_url and re.match(r"^\s*(?:image|figure|img|diagram|चित्र|आकृति|Option\s*[A-D1-4]|विकल्प\s*[A-D1-4]|\([A-D1-4]\))\s*$", opt_txt, re.IGNORECASE):
                opt_txt = ""

            parsed_options.append(
                RefinedOption(
                    option_number=opt_num,
                    option_text=sanitize_option_text(opt_txt),
                    option_text_hi=o.get("option_text_hi"),
                    is_correct=is_c,
                    image_url=img_url,
                )
            )

        if not parsed_options and question.options:
            for o in question.options:
                opt_num = str(o.option_number).strip()
                is_c = bool(target_correct and opt_num == target_correct)
                orig_img = getattr(o, 'option_image_path', None) or getattr(o, 'image_url', None)
                img_url = orig_img if diagram_needed else None
                parsed_options.append(
                    RefinedOption(
                        option_number=opt_num,
                        option_text=o.option_text,
                        option_text_hi=None,
                        is_correct=is_c,
                        image_url=img_url,
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
            shared_context=getattr(question, 'shared_context', None),
            provenance=question.source if question.source != "none" else "multimodal_vision_refiner",
        )

    except Exception as e:
        logger.warning(f"Multimodal vision refinement failed for Q{question.question_number}: {e}")

    return _build_fallback_refined_question(question)


def sanitize_option_text(text: str, has_image: bool = False) -> str:
    """Cleans noisy UI artifacts, leaked section banners, page footers, and redundant image placeholders from option text."""
    if not text:
        return ""
    # Strip UI buttons
    text = re.sub(r"(?im)^\s*(?:Save\s*&\s*Print|Bookmark|Mark\s*for\s*Review|Question\s*ID\s*:\s*\d+|Chosen\s*Option\s*:\s*\d+)\s*$", "", text)
    # Strip repeated all-caps section banners
    text = re.sub(r"(?im)^\s*(?:BASIC\s*LAW|GENERAL\s*HINDI|NUMERICAL|MENTAL\s*APTITUDE|GENERAL\s*KNOWLEDGE|TEST\s*OF\s*REASONING)[^\n]*?(?:BASIC\s*LAW|GENERAL\s*HINDI|NUMERICAL|MENTAL\s*APTITUDE|GENERAL\s*KNOWLEDGE|TEST\s*OF\s*REASONING)[^\n]*$", "", text)
    text = re.sub(r"(?im)^\s*(?:BASIC\s*LAW\s*-\s*CONSTITUTION\s*AND\s*GENERAL\s*KNOWLEDGE|MENTAL\s*APTITUDE\s*-\s*INTELLIGENCE\s*-\s*TEST\s*OF\s*REASONING|NUMERICAL\s*&\s*MENTAL\s*ABILITY|GENERAL\s*HINDI)\s*$", "", text)
    # Strip swallowed Case Study / Comprehension / Directions headers
    text = re.sub(r"(?im)(?:\n\s*|\s+)(?:Comprehension\s*:|Case\s*Study\s*-\s*\d+\s*to\s*\d+|Directions\s*(?:\([^\)]*\))?\s*:|SubQuestion\s*No\s*:)[\s\S]*", "", text)
    text = re.sub(r"(?im)\bComprehension\s*:[\s\S]*", "", text)

    # If the option has an image, strip redundant label placeholders like "छवि (A)", "Figure A", "(A)"
    if has_image:
        text = re.sub(r"(?im)^\s*(?:छवि|आकृति|चित्र|चित्र\s*संख्या|Figure|Fig\.?|Image|Option|विकल्प)\s*[\(\[]?\s*[A-Da-d1-4]\s*[\)\]]?\s*$", "", text)
        text = re.sub(r"(?im)^\s*[\(\[]?\s*[A-Da-d1-4]\s*[\)\]]?\s*$", "", text)

    lines = [l.strip() for l in text.splitlines() if l.strip()]
    return "\n".join(lines).strip()


def _build_fallback_refined_question(question: QuestionBlock) -> RefinedQuestion:
    """Builds a RefinedQuestion directly from local extracted QuestionBlock data with deterministic Indic repair."""
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
        img_url = o.option_image_path
        repaired_opt = repair_indic_text(o.option_text or "")
        opts.append(
            RefinedOption(
                option_number=opt_num,
                option_text=sanitize_option_text(repaired_opt, has_image=bool(img_url)),
                option_text_hi=None,
                is_correct=is_c,
                image_url=img_url,
            )
        )

    diagram_paths = getattr(question, 'diagram_image_paths', getattr(question, 'diagram_paths', []))
    has_diag = bool(diagram_paths)

    stem_clean = repair_indic_text(question.question_text or "")
    stem_hi_clean = repair_indic_text(getattr(question, 'question_text_hi', None) or "") or None

    return RefinedQuestion(
        question_number=question.question_number,
        global_question_number=question.global_question_number,
        question_id=question.question_id,
        subject=question.section_name,
        topic=None,
        question_stem=stem_clean,
        question_stem_hi=stem_hi_clean,
        language=getattr(question, 'language', 'en') or "en",
        options=opts,
        correct_option=det_ans,
        figure_urls=diagram_paths,
        diagram_needed=has_diag,
        crop_image_url=question.crop_image_path,
        shared_context=getattr(question, 'shared_context', None),
        provenance=question.source if question.source != "none" else "deterministic_signal",
    )


def refine_questions_batch(
    questions: List[QuestionBlock],
    api_key: Optional[str] = None,
    model_name: Optional[str] = None,
    max_workers: int = 6,
    output_dir: Optional[Path] = None,
) -> List[RefinedQuestion]:
    """
    Batches questions through Math & Bilingual Vision Refinement in parallel with Rate-Limit protection.
    Only questions with complex math/Indic/diagram triggers are sent to Vision; text-only questions use fast path.
    """
    results: List[Optional[RefinedQuestion]] = [None] * len(questions)

    def _process_one(idx_q: Tuple[int, QuestionBlock]) -> Tuple[int, RefinedQuestion]:
        idx, q = idx_q
        if needs_math_or_bilingual_refinement(q):
            res = refine_question_with_vision(q, api_key=api_key, model_name=model_name, output_dir=output_dir)
        else:
            res = _build_fallback_refined_question(q)
        return idx, res

    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = [executor.submit(_process_one, (i, q)) for i, q in enumerate(questions)]
        for f in concurrent.futures.as_completed(futures):
            idx, ref_q = f.result()
            results[idx] = ref_q

    return [r for r in results if r is not None]
