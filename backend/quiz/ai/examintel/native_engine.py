from __future__ import annotations
import os
import re
from pathlib import Path
from typing import List, Dict, Tuple, Optional
import fitz

from quiz.ai.examintel.models import (
    QuestionBlock,
    QuestionOption,
    AnswerKeyEntry,
    AnswerSignalSource,
    AnswerSignalConfidence,
    ColorBucketType,
)


MAX_CROP_DPI: int = 300


def extract_native_exam_questions(
    pdf_path: str,
    output_dir: Optional[Path] = None,
) -> Tuple[List[QuestionBlock], str, List[AnswerKeyEntry]]:

    doc = fitz.open(pdf_path)
    doc_title = Path(pdf_path).stem

    crops_dir: Optional[Path] = None
    if output_dir:
        crops_dir = Path(output_dir) / "assets" / "crops"
        crops_dir.mkdir(parents=True, exist_ok=True)

    # 1. Detect Answer Key Section across pages
    ak_map: Dict[str, str] = {}
    ak_entries: List[AnswerKeyEntry] = []
    question_pages_text = ""

    for p_idx in range(len(doc)):
        page_text = doc[p_idx].get_text()
        if "Answer Key" in page_text:
            ak_section = page_text[page_text.index("Answer Key"):]
            matches = re.findall(r"(\d{1,3})\.\s*\((\d|[A-Da-d])\)", ak_section)
            for q_num, ans_val in matches:
                ak_map[q_num] = ans_val.upper()
                ak_entries.append(
                    AnswerKeyEntry(
                        question_number=q_num,
                        answer_value=ans_val.upper(),
                        source_page=p_idx + 1,
                        confidence="high",
                    )
                )
            question_pages_text += "\n" + page_text[:page_text.index("Answer Key")]
            break
        else:
            question_pages_text += "\n" + page_text

    if not ak_map:
        for p_idx in range(len(doc)):
            page_text = doc[p_idx].get_text()
            matches = re.findall(r"(\d{1,3})\.\s*\((\d|[A-Da-d])\)", page_text)
            if len(matches) >= 10:
                for q_num, ans_val in matches:
                    if q_num not in ak_map:
                        ak_map[q_num] = ans_val.upper()
                        ak_entries.append(
                            AnswerKeyEntry(
                                question_number=q_num,
                                answer_value=ans_val.upper(),
                                source_page=p_idx + 1,
                                confidence="high",
                            )
                        )

    # 2. Filter lines & track sections
    raw_lines = [l.strip() for l in question_pages_text.split("\n") if l.strip()]
    filtered_lines = []

    for l in raw_lines:
        if any(hdr in l for hdr in ["Oswaal SSC CGL", "SOLVED PAPER (12th September 2025", "Tier-I Year-wise"]):
            continue
        if l.isdigit() and int(l) <= 15 and len(l) <= 2:
            continue
        filtered_lines.append(l)

    # 3. Sequential Question State Machine with flexible Q-prefixes and inline answer extraction
    questions_raw = []
    curr_q = None
    next_expected_q = 1
    curr_sec = "General Intelligence and Reasoning"

    for line in filtered_lines:
        for s in ["General Intelligence and Reasoning", "General Awareness", "Quantitative Aptitude", "English Comprehension"]:
            if s.lower() in line.lower() and len(line) < 60:
                curr_sec = s
                break

        m_start = re.match(rf"^(?:[Qq](?:uestion)?[\.\s]*)?{next_expected_q}[\.\:\)\-]\s*(.*)", line)
        if m_start:
            content = m_start.group(1).strip()
            # If line is an option list inside a table, skip
            if re.search(r"\t\s*[1-4]\.\s+", content):
                pass
            else:
                if curr_q:
                    questions_raw.append(curr_q)
                curr_q = {
                    "num": str(next_expected_q),
                    "sec": curr_sec,
                    "first_line": content,
                    "raw_lines": [],
                    "inline_ans": None,
                }
                next_expected_q += 1
                continue

        if curr_q:
            m_ans = re.match(r"^Ans[\.\:\s]*\(?([A-Da-d1-4])\)?", line, re.IGNORECASE)
            if m_ans:
                curr_q["inline_ans"] = m_ans.group(1).upper()
            else:
                curr_q["raw_lines"].append(line)

    if curr_q:
        questions_raw.append(curr_q)

    # 4. Generate Individual 300 DPI Question Crops across all document pages
    q_crop_map: Dict[str, str] = {}
    if output_dir and crops_dir:
        crop_expected_q = 1
        for p_idx in range(len(doc)):
            page = doc[p_idx]
            page_num = p_idx + 1
            mid_x = page.rect.width / 2.0
            text_dict = page.get_text("dict")

            col0_lines = []
            col1_lines = []
            for b in text_dict.get("blocks", []):
                if "lines" not in b:
                    continue
                for l in b["lines"]:
                    txt = " ".join(s["text"] for s in l["spans"]).strip()
                    if not txt:
                        continue
                    cx = (l["bbox"][0] + l["bbox"][2]) / 2.0
                    if cx < mid_x:
                        col0_lines.append((l["bbox"], txt))
                    else:
                        col1_lines.append((l["bbox"], txt))

            col0_lines.sort(key=lambda x: x[0][1])
            col1_lines.sort(key=lambda x: x[0][1])

            for col_idx, col_lines in enumerate([col0_lines, col1_lines]):
                col_x0 = 0.0 if col_idx == 0 else mid_x - 10.0
                col_x1 = mid_x + 10.0 if col_idx == 0 else page.rect.width

                curr_col_qs = []
                for l_idx, (bbox, txt) in enumerate(col_lines):
                    if "Answer Key" in txt:
                        break
                    m = re.match(rf"^(?:[Qq](?:uestion)?[\.\s]*)?{crop_expected_q}[\.\:\)\-][\t\s\u2000-\u200b]*(.*)", txt)
                    if m:
                        content = m.group(1).strip()
                        if re.search(r"\t\s*[1-4]\.\s+", content):
                            continue
                        curr_col_qs.append((crop_expected_q, bbox[1], l_idx))
                        crop_expected_q += 1

                for i, (qn, y0, l_idx) in enumerate(curr_col_qs):
                    if i + 1 < len(curr_col_qs):
                        y1 = curr_col_qs[i+1][1] - 2.0
                    else:
                        y1 = col_lines[-1][0][3] + 10.0 if col_lines else page.rect.height
                        ak_y = [l[0][1] for l in col_lines if "Answer Key" in l[1]]
                        if ak_y:
                            y1 = min(y1, ak_y[0] - 5.0)

                    try:
                        clip_rect = fitz.Rect(col_x0, max(0.0, y0 - 4.0), col_x1, min(page.rect.height, y1 + 4.0))
                        crop_pix = page.get_pixmap(clip=clip_rect, dpi=MAX_CROP_DPI)
                        crop_file = crops_dir / f"q_{qn}_p{page_num}.png"
                        crop_pix.save(str(crop_file))
                        q_crop_map[str(qn)] = str(crop_file.relative_to(output_dir))
                    except Exception:
                        pass

    # 5. Build Structured QuestionBlocks
    final_question_blocks: List[QuestionBlock] = []

    # Map numbers 1->A, 2->B, 3->C, 4->D for robust comparisons
    num_to_alpha = {"1": "A", "2": "B", "3": "C", "4": "D"}
    alpha_to_num = {"A": "1", "B": "2", "C": "3", "D": "4"}

    for q_data in questions_raw:
        q_num_str = q_data["num"]
        q_sec = q_data["sec"]
        body_joined = "\n".join([q_data["first_line"]] + q_data["raw_lines"])

        opt_tokens = re.split(r"(?=(?:^|\t|\n|\s{2,})(?:[1-4]\.|\([A-Da-d1-4]\))\s*)", body_joined)
        stem_parts = []
        raw_options = []

        for tok in opt_tokens:
            tok = tok.strip()
            m_opt = re.match(r"^(?:([1-4])\.|\(([A-Da-d1-4])\))\s*(.*)", tok, re.DOTALL)
            if m_opt:
                lbl = (m_opt.group(1) or m_opt.group(2)).upper()
                raw_options.append((lbl, m_opt.group(3).strip()))
            elif not raw_options:
                stem_parts.append(tok)

        if len(raw_options) > 4:
            stem_parts.extend([f"{lbl}. {b}" for lbl, b in raw_options[:-4]])
            raw_options = raw_options[-4:]

        clean_stem = " ".join(stem_parts).strip()
        correct_val = (ak_map.get(q_num_str) or q_data.get("inline_ans") or "").upper()

        q_options: List[QuestionOption] = []
        for opt_lbl, opt_text in raw_options:
            norm_opt = opt_lbl.upper()
            is_correct = False
            if correct_val:
                if norm_opt == correct_val:
                    is_correct = True
                elif num_to_alpha.get(norm_opt) == correct_val or alpha_to_num.get(norm_opt) == correct_val:
                    is_correct = True

            col_b: ColorBucketType = "green_family" if is_correct else "red_family"
            q_options.append(
                QuestionOption(
                    option_number=opt_lbl,
                    option_text=opt_text,
                    color_bucket=col_b,
                    is_correct_signal=is_correct,
                )
            )

        source: AnswerSignalSource = "answer_key_section" if correct_val else "none"
        conf: AnswerSignalConfidence = "high" if correct_val else "none"

        final_question_blocks.append(
            QuestionBlock(
                question_number=q_num_str,
                global_question_number=int(q_num_str) if q_num_str.isdigit() else len(final_question_blocks) + 1,
                section_name=q_sec,
                question_text=clean_stem if clean_stem else f"Question {q_num_str}",
                options=q_options,
                detected_answer=correct_val if correct_val else None,
                source=source,
                confidence=conf,
                crop_image_path=q_crop_map.get(q_num_str),
            )
        )

    doc.close()
    return final_question_blocks, doc_title, ak_entries
