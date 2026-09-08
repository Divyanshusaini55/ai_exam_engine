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

    # 2. Extract reading blocks before Answer Key
    pages_blocks = []
    for p_idx in range(len(doc)):
        page = doc[p_idx]
        blocks = page.get_text("blocks")
        for b in blocks:
            if b[6] != 0:
                continue
            txt = b[4]
            if "Answer Key" in txt:
                txt = txt[:txt.index("Answer Key")]
                if txt.strip():
                    pages_blocks.append((txt, p_idx + 1))
                break
            pages_blocks.append((txt, p_idx + 1))
        else:
            continue
        break

    raw_text = "\n".join(b[0] for b in pages_blocks)
    lines = [l.strip() for l in raw_text.split("\n") if l.strip()]

    clean_lines = []
    for l in lines:
        if any(hdr in l for hdr in ["Oswaal SSC CGL", "SOLVED PAPER", "Tier-I Year-wise", "COMBINED GRADUATE LEVEL", "Time Allotted:"]):
            continue
        if l.isdigit() and int(l) <= 20 and len(l) <= 2:
            continue
        clean_lines.append(l)

    # 3. Sequential Question State Machine with option protection
    questions_raw = []
    curr_q = None
    next_expected_q = 1
    curr_sec = "General Intelligence and Reasoning"

    for line in clean_lines:
        for s in ["General Intelligence and Reasoning", "General Awareness", "Quantitative Aptitude", "English Comprehension"]:
            if s.lower() in line.lower() and len(line) < 60:
                curr_sec = s
                break

        m_q = re.match(rf"^(?:[Qq](?:uestion)?[\.\s]*)?{next_expected_q}[\.\:\)\-][\t\s\u2000-\u200b]*(.*)", line)

        # When expecting next_expected_q <= 4, avoid mistaking options "2. 1775", "3. 1575", "4. 1375" for questions
        is_option = False
        if curr_q and next_expected_q <= 4:
            has_seen_opt_1 = any(re.match(r"^1\.[\t\s]+", l_inner) for l_inner in curr_q["raw_lines"])
            has_seen_opt_4 = any(re.match(r"^4\.[\t\s]+", l_inner) for l_inner in curr_q["raw_lines"])
            if has_seen_opt_1 and not has_seen_opt_4:
                is_option = True

        max_q = max((int(k) for k in ak_map.keys() if k.isdigit()), default=100)
        if m_q and not is_option and next_expected_q <= max_q:
            content = m_q.group(1).strip()
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
        for p_idx in range(len(doc)):
            page = doc[p_idx]
            page_num = p_idx + 1
            mid_x = page.rect.width / 2.0
            d = page.get_text("dict")
            headers = []
            for b in d.get("blocks", []):
                if "lines" not in b:
                    continue
                for l in b["lines"]:
                    txt = " ".join(s["text"] for s in l["spans"]).strip()
                    m = re.match(r"^(\d{1,3})\.[\t\s]+(.*)", txt)
                    is_margin = (l["bbox"][0] <= 75.0 or (310.0 <= l["bbox"][0] <= 315.0))
                    if m and is_margin and 1 <= int(m.group(1)) <= 100:
                        headers.append((int(m.group(1)), l["bbox"]))
            headers.sort(key=lambda x: (0 if (x[1][0] + x[1][2]) / 2.0 < mid_x else 1, x[1][1]))

            for i, (qn, bbox) in enumerate(headers):
                y0 = bbox[1]
                cx = (bbox[0] + bbox[2]) / 2.0
                is_left = cx < mid_x
                next_same_side = [h for h in headers[i + 1:] if ((h[1][0] + h[1][2]) / 2.0 < mid_x) == is_left]
                if next_same_side:
                    y1 = next_same_side[0][1][1] - 2.0
                else:
                    y1 = page.rect.height - 20.0

                col_x0 = 0.0 if is_left else mid_x - 10.0
                col_x1 = mid_x + 10.0 if is_left else page.rect.width
                if qn in [57, 58, 74]:
                    col_x0 = 0.0
                    col_x1 = page.rect.width

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
