"""
examintel - High-Speed Deterministic TCS / CBT Response Sheet Engine
===================================================================
Handles TCS iON, RRB CBT, and SSC CGL response sheet formats:
  - Formats: Q.<num> or Question <num>
  - Options: 1., 2., 3., 4.
  - Correct Answer: Matched via 16x16 green tick icons (e.g. xref 61, 368, 6, 8)
    spatially aligned with option Y-coordinates (distance < 5 pt).
  - High-res question crops (300 DPI) and diagram figure extraction.
"""

from __future__ import annotations
import re
import hashlib
from pathlib import Path
from typing import List, Tuple, Dict, Any, Optional

import fitz

from quiz.ai.examintel.models import (
    QuestionBlock,
    QuestionOption,
    ColorBucketType,
    AnswerSignalSource,
    AnswerSignalConfidence,
)


def detect_exam_marking_scheme(pdf_path: str) -> Tuple[float, float]:
    """
    Extracts positive and negative marks dynamically from the exam paper header/notes.
    Returns: (positive_marks, negative_marks)
    """
    try:
        doc = fitz.open(pdf_path)
        sample = " ".join(doc[i].get_text() for i in range(min(3, len(doc))))
        doc.close()

        pos_match = re.search(r"(?:carry|carries|marks?\s*for\s*correct)\s*([0-9\.]+)\s*marks?", sample, re.IGNORECASE)
        neg_match = re.search(r"([0-9\./]+)\s*(?:Negative|negative|deducted|minus)\s*marks?", sample)

        pos_marks = float(pos_match.group(1)) if pos_match else None
        neg_marks = None

        if neg_match:
            neg_str = neg_match.group(1)
            if "/" in neg_str:
                num, den = neg_str.split("/")
                neg_marks = round(float(num) / float(den), 2)
            else:
                neg_marks = float(neg_str)

        # Domain fallbacks based on exam type in filename/text
        lower_name = (Path(pdf_path).name + " " + sample[:300]).lower()
        if pos_marks is None:
            if "rrb" in lower_name or "railway" in lower_name:
                pos_marks = 1.0
            elif "cgl" in lower_name or "ssc" in lower_name or "chsl" in lower_name:
                pos_marks = 2.0
            elif "police" in lower_name:
                pos_marks = 2.5
            else:
                pos_marks = 2.0

        if neg_marks is None:
            if "rrb" in lower_name or "railway" in lower_name:
                neg_marks = 0.33
            elif "cgl" in lower_name or "ssc" in lower_name or "chsl" in lower_name:
                neg_marks = 0.5
            elif "police" in lower_name:
                neg_marks = 0.0
            else:
                neg_marks = 0.0

        return pos_marks, neg_marks
    except Exception:
        return 2.0, 0.5


def is_tcs_cbt_paper(pdf_path: str) -> bool:
    """Checks if the PDF is a TCS iON / CBT format response sheet (e.g. RRB NTPC, SSC CGL)."""
    try:
        doc = fitz.open(pdf_path)
        sample = " ".join(doc[i].get_text() for i in range(min(4, len(doc))))
        doc.close()
        has_q_num = bool(re.search(r"(?:^|\n)Q\.\d+", sample))
        has_ans = "Ans" in sample
        has_tick_note = "Options shown in green color with a tick icon" in sample or "Question ID" in sample
        return has_q_num and (has_ans or has_tick_note)
    except Exception:
        return False


def extract_tcs_cbt_questions(
    pdf_path: str,
    output_dir: Path,
    generate_crops: bool = True,
) -> Tuple[List[QuestionBlock], str]:
    """
    Extracts all questions, options, diagram figures, crops, and verified ground-truth
    answers from a TCS iON / CBT response sheet PDF.
    """
    doc = fitz.open(pdf_path)
    output_dir = Path(output_dir)
    assets_dir = output_dir / "assets"
    crops_dir = assets_dir / "crops"
    assets_dir.mkdir(parents=True, exist_ok=True)
    if generate_crops:
        crops_dir.mkdir(parents=True, exist_ok=True)

    doc_title = Path(pdf_path).stem
    current_section = "General"
    global_q_counter = 0
    questions: List[QuestionBlock] = []

    # Detect title and initial section from first page
    first_page_text = doc[0].get_text()
    for line in first_page_text.splitlines():
        line_s = line.strip()
        if "Section :" in line_s:
            current_section = line_s.split("Section :")[-1].strip()
        elif "Subject" in line_s and not doc_title:
            pass

    for page_idx in range(len(doc)):
        page = doc[page_idx]
        page_num = page_idx + 1

        # 1. Check for Section header on this page
        p_text = page.get_text()
        for line in p_text.splitlines():
            line_s = line.strip()
            if "Section :" in line_s:
                sec_val = line_s.split("Section :")[-1].strip()
                if sec_val:
                    current_section = sec_val

        # 2. Extract tick icons on this page (16x16 green tick icons)
        ticks: List[float] = []
        for img in page.get_image_info(xrefs=True):
            w, h = img.get("width", 0), img.get("height", 0)
            bbox = img.get("bbox", (0, 0, 0, 0))
            # 16x16 tick icon or known green checkmark xref
            if (w == 16 and h == 16) or (img.get("xref") in [6, 8, 61, 368]):
                y_center = (bbox[1] + bbox[3]) / 2.0
                ticks.append(y_center)

        # 2b. Extract green text positions (TCS iON color 0x40c64b or dominant green)
        green_y_centers: List[float] = []
        try:
            page_dict = page.get_text("dict")
            for b in page_dict.get("blocks", []):
                if "lines" in b:
                    for l in b["lines"]:
                        for s in l.get("spans", []):
                            c = s.get("color", 0)
                            r = (c >> 16) & 0xFF
                            g = (c >> 8) & 0xFF
                            bl = c & 0xFF
                            if c in (0x40c64b, 4245067, 0x008000, 0x228B22) or (g > 120 and g > (r + 30) and g > (bl + 30)):
                                s_bbox = s.get("bbox", (0, 0, 0, 0))
                                green_y_centers.append((s_bbox[1] + s_bbox[3]) / 2.0)
        except Exception:
            pass

        # 3. Catalog any diagram images on this page
        page_figures: List[Dict[str, Any]] = []
        for img in page.get_image_info(xrefs=True):
            xref = img.get("xref")
            w, h = img.get("width", 0), img.get("height", 0)
            bbox = img.get("bbox", (0, 0, 0, 0))
            # skip icons, banners, and watermarks
            if not xref or (w <= 32 and h <= 32) or w > 1800 or h > 1800:
                continue
            if xref in [61, 62, 368, 369, 660, 663, 666, 672]:
                continue
            try:
                base_img = doc.extract_image(xref)
                ext = base_img.get("ext", "png")
                filename = f"page_{page_num}_img_{xref}.png"
                filepath = assets_dir / filename
                if not filepath.exists():
                    if base_img.get("smask"):
                        try:
                            pix = fitz.Pixmap(doc, xref)
                            mask = fitz.Pixmap(doc, base_img["smask"])
                            pix = fitz.Pixmap(pix, mask)
                            if pix.n >= 5:
                                pix = fitz.Pixmap(fitz.csRGB, pix)
                            pix.save(str(filepath))
                        except Exception:
                            # Fallback to direct page clip
                            pix = page.get_pixmap(clip=fitz.Rect(bbox), dpi=150)
                            pix.save(str(filepath))
                    else:
                        with open(filepath, "wb") as f:
                            f.write(base_img["image"])

                content_hash = None
                if filepath.exists():
                    try:
                        with open(filepath, "rb") as f:
                            content_hash = hashlib.md5(f.read()).hexdigest()
                    except Exception:
                        pass

                page_figures.append({
                    "xref": xref,
                    "bbox": bbox,
                    "path": f"assets/{filename}",
                    "y0": bbox[1],
                    "y1": bbox[3],
                    "y_center": (bbox[1] + bbox[3]) / 2.0,
                    "content_hash": content_hash,
                })
            except Exception:
                continue

        # 4. Extract words with precise geometry
        # word = (x0, y0, x1, y1, word_str, block_no, line_no, word_no)
        words = page.get_text("words")
        if not words:
            continue

        # 5. Extract text blocks
        blocks = page.get_text("blocks")
        text_blocks = [b for b in blocks if b[6] == 0]
        text_blocks.sort(key=lambda b: (b[1], b[0]))

        # Find questions starting with Q.<number>
        q_block_groups: List[Dict[str, Any]] = []
        curr_group: Optional[Dict[str, Any]] = None
        pending_comprehension: Optional[str] = None

        for b in text_blocks:
            txt = b[4].strip()
            # Ignore page footer notes
            if "Correct Answer will carry" in txt or "Chosen option on the right" in txt:
                continue

            # Check if this block is a Comprehension passage or Directions header
            if re.search(r"^(?:Comprehension\s*:|Directions\s*(?:\([^\)]*\))?\s*:|SubQuestion\s*No\s*:|Case\s*Study)", txt, re.IGNORECASE):
                if curr_group:
                    q_block_groups.append(curr_group)
                    curr_group = None
                pending_comprehension = txt
                continue

            q_match = re.match(r"^Q\.(\d+)", txt)
            if q_match:
                if curr_group:
                    q_block_groups.append(curr_group)
                q_num = int(q_match.group(1))
                curr_group = {
                    "q_num": q_num,
                    "y0": b[1],
                    "y1": b[3],
                    "x0": b[0],
                    "x1": b[2],
                    "blocks": [b],
                    "shared_context": pending_comprehension,
                }
            elif curr_group:
                curr_group["blocks"].append(b)
                curr_group["y1"] = max(curr_group["y1"], b[3])
                curr_group["x1"] = max(curr_group["x1"], b[2])

        if curr_group:
            q_block_groups.append(curr_group)

        # 6. Parse each QuestionBlock
        for qg in q_block_groups:
            global_q_counter += 1
            q_num = qg["q_num"]

            # Merge text blocks
            full_text = "\n".join(b[4] for b in qg["blocks"]).strip()

            # Separate stem from answers
            if "\nAns\n" in full_text:
                stem_raw, ans_raw = full_text.split("\nAns\n", 1)
            elif "\nAns" in full_text:
                stem_raw, ans_raw = full_text.split("\nAns", 1)
            elif "Ans\n" in full_text:
                stem_raw, ans_raw = full_text.split("Ans\n", 1)
            else:
                stem_raw, ans_raw = full_text, ""

            # Clean Question Stem
            stem = re.sub(r"^Q\.\d+[\.\s]*", "", stem_raw).strip()

            # Find option numbers in words
            # Options in CBT sheets typically have '1.', '2.', '3.', '4.'
            # bounded vertically between qg["y0"] and qg["y1"]
            opt_words = [
                w for w in words
                if w[4] in ["1.", "2.", "3.", "4."]
                and qg["y0"] - 5 <= w[1] <= qg["y1"] + 5
                and w[0] < 120  # Left margin
            ]
            opt_words.sort(key=lambda w: w[1])

            # Parse option texts from ans_raw line-by-line (preventing empty option lookahead leakage)
            opt_dict: Dict[int, str] = {1: "", 2: "", 3: "", 4: ""}
            curr_opt: Optional[int] = None
            curr_text: List[str] = []

            for line in ans_raw.splitlines():
                l_strip = line.strip()
                if not l_strip:
                    continue
                # If a leaked comprehension header is encountered in ans_raw, break immediately!
                if re.match(r"^(?:Comprehension\s*:|Directions\s*(?:\([^\)]*\))?\s*:|SubQuestion\s*No\s*:|Case\s*Study)", l_strip, re.IGNORECASE):
                    break
                m = re.match(r"^([1-4])\.\s*(.*)", l_strip)
                if m:
                    if curr_opt is not None:
                        opt_dict[curr_opt] = "\n".join(curr_text).strip()
                    curr_opt = int(m.group(1))
                    rest = m.group(2).strip()
                    curr_text = [rest] if rest else []
                elif curr_opt is not None:
                    curr_text.append(l_strip)

            if curr_opt is not None:
                opt_dict[curr_opt] = "\n".join(curr_text).strip()

            # Construct QuestionOptions and match tick
            options: List[QuestionOption] = []
            detected_answer: Optional[str] = None

            for ow in opt_words:
                try:
                    num_val = int(ow[4].replace(".", "").strip())
                except ValueError:
                    continue

                raw_opt_txt = opt_dict.get(num_val, "")
                # Clean any accidental leading "Option X" or "X." text
                clean_opt_txt = re.sub(rf"^(?:Option\s*)?{num_val}[\.\:\s]*", "", raw_opt_txt, flags=re.IGNORECASE).strip()
                clean_opt_txt = re.sub(r"^Option\s*\d+[\.\:\s]*", "", clean_opt_txt, flags=re.IGNORECASE).strip()
                clean_opt_txt = re.sub(r"(?im)(?:\n\s*|\s+)(?:Comprehension\s*:|Directions\s*(?:\([^\)]*\))?\s*:|SubQuestion\s*No\s*:|Case\s*Study)[\s\S]*", "", clean_opt_txt).strip()
                clean_opt_txt = re.sub(r"(?im)\bComprehension\s*:[\s\S]*", "", clean_opt_txt).strip()

                opt_y_center = (ow[1] + ow[3]) / 2.0

                # Check if closest tick is within 6 points OR closest green text is within 8 points
                is_correct = False
                if ticks:
                    min_tick_dist = min(abs(t - opt_y_center) for t in ticks)
                    if min_tick_dist <= 6.0:
                        is_correct = True
                        detected_answer = str(num_val)

                if not is_correct and green_y_centers:
                    min_green_dist = min(abs(gy - opt_y_center) for gy in green_y_centers)
                    if min_green_dist <= 8.0:
                        is_correct = True
                        detected_answer = str(num_val)

                options.append(
                    QuestionOption(
                        option_number=str(num_val),
                        option_text=clean_opt_txt,
                        is_correct_signal=is_correct,
                        color_bucket="green_family" if is_correct else "neutral",
                    )
                )

            # Deduplicate options by option_number
            seen_nums = set()
            unique_options = []
            for opt in options:
                if opt.option_number not in seen_nums:
                    seen_nums.add(opt.option_number)
                    unique_options.append(opt)
            options = unique_options

            # Fallback if opt_words missed any options but opt_dict found them
            if len(options) < len(opt_dict):
                for num_val, opt_text in sorted(opt_dict.items()):
                    num_str = str(num_val)
                    if num_str not in seen_nums:
                        options.append(
                            QuestionOption(
                                option_number=num_str,
                                option_text=opt_text,
                                is_correct_signal=False,
                                color_bucket="neutral",
                            )
                        )
                options.sort(key=lambda o: int(o.option_number) if o.option_number.isdigit() else 99)

            # Separate Question Stem figures vs Option images with MD5 hash deduplication
            q_diagrams = []
            ans_y_start = min((w[1] for w in opt_words), default=qg["y1"])

            # Map option index to vertical range
            opt_y_ranges: List[Tuple[int, float, float]] = []
            for idx, ow in enumerate(opt_words):
                try:
                    o_num = int(ow[4].replace(".", "").strip())
                except ValueError:
                    continue
                next_y = opt_words[idx + 1][1] if idx + 1 < len(opt_words) else (qg["y1"] + 15)
                opt_y_ranges.append((o_num, ow[1] - 8, next_y))

            seen_fig_hashes = set()
            for fig in page_figures:
                if not (qg["y0"] - 5 <= fig["y_center"] <= qg["y1"] + 5):
                    continue

                c_hash = fig.get("content_hash")
                if c_hash:
                    if c_hash in seen_fig_hashes:
                        continue
                    seen_fig_hashes.add(c_hash)

                if fig["y_center"] < (ans_y_start - 3):
                    # Diagram belongs to the Question Stem
                    if fig["path"] not in q_diagrams:
                        q_diagrams.append(fig["path"])
                else:
                    # Diagram belongs to an Option
                    for o_num, y_low, y_high in opt_y_ranges:
                        if y_low <= fig["y_center"] <= y_high:
                            for opt in options:
                                if opt.option_number == str(o_num):
                                    opt.option_image_path = fig["path"]
                            break

            # High-res question bounding box crop (300 DPI)
            crop_path = None
            if generate_crops:
                try:
                    # Clip coordinates safely
                    clip_rect = fitz.Rect(
                        max(0, qg["x0"] - 10),
                        max(0, qg["y0"] - 5),
                        min(page.rect.width, page.rect.width - 20),
                        min(page.rect.height, qg["y1"] + 10),
                    )
                    crop_filename = f"q_{global_q_counter}_p{page_num}.png"
                    crop_file = crops_dir / crop_filename
                    if not crop_file.exists():
                        pix = page.get_pixmap(dpi=300, clip=clip_rect)
                        pix.save(str(crop_file))
                    crop_path = f"assets/crops/{crop_filename}"
                except Exception:
                    pass

            q_block = QuestionBlock(
                question_number=str(q_num),
                global_question_number=global_q_counter,
                section_name=current_section,
                shared_context=qg.get("shared_context"),
                question_text=stem,
                options=options,
                detected_answer=detected_answer,
                source_page=page_num,
                crop_image_path=crop_path,
                diagram_image_paths=q_diagrams,
                source="inline_color_marker" if detected_answer else "none",
                confidence="high" if detected_answer else "none",
            )
            questions.append(q_block)

    doc.close()
    return questions, doc_title
