from __future__ import annotations
from pathlib import Path
from typing import List, Optional, Set

from quiz.ai.examintel.models import QuestionBlock, AnswerKeyEntry
from quiz.ai.examintel.llm_refiner import RefinedQuestion


def render_refined_question_markdown(q: RefinedQuestion) -> str:
    lines: List[str] = []

    id_suffix = f" [ID: {q.question_id}]" if q.question_id else ""
    global_prefix = f" (Global Q{q.global_question_number})" if q.global_question_number else ""
    sec_prefix = f" [{q.subject}]" if q.subject else ""
    topic_str = f" *Topic: {q.topic}*" if q.topic else ""

    lines.append(f"## Question {q.question_number}{global_prefix}{sec_prefix}{id_suffix}")
    if topic_str:
        lines.append(topic_str)
        lines.append("")

    lines.append(q.question_stem)
    lines.append("")

    # Diagrams/Figures
    for fig_url in q.figure_urls:
        lines.append(f"![Figure]({fig_url})")
        lines.append("")

    # Options with KaTeX
    if q.options:
        lines.append("### Options")
        single_corr = str(q.correct_option).strip() if q.correct_option else None
        if not single_corr:
            for opt in q.options:
                if opt.is_correct:
                    single_corr = str(opt.option_number).strip()
                    break

        for opt in q.options:
            is_corr = bool(single_corr and str(opt.option_number).strip() == single_corr)
            is_checked = "x" if is_corr else " "
            gt_tag = " <!-- GROUND_TRUTH: CORRECT -->" if is_corr else ""
            opt_body = opt.option_text
            if opt.image_url:
                opt_body += f" ![{opt.option_number}]({opt.image_url})"
            lines.append(f"- [{is_checked}] {opt.option_number}. {opt_body}{gt_tag}")
        lines.append("")

    # Provenance
    lines.append(f"<!-- PROVENANCE: {q.provenance} -->")
    if q.crop_image_url:
        lines.append(f"<!-- CROP_IMAGE: {q.crop_image_url} -->")

    lines.append("")
    lines.append("---")
    lines.append("")
    return "\n".join(lines)


def generate_refined_exam_markdown(
    title: str,
    pdf_path: str,
    refined_questions: List[RefinedQuestion],
    answer_key_entries: Optional[List[AnswerKeyEntry]] = None,
) -> str:
    """
    Generates structured Markdown from refined questions with complete KaTeX math formulas.
    """
    doc_lines: List[str] = []

    doc_lines.append(f"# {title} (KaTeX Math-Refined)")
    doc_lines.append("")
    doc_lines.append(f"> **Source**: `{Path(pdf_path).name}` | **Refined Questions**: `{len(refined_questions)}`")
    doc_lines.append("")
    doc_lines.append("---")
    doc_lines.append("")

    current_subject: Optional[str] = None
    for q in refined_questions:
        if q.subject and q.subject != current_subject:
            current_subject = q.subject
            doc_lines.append(f"# Section: {current_subject}")
            doc_lines.append("")
            doc_lines.append("---")
            doc_lines.append("")

        doc_lines.append(render_refined_question_markdown(q))

    if answer_key_entries:
        doc_lines.append("## Global Answer Key Table")
        doc_lines.append("")
        doc_lines.append("| Q.No | Correct Answer | Page | Confidence |")
        doc_lines.append("| :--- | :--- | :--- | :--- |")
        for ak in answer_key_entries:
            doc_lines.append(f"| {ak.question_number} | {ak.answer_value} | {ak.source_page} | {ak.confidence} |")
        doc_lines.append("")

    return "\n".join(doc_lines)


def render_question_markdown(q: QuestionBlock, include_context: bool = True) -> str:
    """
    Renders a single QuestionBlock into standardized Markdown format.
    """
    lines: List[str] = []

    # Optional Shared Comprehension Passage
    if include_context and q.shared_context:
        lines.append("> ### 📖 Shared Context / Comprehension Passage")
        for ctx_line in q.shared_context.split("\n"):
            lines.append(f"> {ctx_line.strip()}")
        lines.append("")

    # Question Header
    id_suffix = f" [ID: {q.question_id}]" if q.question_id else ""
    global_prefix = f" (Global Q{q.global_question_number})" if q.global_question_number else ""
    sec_prefix = f" [{q.section_name}]" if q.section_name else ""

    lines.append(f"## Question {q.question_number}{global_prefix}{sec_prefix}{id_suffix}")
    lines.append("")

    # Question Stem
    lines.append(q.question_text)
    lines.append("")

    # Diagrams/Figures (only if genuine figures are present)
    for img_path in q.diagram_image_paths:
        lines.append(f"![Question Figure]({img_path})")
        lines.append("")

    # Options with checkmarks and color provenance
    if q.options:
        lines.append("### Options")
        single_ans = str(q.detected_answer).strip() if q.detected_answer else None
        if not single_ans:
            for opt in q.options:
                if opt.is_correct_signal:
                    single_ans = str(opt.option_number).strip()
                    break

        for opt in q.options:
            is_corr = bool(single_ans and str(opt.option_number).strip() == single_ans)
            is_checked = "x" if is_corr else " "
            color_tag = f" <!-- color: {opt.color_bucket}"
            if is_corr:
                color_tag += ", GROUND_TRUTH: CORRECT"
            color_tag += " -->"

            opt_body = opt.option_text
            if opt.option_image_path:
                opt_body += f" ![{opt.option_number}]({opt.option_image_path})"

            lines.append(f"- [{is_checked}] {opt.option_number}. {opt_body}{color_tag}")
        lines.append("")

    # Deterministic metadata comments
    if q.detected_answer:
        lines.append(
            f"<!-- DETERMINISTIC_SIGNAL: Option {q.detected_answer} (source: {q.source}, confidence: {q.confidence}) -->"
        )

    meta_parts = []
    if q.status:
        meta_parts.append(f"Status: {q.status}")
    if q.chosen_option:
        meta_parts.append(f"Chosen Option: {q.chosen_option}")
    if q.source_page:
        meta_parts.append(f"Page: {q.source_page}")
    if q.section_name:
        meta_parts.append(f"Section: {q.section_name}")

    if meta_parts:
        lines.append(f"<!-- METADATA: {', '.join(meta_parts)} -->")

    lines.append("")
    lines.append("---")
    lines.append("")

    return "\n".join(lines)


def generate_exam_markdown(
    title: str,
    pdf_path: str,
    questions: List[QuestionBlock],
    answer_key_entries: Optional[List[AnswerKeyEntry]] = None,
) -> str:
    """
    Generates the complete Markdown representation of an entire exam document
    organized by sections and shared passages.
    """
    doc_lines: List[str] = []

    # Document Header
    doc_lines.append(f"# {title}")
    doc_lines.append("")
    doc_lines.append(f"> **Source**: `{Path(pdf_path).name}` | **Total Questions**: `{len(questions)}`")
    doc_lines.append("")
    doc_lines.append("---")
    doc_lines.append("")

    current_section: Optional[str] = None
    rendered_passages: Set[str] = set()

    # Render questions organized by section
    for q in questions:
        # Check if section changed
        if q.section_name and q.section_name != current_section:
            current_section = q.section_name
            doc_lines.append(f"# Section: {current_section}")
            doc_lines.append("")
            doc_lines.append("---")
            doc_lines.append("")

        # Check for shared passage (render once before child questions)
        if q.shared_context and q.shared_context not in rendered_passages:
            rendered_passages.add(q.shared_context)
            doc_lines.append("> ### 📖 Shared Context / Comprehension Passage")
            for p_line in q.shared_context.split("\n"):
                doc_lines.append(f"> {p_line.strip()}")
            doc_lines.append("")

        q_md = render_question_markdown(q, include_context=False)
        q.raw_markdown = q_md
        doc_lines.append(q_md)

    # Render global Answer Key if present
    if answer_key_entries:
        doc_lines.append("## Global Answer Key Table")
        doc_lines.append("")
        doc_lines.append("| Q.No | Correct Answer | Page | Confidence |")
        doc_lines.append("| :--- | :--- | :--- | :--- |")
        for ak in answer_key_entries:
            doc_lines.append(f"| {ak.question_number} | {ak.answer_value} | {ak.source_page} | {ak.confidence} |")
        doc_lines.append("")

    return "\n".join(doc_lines)


def save_markdown_file(markdown_content: str, output_path: Path) -> Path:
    """Saves markdown content to disk."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(markdown_content)
    return output_path
