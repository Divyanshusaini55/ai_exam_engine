from __future__ import annotations
import os
import re
import hashlib
from pathlib import Path
from typing import List, Dict, Tuple, Optional, Any
import fitz

from quiz.ai.examintel.models import (
    QuestionBlock,
    QuestionOption,
    AnswerKeyEntry,
    AnswerSignalSource,
    AnswerSignalConfidence,
)
from quiz.ai.examintel.indic_font_repair import repair_indic_text


def is_candidate_response_sheet(pdf_path: str) -> bool:
    """Checks if PDF is a candidate response sheet like UP Police SI (Question No. X, Chosen option, Correct Answer)."""
    try:
        doc = fitz.open(pdf_path)
        sample = " ".join(doc[i].get_text() for i in range(min(4, len(doc))))
        doc.close()
        return "Question No." in sample or ("Chosen option" in sample and "(Correct Answer)" in sample)
    except Exception:
        return False


def extract_candidate_response_questions(
    pdf_path: str,
    output_dir: Optional[Path] = None,
    generate_crops: bool = True,
) -> Tuple[List[QuestionBlock], str]:
    """
    Extracts structured question blocks from candidate response sheets / test papers
    where questions have selectable text, diagram figures, and structured question markers.
    Accurately extracts all visual diagrams, option figures, and 300 DPI crops.
    """
    doc = fitz.open(pdf_path)
    doc_title = Path(pdf_path).stem

    assets_dir = (output_dir or Path(pdf_path).parent) / "assets"
    crops_dir = assets_dir / "crops"
    assets_dir.mkdir(parents=True, exist_ok=True)
    crops_dir.mkdir(parents=True, exist_ok=True)

    # 1. Extract and catalog all page diagrams (filtering header logos and tiny icons)
    page_figures: Dict[int, List[Dict[str, Any]]] = {}
    for page_idx in range(len(doc)):
        p_num = page_idx + 1
        page = doc[page_idx]
        figs: List[Dict[str, Any]] = []
        for img in page.get_image_info(xrefs=True):
            xref = img.get("xref")
            w, h = img.get("width", 0), img.get("height", 0)
            bbox = img.get("bbox", (0, 0, 0, 0))
            # Filter header banners, logos, tiny icons, and full-page advertisements
            is_full_page = (bbox[2] - bbox[0] > 0.8 * page.rect.width) and (bbox[3] - bbox[1] > 0.8 * page.rect.height)
            if not xref or xref in [806, 809] or bbox[3] < 55 or (w <= 32 and h <= 32) or is_full_page:
                continue
            filename = f"page_{p_num}_img_{xref}.png"
            filepath = assets_dir / filename
            if not filepath.exists():
                try:
                    base_img = doc.extract_image(xref)
                    if base_img.get("smask"):
                        try:
                            pix = fitz.Pixmap(doc, xref)
                            mask = fitz.Pixmap(doc, base_img["smask"])
                            pix = fitz.Pixmap(pix, mask)
                            if pix.n >= 5:
                                pix = fitz.Pixmap(fitz.csRGB, pix)
                            pix.save(str(filepath))
                        except Exception:
                            pix = page.get_pixmap(clip=fitz.Rect(bbox), dpi=150)
                            pix.save(str(filepath))
                    else:
                        with open(filepath, "wb") as f:
                            f.write(base_img["image"])
                except Exception:
                    continue

            content_hash = None
            if filepath.exists():
                try:
                    with open(filepath, "rb") as f:
                        content_hash = hashlib.md5(f.read()).hexdigest()
                except Exception:
                    pass

            figs.append({
                "xref": xref,
                "bbox": bbox,
                "path": f"assets/{filename}",
                "page": p_num,
                "y0": bbox[1],
                "y1": bbox[3],
                "y_center": (bbox[1] + bbox[3]) / 2.0,
                "content_hash": content_hash,
            })
        if figs:
            page_figures[p_num] = figs

    # 2. Track geometric position of all Question and Case Study markers across pages
    q_positions: List[Dict[str, Any]] = []
    case_study_markers: List[Dict[str, Any]] = []
    for page_idx in range(len(doc)):
        page = doc[page_idx]
        p_num = page_idx + 1
        for b in page.get_text("blocks"):
            txt = b[4].strip()
            m = re.search(r"^\s*(?:Question\s*No\.?\s*|Question\s*ID\s*:\s*|Q(?:uestion)?[\.\s]+)(\d+)", txt, re.IGNORECASE)
            if m:
                q_positions.append({
                    "q_num": m.group(1),
                    "page_num": p_num,
                    "y0": b[1],
                    "y1": b[3],
                })
            m_cs = re.search(r"^\s*(?:Case\s*Study\s*-\s*\d+\s*to\s*\d+|Directions\s*:[^\n]*?(?:graph|carefully|questions|नीचे\s*दिए|आरेख)|(?:नीचे\s*दिए\s*गए\s*)?अनुच्छेद\s*प[ढ़ढ़]कर\s*दिए\s*गए\s*प्रश्नों)", txt, re.IGNORECASE)
            if m_cs:
                case_study_markers.append({
                    "page_num": p_num,
                    "y0": b[1],
                    "y1": b[3],
                    "text": txt,
                })

    full_text = ""
    for page_idx, page in enumerate(doc):
        full_text += f"\n[PAGE_{page_idx+1}]\n" + page.get_text()

    # Split into question blocks by "Question No. X" or "Question ID : X" or "Q. X"
    raw_blocks = re.split(r"\n(?=(?:Question\s*No\.?\s*\d+|Question\s*ID\s*:\s*\d+|Q(?:uestion)?[\.\s]+\d+[\.\:\)\-]))", full_text, flags=re.IGNORECASE)
    q_blocks = [
        b for b in raw_blocks
        if re.search(r"^\s*(?:Question\s*No\.?\s*\d+|Question\s*ID\s*:\s*\d+|Q(?:uestion)?[\.\s]+\d+[\.\:\)\-])", b, flags=re.IGNORECASE)
    ]

    if not q_blocks:
        raw_blocks = re.split(r"\n(?=\d{1,4}[\.\:\)]\s+)", full_text)
        q_blocks = [b for b in raw_blocks if re.search(r"^\s*\d{1,4}[\.\:\)]\s+", b)]

    # Cleanly detach trailing Case Study / Directions blocks from question i and prepend them to question i+1
    cs_split_pattern = r"\n(?=(?:Case\s*Study\s*-\s*\d+\s*to\s*\d+|Directions\s*:[^\n]*?(?:graph|carefully|questions|नीचे\s*दिए|आरेख)|(?:नीचे\s*दिए\s*गए\s*)?अनुच्छेद\s*प[ढ़ढ़]कर\s*दिए\s*गए\s*प्रश्नों))"
    for i in range(len(q_blocks) - 1):
        q_header = re.search(r"Question\s*No\.?\s*\d+", q_blocks[i], re.IGNORECASE)
        search_start = q_header.end() if q_header else 0
        m_cs = re.search(cs_split_pattern, q_blocks[i][search_start:], re.IGNORECASE)
        if m_cs:
            actual_start = search_start + m_cs.start()
            trailing_cs = q_blocks[i][actual_start:].strip()
            q_blocks[i] = q_blocks[i][:actual_start].strip()
            q_blocks[i + 1] = trailing_cs + "\n\n" + q_blocks[i + 1]

    parsed_blocks: List[QuestionBlock] = []

    for idx, b in enumerate(q_blocks):
        m_num = re.search(r"(?:Question\s*No\.?\s*|Question\s*ID\s*:\s*|Q(?:uestion)?[\.\s]+)(\d+)", b, flags=re.IGNORECASE)
        q_num = m_num.group(1) if m_num else str(idx + 1)

        # Get spatial metadata
        q_pos = q_positions[idx] if idx < len(q_positions) else {"page_num": 1, "y0": 0.0, "y1": 100.0}
        start_page = q_pos["page_num"]
        start_y0 = q_pos["y0"]
        if idx + 1 < len(q_positions):
            end_page = q_positions[idx + 1]["page_num"]
            end_y0 = q_positions[idx + 1]["y0"]
        else:
            end_page = len(doc)
            end_y0 = 9999.0

        # Check if a Case Study appears between this question and the next
        for cs in case_study_markers:
            if (start_page < cs["page_num"] < end_page) or \
               (start_page == cs["page_num"] == end_page and start_y0 < cs["y0"] < end_y0) or \
               (start_page == cs["page_num"] and cs["page_num"] < end_page and cs["y0"] > start_y0) or \
               (start_page < cs["page_num"] and cs["page_num"] == end_page and cs["y0"] < end_y0):
                # Question ends right before the case study
                end_page = cs["page_num"]
                end_y0 = cs["y0"]
                break

        # If previous question handed over a Case Study to this question, expand start_y0 to cover it
        prev_q_pos = q_positions[idx - 1] if idx > 0 else None
        for cs in case_study_markers:
            is_after_prev_q = (
                prev_q_pos is None
                or prev_q_pos["page_num"] < start_page
                or (prev_q_pos["page_num"] == start_page and cs["y0"] > prev_q_pos["y0"])
            )
            if cs["page_num"] == start_page and cs["y0"] < start_y0 and is_after_prev_q:
                start_y0 = cs["y0"]
                break

        # Collect all figures falling in this question's span across pages
        raw_matched_figs: List[Dict[str, Any]] = []
        for p_idx in range(start_page, end_page + 1):
            figs_on_p = page_figures.get(p_idx, [])
            for fig in figs_on_p:
                yc = fig["y_center"]
                if start_page == end_page == p_idx:
                    if (start_y0 - 5) <= yc < end_y0:
                        raw_matched_figs.append(fig)
                elif p_idx == start_page:
                    if yc >= (start_y0 - 5):
                        raw_matched_figs.append(fig)
                elif start_page < p_idx < end_page:
                    raw_matched_figs.append(fig)
                elif p_idx == end_page:
                    if yc < end_y0:
                        raw_matched_figs.append(fig)

        # Split options by (A), (B), (C), (D) or Option 1..4 or Ans 1..4
        # Do NOT greedily split on \b[1-4]\.\s+ unless preceded by Option or Ans
        parts = re.split(r"\n(?=(?:\([A-Da-d1-4]\)|Option\s*[1-4]|Ans\s*[1-4]\.))", b)
        if len(parts) <= 1:
            parts = re.split(r"\n(?=(?:\b[1-4]\.\s+))", b)

        # In candidate sheets with statement/conclusion legends or arguments:
        # If there are more than 4 candidate options (e.g. 8, 12, 16 parts),
        # the terminal 4 options are the candidate response choices (A, B, C, D).
        if len(parts) > 5:
            last_4 = parts[-4:]
            has_candidate_signal = any(re.search(r"\(Correct Answer\)|\(Chosen option\)", p, re.IGNORECASE) for p in last_4)
            if has_candidate_signal or len(parts) >= 8:
                stem_part = "\n".join(parts[:-4])
                opt_blocks = parts[-4:]
            else:
                stem_part = parts[0]
                opt_blocks = parts[1:]
        else:
            stem_part = parts[0]
            opt_blocks = parts[1:]

        stem_lines = [l.strip() for l in stem_part.split("\n") if l.strip()]
        
        # Clean header noise from stem
        stem_lines = [l for l in stem_lines if not re.match(r"^\s*Question\s*(?:No|ID)\.?\s*\d+\s*$", l, re.IGNORECASE)]

        unique_stem = []
        for l in stem_lines:
            if l.startswith("[PAGE_") or re.match(r"^(?:M|Boo|Bookmark|Mark|Review)$", l, re.IGNORECASE):
                continue
            if not unique_stem or unique_stem[-1] != l:
                unique_stem.append(l)
        q_text = repair_indic_text("\n".join(unique_stem).strip())

        options: List[QuestionOption] = []
        detected_answer: Optional[str] = None

        for opt_idx, opt_block in enumerate(opt_blocks):
            opt_match = re.search(r"^\s*(?:\(([A-Da-d1-4])\)|Option\s*([1-4])|Ans\s*([1-4])\.|\b([1-4])\.\s+)\s*\n?([\s\S]*)", opt_block)
            if opt_match:
                opt_letter = opt_match.group(1) or opt_match.group(2) or opt_match.group(3) or opt_match.group(4) or chr(65 + opt_idx)
                opt_letter = str(opt_letter).upper()
                if opt_letter in {"1": "A", "2": "B", "3": "C", "4": "D"}:
                    opt_letter = {"1": "A", "2": "B", "3": "C", "4": "D"}[opt_letter]

                opt_body = opt_match.group(5).strip() if len(opt_match.groups()) >= 5 and opt_match.group(5) else opt_block.strip()
                is_correct = bool(re.search(r"\(Correct Answer\)|\bCorrect\b|\bGreen\b", opt_body, re.IGNORECASE))
                clean_body = re.sub(r"\(Correct Answer\)|\(Chosen option\)|\bQuestion ID : \d+|\bChosen Option : \d+", "", opt_body, flags=re.IGNORECASE).strip()

                clean_lines = [l.strip() for l in clean_body.split("\n") if l.strip() and not l.startswith("[PAGE_")]
                unique_opt_lines = []
                for l in clean_lines:
                    # Ignore section banners, UI action buttons, or trailing case study/direction banners
                    is_banner = bool(re.search(r"(?:BASIC\s*LAW|GENERAL\s*HINDI|NUMERICAL|MENTAL\s*APTITUDE|GENERAL\s*KNOWLEDGE|TEST\s*OF\s*REASONING)[^\n]*?(?:BASIC\s*LAW|GENERAL\s*HINDI|NUMERICAL|MENTAL\s*APTITUDE|GENERAL\s*KNOWLEDGE|TEST\s*OF\s*REASONING)", l, re.IGNORECASE))
                    is_ui_noise = bool(re.match(r"^(?:Save\s*&\s*Print|Bookmark|Mark\s*for\s*Review|Question\s*ID\s*:|Chosen\s*Option\s*:)", l, re.IGNORECASE))
                    is_case_study = bool(re.match(r"^(?:Case\s*Study|Directions\s*:|अनुच्छेद\s*पढ़कर|अनुच्छेद\s*पढ़कर)", l, re.IGNORECASE))
                    if is_banner or is_ui_noise or is_case_study:
                        break

                    if not unique_opt_lines or unique_opt_lines[-1] != l:
                        unique_opt_lines.append(l)
                final_opt_text = repair_indic_text("\n".join(unique_opt_lines).strip())

                if is_correct:
                    detected_answer = opt_letter

                options.append(
                    QuestionOption(
                        option_number=opt_letter,
                        option_text=final_opt_text,
                        is_correct_signal=is_correct,
                        color_bucket="green_family" if is_correct else "neutral",
                    )
                )

        # Separate Stem Diagrams from Option Figures using:
        # 1. Visual Hash Deduplication (drops page-continuation duplicates across streams)
        # 2. Spatial Layout-Grounded matching (geometry relative to option markers A, B, C, D)
        deduped_matched_figs: List[Dict[str, Any]] = []
        seen_hashes = set()
        seen_fig_xrefs = set()
        for f in raw_matched_figs:
            c_hash = f.get("content_hash")
            xref = f.get("xref")
            if c_hash:
                if c_hash in seen_hashes:
                    continue
                seen_hashes.add(c_hash)
            elif xref:
                if xref in seen_fig_xrefs:
                    continue
                seen_fig_xrefs.add(xref)
            deduped_matched_figs.append(f)

        # Extract spatial option markers on the pages covered by this question
        opt_spatial_markers: List[Dict[str, Any]] = []
        for p in range(start_page, end_page + 1):
            if p > len(doc):
                break
            for block in doc[p - 1].get_text("blocks"):
                by0, by1 = block[1], block[3]
                if p == start_page and by0 < (start_y0 - 5):
                    continue
                if p == end_page and by0 >= end_y0:
                    continue
                btxt = block[4].strip()
                m_opt = re.match(r"^\s*(?:\(([A-Da-d1-4])\)|Option\s*([1-4])|\b([1-4])\.)", btxt)
                if m_opt:
                    opt_spatial_markers.append({
                        "label": m_opt.group(1) or m_opt.group(2) or m_opt.group(3),
                        "page": p,
                        "y0": by0,
                        "y1": by1,
                    })

        q_diagrams: List[str] = []
        if opt_spatial_markers:
            first_opt = opt_spatial_markers[0]
            for f in deduped_matched_figs:
                f_page = f.get("page", start_page)
                f_yc = f.get("y_center", f["y0"])
                # Check if strictly before the first option marker
                is_before_first_opt = (f_page < first_opt["page"]) or (f_page == first_opt["page"] and f_yc < first_opt["y0"])
                if is_before_first_opt:
                    q_diagrams.append(f["path"])
                else:
                    # Match with the closest corresponding option if vertically proximal
                    matched_opt_idx = None
                    for i in range(len(opt_spatial_markers) - 1):
                        curr_m = opt_spatial_markers[i]
                        next_m = opt_spatial_markers[i + 1]
                        if f_page == curr_m["page"] == next_m["page"]:
                            if curr_m["y0"] - 5 <= f_yc < next_m["y0"]:
                                matched_opt_idx = i
                                break
                        elif f_page == curr_m["page"] and f_yc >= curr_m["y0"] - 5:
                            matched_opt_idx = i
                            break
                        elif f_page == next_m["page"] and f_yc < next_m["y0"]:
                            matched_opt_idx = i
                            break
                    if matched_opt_idx is None and opt_spatial_markers:
                        last_m = opt_spatial_markers[-1]
                        # For the last option, image can be on the same page (or following page within question boundary)
                        # Top of image starts at or below last marker, or center is within proximity
                        if f_page == last_m["page"]:
                            if (last_m["y0"] - 10 <= f.get("y0", f_yc) <= last_m["y1"] + 80) or (last_m["y0"] - 10 <= f_yc <= last_m["y1"] + 200):
                                matched_opt_idx = len(opt_spatial_markers) - 1
                        elif f_page > last_m["page"]:
                            matched_opt_idx = len(opt_spatial_markers) - 1

                    if matched_opt_idx is not None and matched_opt_idx < len(options):
                        options[matched_opt_idx].option_image_path = f["path"]
                    else:
                        q_diagrams.append(f["path"])

            # Safeguard: If all options except the last one have images, but the last option is missing an image
            # and stem received multiple diagrams, reassign the trailing stem diagram to the last option.
            if len(options) >= 2 and len(q_diagrams) > 1:
                opts_without_img = [idx for idx, opt in enumerate(options) if not opt.option_image_path]
                if len(opts_without_img) == 1 and opts_without_img[0] == len(options) - 1:
                    options[-1].option_image_path = q_diagrams.pop()
        else:
            # Fallback if no option blocks were spatially found
            if len(deduped_matched_figs) > len(options):
                stem_fig_cutoff = len(deduped_matched_figs) - len(options)
                for f in deduped_matched_figs[:stem_fig_cutoff]:
                    q_diagrams.append(f["path"])
                for opt_idx, f in enumerate(deduped_matched_figs[stem_fig_cutoff:]):
                    if opt_idx < len(options):
                        options[opt_idx].option_image_path = f["path"]
            elif len(deduped_matched_figs) == len(options) and len(options) > 0 and all(not (opt.option_text or "").strip() for opt in options):
                for opt_idx, f in enumerate(deduped_matched_figs):
                    options[opt_idx].option_image_path = f["path"]
            else:
                for f in deduped_matched_figs:
                    q_diagrams.append(f["path"])

        # High-res question bounding box crop (300 DPI)
        crop_path = None
        if generate_crops:
            try:
                page_obj = doc[start_page - 1]
                clip_y1 = (end_y0 + 10) if (start_page == end_page and end_y0 < 9000) else (page_obj.rect.height - 10)
                clip_rect = fitz.Rect(
                    10,
                    max(0, start_y0 - 8),
                    page_obj.rect.width - 10,
                    min(page_obj.rect.height, clip_y1),
                )
                crop_filename = f"q_{idx + 1}_p{start_page}.png"
                crop_file = crops_dir / crop_filename
                if not crop_file.exists():
                    pix = page_obj.get_pixmap(dpi=300, clip=clip_rect)
                    pix.save(str(crop_file))
                crop_path = f"assets/crops/{crop_filename}"
            except Exception:
                pass

        # Section classification by index (for 160-question UP Police SI standard)
        sec_name = "General"
        if len(q_blocks) == 160:
            if idx >= 120:
                sec_name = "Mental Aptitude / Reasoning"
            elif idx >= 80:
                sec_name = "Numerical & Mental Ability"
            elif idx >= 40:
                sec_name = "General Knowledge & Law/Constitution"
            else:
                sec_name = "General Hindi"

        parsed_blocks.append(
            QuestionBlock(
                question_number=q_num,
                global_question_number=idx + 1,
                section_name=sec_name,
                question_text=q_text,
                options=options,
                detected_answer=detected_answer,
                source="inline_color_marker" if detected_answer else "none",
                confidence="high" if detected_answer else "none",
                source_page=start_page,
                diagram_image_paths=q_diagrams,
                crop_image_path=crop_path,
            )
        )

    from quiz.ai.examintel.context_propagation import propagate_shared_contexts
    parsed_blocks = propagate_shared_contexts(parsed_blocks)

    return parsed_blocks, doc_title
