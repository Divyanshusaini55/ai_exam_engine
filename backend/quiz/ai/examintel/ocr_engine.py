from __future__ import annotations
import os
import re
from pathlib import Path
from typing import List, Dict, Optional, Tuple, Any
import fitz
import numpy as np
from PIL import Image
import pytesseract

from quiz.ai.examintel.models import (
    QuestionBlock,
    QuestionOption,
    ColorBucketType,
    AnswerSignalSource,
    AnswerSignalConfidence,
)


OCR_RENDER_DPI: int = 300


MAX_CROP_DPI: int = 300


MIN_DIAGRAM_WIDTH: int = 40
MIN_DIAGRAM_HEIGHT: int = 20


def extract_and_catalog_images(
    doc: fitz.Document,
    assets_dir: Path,
) -> Dict[Tuple[int, int], str]:
    assets_dir.mkdir(parents=True, exist_ok=True)
    image_map: Dict[Tuple[int, int], str] = {}

    for page_idx in range(len(doc)):
        page = doc[page_idx]
        page_num = page_idx + 1
        for img_info in page.get_image_info(xrefs=True):
            xref = img_info.get("xref")
            if not xref or xref in [5, 6, 8]:
                continue

            try:
                base_img = doc.extract_image(xref)
                w = base_img.get("width", 0)
                h = base_img.get("height", 0)
                ext = base_img.get("ext", "png")

                if w < MIN_DIAGRAM_WIDTH or h < MIN_DIAGRAM_HEIGHT:
                    continue

                key = (page_idx, xref)
                if key not in image_map:
                    filename = f"page_{page_num}_img_{xref}.{ext}"
                    file_path = assets_dir / filename
                    with open(file_path, "wb") as f:
                        f.write(base_img["image"])
                    image_map[key] = str(file_path.relative_to(assets_dir.parent))
            except Exception:
                continue

    return image_map


def _clean_option_text(text: str) -> str:
    clean = text.strip()
    clean = re.sub(r"\b(?:Question\s*ID|Status|Chosen\s*Option)\s*[:=].*$", "", clean, flags=re.IGNORECASE).strip()
    clean = re.sub(r"^(?:Ans\s*)?(?:[^\d\.\n]{0,8}|\b\d\b\s+)?[1-4]\.\s*", "", clean).strip()
    return clean


def _sanitize_question_stem(stem_lines: List[str]) -> str:
    full_stem = "\n".join(l.strip() for l in stem_lines if l.strip()).strip()
    full_stem = re.sub(r"^[Qq](?:uestion)?[\.\s]*\d{1,4}[\.\:\-\s]*", "", full_stem).strip()
    full_stem = re.sub(r"\b(?:Question\s*ID|Status|Chosen\s*Option)\s*[:=].*$", "", full_stem, flags=re.IGNORECASE).strip()
    # Strip exam header metadata if at the very beginning of the document
    full_stem = re.sub(r"^.*?Tier\s*\|\s*\d{4}\s*", "", full_stem, flags=re.DOTALL | re.IGNORECASE).strip()
    full_stem = re.sub(r"^.*?Section\s*:\s*[A-Za-z\s&]+\s*", "", full_stem, flags=re.DOTALL | re.IGNORECASE).strip()
    full_stem = re.sub(r"^[Qq](?:uestion)?[\.\s]*\d{1,4}[\.\:\-\s]*", "", full_stem).strip()
    return full_stem


def extract_questions_from_pdf(
    pdf_path: str,
    output_dir: Path,
) -> Tuple[List[QuestionBlock], str]:
    output_dir = Path(output_dir)
    doc = fitz.open(pdf_path)
    assets_dir = output_dir / "assets"
    assets_dir.mkdir(parents=True, exist_ok=True)

    image_catalog = extract_and_catalog_images(doc, assets_dir)
    all_questions: List[QuestionBlock] = []
    doc_title = Path(pdf_path).stem

    current_section: Optional[str] = None
    current_comprehension_passage: Optional[str] = None

    try:
        first_page_text = doc[0].get_text().strip()
        if first_page_text:
            t_lines = [l.strip() for l in first_page_text.split("\n") if l.strip()]
            if t_lines:
                doc_title = t_lines[0]

        for page_idx in range(len(doc)):
            page_num = page_idx + 1
            page = doc[page_idx]

            pix = page.get_pixmap(dpi=OCR_RENDER_DPI)
            page_img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
            scale_y = pix.height / page.rect.height
            scale_x = pix.width / page.rect.width

            # 1. Collect Icons and Diagram Figures on this page
            page_icons: List[Dict[str, Any]] = []
            page_figures: List[Dict[str, Any]] = []

            for info in page.get_image_info(xrefs=True):
                xref = info.get("xref")
                if not xref:
                    continue
                bbox = info["bbox"]
                w, h = info["width"], info["height"]
                y_center = (bbox[1] + bbox[3]) / 2.0

                if xref in [5, 6, 8]:
                    color_type = "green_family" if xref in [6, 8] else "red_family"
                    is_correct = (xref in [6, 8])
                    page_icons.append({
                        "y": y_center,
                        "color": color_type,
                        "is_correct": is_correct,
                        "xref": xref,
                        "bbox": bbox,
                    })
                elif w >= MIN_DIAGRAM_WIDTH and h >= MIN_DIAGRAM_HEIGHT:
                    rel_path = image_catalog.get((page_idx, xref))
                    if rel_path:
                        page_figures.append({
                            "xref": xref,
                            "bbox": bbox,
                            "y0": bbox[1],
                            "y1": bbox[3],
                            "path": rel_path,
                            "width": w,
                            "height": h,
                        })

            page_figures.sort(key=lambda f: f["y0"])
            page_icons.sort(key=lambda ic: ic["y"])

            # 2. Run OCR and reconstruct lines with exact Y coordinates
            ocr_data = pytesseract.image_to_data(page_img, output_type=pytesseract.Output.DICT)
            raw_lines: List[Dict[str, Any]] = []
            curr_tokens: List[str] = []
            min_y, max_y = 999999.0, 0.0
            last_line_id = None

            q_anchors: List[Tuple[float, str]] = []

            for i in range(len(ocr_data["text"])):
                tok = ocr_data["text"][i].strip()
                if not tok:
                    continue

                l_id = (ocr_data["block_num"][i], ocr_data["par_num"][i], ocr_data["line_num"][i])
                y0 = ocr_data["top"][i] / scale_y
                y1 = (ocr_data["top"][i] + ocr_data["height"][i]) / scale_y

                # Detect Question ID Anchor
                if tok == "Question" and i + 2 < len(ocr_data["text"]) and ocr_data["text"][i + 1].strip() == "ID":
                    qid_val = ""
                    if i + 3 < len(ocr_data["text"]) and ocr_data["text"][i + 2].strip() == ":":
                        qid_val = ocr_data["text"][i + 3].strip()
                    q_anchors.append((y1, qid_val))

                if l_id != last_line_id and curr_tokens:
                    raw_lines.append({
                        "text": " ".join(curr_tokens),
                        "y0": min_y,
                        "y1": max_y,
                    })
                    curr_tokens = []
                    min_y, max_y = 999999.0, 0.0

                curr_tokens.append(tok)
                min_y = min(min_y, y0)
                max_y = max(max_y, y1)
                last_line_id = l_id

            if curr_tokens:
                raw_lines.append({
                    "text": " ".join(curr_tokens),
                    "y0": min_y,
                    "y1": max_y,
                })

            # Check Section and Comprehension headers across raw lines
            for l_item in raw_lines:
                t = l_item["text"]
                sec_match = re.search(r"Section\s*:\s*([A-Za-z\s&]+)", t, re.I)
                if sec_match:
                    sec_name = sec_match.group(1).strip()
                    if len(sec_name) >= 4:
                        current_section = sec_name
                        current_comprehension_passage = None

                comp_match = re.search(r"Comprehension\s*:\s*(.*)", t, re.I)
                if comp_match:
                    passage_head = comp_match.group(1).strip()
                    current_comprehension_passage = passage_head if passage_head else ""

            # 3. Create Question Bounding Bands
            if not q_anchors:
                q_anchors = [(page.rect.height, "")]

            prev_y = 0.0
            for anchor_idx, (y_qid, qid_from_anchor) in enumerate(q_anchors):
                q_band_start = prev_y
                q_band_end = y_qid + 35.0 if anchor_idx + 1 < len(q_anchors) else page.rect.height
                prev_y = q_band_end

                q_lines = [l for l in raw_lines if q_band_start <= l["y0"] < q_band_end]
                q_figures = [f for f in page_figures if q_band_start <= f["y0"] < q_band_end]
                q_icons = [ic for ic in page_icons if q_band_start <= ic["y"] < q_band_end]

                # Parse question number, stem, options, status, chosen
                stem_parts: List[str] = []
                q_num_detected: Optional[str] = None
                q_id_detected = qid_from_anchor
                status_val: Optional[str] = None
                chosen_val: Optional[str] = None
                text_options: Dict[str, QuestionOption] = {}
                saw_ans = False

                for l_info in q_lines:
                    lt = l_info["text"].strip()

                    # Extract Q# from line if present
                    m_sub = re.search(r"SubQuestion\s*No\s*:\s*(\d+)", lt, re.I)
                    m_qnum = re.search(r"^[Qq](?:uestion)?[\.\s]*(\d{1,4})", lt)
                    if m_sub and not q_num_detected:
                        q_num_detected = m_sub.group(1)
                    elif m_qnum and not q_num_detected:
                        q_num_detected = m_qnum.group(1)

                    # Extract Metadata
                    m_qid = re.search(r"Question\s*ID\s*:\s*(\d+)", lt, re.I)
                    if m_qid:
                        q_id_detected = m_qid.group(1)
                        continue
                    m_st = re.search(r"Status\s*:\s*([A-Za-z\s]+)", lt, re.I)
                    if m_st:
                        status_val = m_st.group(1).strip()
                        continue
                    m_ch = re.search(r"Chosen\s*Option\s*:\s*([\d\-]+)", lt, re.I)
                    if m_ch:
                        chosen_val = m_ch.group(1).strip()
                        continue

                    # Check for Ans token boundary
                    if re.search(r"\b(?:Ans|ANS)\b", lt):
                        saw_ans = True

                    # Match Option ONLY after Ans token
                    opt_m = re.search(r"(?:^|\b)(?:Ans\s*)?(?:[^\d\.\n]{0,8}|\b\d\b\s+)?([1-4])\.\s*(.*)$", lt)
                    if saw_ans and opt_m:
                        opt_n = opt_m.group(1)
                        opt_body = _clean_option_text(opt_m.group(2))

                        text_options[opt_n] = QuestionOption(
                            option_number=opt_n,
                            option_text=opt_body,
                            color_bucket="neutral",
                            is_correct_signal=False,
                        )
                        continue

                    if saw_ans and text_options:
                        last_k = sorted(text_options.keys())[-1]
                        c_text = _clean_option_text(lt)
                        if c_text:
                            text_options[last_k].option_text = (
                                text_options[last_k].option_text + " " + c_text
                            ).strip()
                    elif not saw_ans:
                        # Stem line (including any statement or conclusion lists before Ans)
                        if not re.search(r"(?:Question\s*ID|Status|Chosen\s*Option|Section\s*:)", lt, re.I):
                            stem_parts.append(lt)

                # Determine Options and Diagrams
                final_diagram_paths: List[str] = []
                final_options: List[QuestionOption] = []

                if len(q_figures) >= 4 and not text_options:
                    # Pure image options (e.g. mirror images, series figures)
                    if len(q_figures) == 5:
                        final_diagram_paths.append(q_figures[0]["path"])
                        opt_figs = q_figures[1:5]
                    else:
                        opt_figs = q_figures[:4]

                    for opt_idx, ofig in enumerate(opt_figs):
                        opt_num_str = str(opt_idx + 1)
                        final_options.append(
                            QuestionOption(
                                option_number=opt_num_str,
                                option_text="",
                                option_image_path=ofig["path"],
                                color_bucket="neutral",
                                is_correct_signal=False,
                            )
                        )
                else:
                    # Text options (with optional stem diagram)
                    for fig in q_figures:
                        final_diagram_paths.append(fig["path"])
                    for opt_k in sorted(text_options.keys()):
                        final_options.append(text_options[opt_k])

                # 4. Strict 1-to-1 Icon to Option Mapping
                # Green checkmarks and Red crosses are ordered vertically from top to bottom
                if final_options and q_icons:
                    if len(final_options) == len(q_icons):
                        for opt, ic in zip(final_options, q_icons):
                            opt.color_bucket = ic["color"]
                            opt.is_correct_signal = ic["is_correct"]
                    else:
                        # Map each icon to its nearest unassigned option
                        green_ics = [ic for ic in q_icons if ic["is_correct"]]
                        # Ensure AT MOST ONE option is marked green
                        if green_ics:
                            # Pick the first green icon and assign to corresponding option
                            g_ic = green_ics[0]
                            # Find matching index or nearest
                            green_opt_idx = min(range(len(final_options)), key=lambda idx: abs(idx - (len(final_options) * (g_ic["y"] - q_band_start) / max(1.0, q_band_end - q_band_start))))
                            for idx, opt in enumerate(final_options):
                                if idx == green_opt_idx:
                                    opt.color_bucket = "green_family"
                                    opt.is_correct_signal = True
                                else:
                                    opt.color_bucket = "red_family"
                                    opt.is_correct_signal = False
                        else:
                            for opt in final_options:
                                opt.color_bucket = "red_family"
                                opt.is_correct_signal = False

                # Determine Ground-Truth Answer
                detected_ans = None
                source: AnswerSignalSource = "none"
                confidence: AnswerSignalConfidence = "none"

                green_opts = [o.option_number for o in final_options if o.color_bucket == "green_family" or o.is_correct_signal]
                red_opts = [o.option_number for o in final_options if o.color_bucket == "red_family"]
                non_red = [o.option_number for o in final_options if o.color_bucket != "red_family"]

                if len(green_opts) == 1:
                    detected_ans = green_opts[0]
                    source = "inline_color_marker"
                    confidence = "high"
                elif len(green_opts) > 1:
                    # Pick the first green option
                    detected_ans = green_opts[0]
                    source = "inline_color_marker"
                    confidence = "medium"
                elif len(red_opts) >= 2 and len(non_red) == 1 and len(final_options) >= 2:
                    detected_ans = non_red[0]
                    source = "inline_color_marker"
                    confidence = "high"

                # Enforce strictly single-choice correct option across all options
                for opt in final_options:
                    opt.is_correct_signal = bool(detected_ans and str(opt.option_number) == str(detected_ans))

                clean_stem = _sanitize_question_stem(stem_parts)
                final_q_num = q_num_detected or str(len(all_questions) + 1)
                global_idx = len(all_questions) + 1

                # 5. Save Max-Resolution Crop of Question Bounding Box (300 DPI)
                crops_dir = assets_dir / "crops"
                crops_dir.mkdir(parents=True, exist_ok=True)
                crop_rel_path: Optional[str] = None
                try:
                    clip_y0 = max(0.0, q_band_start - 2.0)
                    clip_y1 = min(page.rect.height, q_band_end + 2.0)
                    if clip_y1 > clip_y0 + 5.0:
                        clip_rect = fitz.Rect(0, clip_y0, page.rect.width, clip_y1)
                        crop_pix = page.get_pixmap(clip=clip_rect, dpi=MAX_CROP_DPI)
                        crop_filename = f"q_{global_idx}_p{page_num}.png"
                        crop_filepath = crops_dir / crop_filename
                        crop_pix.save(str(crop_filepath))
                        crop_rel_path = str(crop_filepath.relative_to(output_dir))
                except Exception:
                    crop_rel_path = None

                all_questions.append(
                    QuestionBlock(
                        question_number=final_q_num,
                        global_question_number=global_idx,
                        question_id=q_id_detected,
                        section_name=current_section,
                        shared_context=current_comprehension_passage,
                        question_text=clean_stem if clean_stem else f"Question {final_q_num}",
                        options=final_options,
                        diagram_image_paths=final_diagram_paths,
                        detected_answer=detected_ans,
                        source=source,
                        confidence=confidence,
                        status=status_val,
                        chosen_option=chosen_val,
                        source_page=page_num,
                        crop_image_path=crop_rel_path,
                    )
                )

    finally:
        doc.close()

    return all_questions, doc_title
