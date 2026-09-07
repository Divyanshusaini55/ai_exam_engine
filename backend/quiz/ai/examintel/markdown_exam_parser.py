from __future__ import annotations
import re
from pathlib import Path
from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field


class ParsedOption(BaseModel):
    option_number: str
    option_text: str = ""
    image_url: Optional[str] = None
    is_correct: bool = False


class ParsedQuestion(BaseModel):
    question_number: str
    global_question_number: int
    question_id: Optional[str] = None
    section_name: str = "General"
    topic: Optional[str] = None
    stem_raw: str = ""
    figure_paths: List[str] = Field(default_factory=list)
    options: List[ParsedOption] = Field(default_factory=list)
    correct_option: Optional[str] = None
    provenance: Optional[str] = None
    crop_image_path: Optional[str] = None


class ParsedExamDoc(BaseModel):
    title: str
    source_filename: Optional[str] = None
    total_questions: int = 0
    sections: List[str] = Field(default_factory=list)
    questions: List[ParsedQuestion] = Field(default_factory=list)


class MarkdownExamParser:
    """
    High-fidelity deterministic parser for ExamIntel Markdown documents.
    Extracts metadata, sections, bilingual/KaTeX stems, diagrams, options,
    ground-truth checkmarks, and crop references.
    """

    @classmethod
    def parse_file(cls, md_file_path: str | Path) -> ParsedExamDoc:
        path = Path(md_file_path)
        if not path.exists():
            raise FileNotFoundError(f"Markdown file not found: {path}")
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
        return cls.parse_text(content, source_filename=path.name)

    @classmethod
    def parse_text(cls, md_text: str, source_filename: Optional[str] = None) -> ParsedExamDoc:
        lines = md_text.splitlines()

        title = "Exam Paper"
        parsed_source = source_filename
        total_questions = 0

        # 1. Parse Header
        for i, line in enumerate(lines[:15]):
            stripped = line.strip()
            if stripped.startswith("# ") and not stripped.startswith("# Section:"):
                # Title line: # SSC CGL 2022 TIER 1... (KaTeX Math-Refined)
                raw_title = stripped[2:].strip()
                title = re.sub(r"\s*\(KaTeX\s+Math-Refined\)", "", raw_title, flags=re.IGNORECASE).strip()
            elif stripped.startswith(">"):
                # Source metadata: > **Source**: `q.pdf` | **Refined Questions**: `97`
                src_match = re.search(r"\*\*Source\*\*:\s*`?([^`|\*]+)`?", stripped)
                if src_match:
                    parsed_source = src_match.group(1).strip()
                count_match = re.search(r"\*\*Refined Questions\*\*:\s*`?(\d+)`?", stripped)
                if count_match:
                    total_questions = int(count_match.group(1))

        # 2. Split into Question and Section chunks
        # We split by '# Section: ' and '## Question ' markers
        raw_chunks = re.split(r"(?=^# Section:|^## Question )", md_text, flags=re.MULTILINE)

        current_section = "General"
        sections_found = []
        questions: List[ParsedQuestion] = []

        for block in raw_chunks:
            block = block.strip()
            if not block:
                continue

            # Check if this block is a Section header
            sec_match = re.match(r"^# Section:\s*([^\n\r]+)", block)
            if sec_match:
                current_section = sec_match.group(1).strip()
                if current_section not in sections_found:
                    sections_found.append(current_section)
                continue

            # If it doesn't start with '## Question ', it's a preamble or separator
            if not block.startswith("## Question "):
                continue

            parsed_q = cls._parse_single_question_block(block, default_section=current_section)
            if parsed_q:
                # Update current section if question header specified one
                if parsed_q.section_name and parsed_q.section_name not in sections_found:
                    sections_found.append(parsed_q.section_name)
                    current_section = parsed_q.section_name
                questions.append(parsed_q)

        return ParsedExamDoc(
            title=title,
            source_filename=parsed_source,
            total_questions=len(questions) if len(questions) > 0 else total_questions,
            sections=sections_found,
            questions=questions,
        )

    @classmethod
    def _parse_single_question_block(cls, block_text: str, default_section: str = "General") -> Optional[ParsedQuestion]:
        lines = block_text.splitlines()
        if not lines:
            return None

        # Line 0 is the question header:
        # e.g. "## Question 1 (Global Q1) [General Hindi] [ID: 26433069243]"
        header_line = lines[0].strip()
        q_num_match = re.search(r"^##\s+Question\s+(\d+)", header_line)
        if not q_num_match:
            return None

        local_num = q_num_match.group(1)

        global_num_match = re.search(r"\(Global\s+Q(\d+)\)", header_line)
        global_num = int(global_num_match.group(1)) if global_num_match else int(local_num)

        section_match = re.search(r"\[([^\]]+)\]", header_line)
        section_name = default_section
        if section_match:
            cand_sec = section_match.group(1).strip()
            if not cand_sec.startswith("ID:"):
                section_name = cand_sec

        id_match = re.search(r"\[ID:\s*([^\]]+)\]", header_line)
        question_id = id_match.group(1).strip() if id_match else None

        # Parse remainder of the block
        topic: Optional[str] = None
        stem_lines: List[str] = []
        figure_paths: List[str] = []
        options: List[ParsedOption] = []
        provenance: Optional[str] = None
        crop_image_path: Optional[str] = None

        in_options = False

        for line in lines[1:]:
            s_line = line.strip()
            if not s_line:
                if not in_options and stem_lines:
                    stem_lines.append("")
                continue

            # Check for horizontal rule
            if s_line == "---":
                continue

            # Check for Section header embedded inside block
            sec_inline = re.match(r"^# Section:\s*([^\n\r]+)", s_line)
            if sec_inline:
                if section_name == "General":
                    section_name = sec_inline.group(1).strip()
                continue

            # Check for Topic marker: *Topic: Mirror Image*
            topic_match = re.match(r"^\*Topic:\s*([^\*]+)\*", s_line)
            if topic_match:
                topic = topic_match.group(1).strip()
                continue

            # Check for HTML comments anywhere in the block (e.g. Provenance, Crop, Signal, Metadata)
            if s_line.startswith("<!--"):
                prov_match = re.search(r"<!--\s*PROVENANCE:\s*([^>\s]+)\s*-->", s_line)
                if prov_match:
                    provenance = prov_match.group(1).strip()
                    continue

                crop_match = re.search(r"<!--\s*CROP_IMAGE:\s*([^\s>]+)\s*-->", s_line)
                if crop_match:
                    crop_image_path = crop_match.group(1).strip()
                    continue

                continue

            # Check for Options header
            if s_line.startswith("### Options"):
                in_options = True
                continue

            # Check for Standalone Figure embed: ![Figure](assets/page_25_img_308.png) or ![Question Figure](...)
            fig_match = re.match(r"^!\[[^\]]*\]\(([^)]+)\)", s_line)
            if fig_match and not in_options:
                fig_p = fig_match.group(1).strip()
                if fig_p not in figure_paths:
                    figure_paths.append(fig_p)
                continue

            if in_options:
                # Option format:
                # - [ ] A. Text
                # - [x] B. Text <!-- GROUND_TRUTH: CORRECT -->
                # - [ ] C. ![C](assets/page_26_img_317.png)
                opt_match = re.match(r"^-\s*\[([ xX])\]\s*([A-Za-z0-9]+)\.\s*(.*)", s_line)
                if opt_match:
                    ignoring_trailing_noise = False
                    is_corr = opt_match.group(1).strip().lower() == "x"
                    opt_num = opt_match.group(2).strip()
                    opt_body = opt_match.group(3).strip()

                    # Check for ground truth signal in opt_body
                    if "GROUND_TRUTH" in opt_body:
                        is_corr = True

                    # Strip all HTML comments from opt_body (e.g. <!-- color: neutral -->)
                    opt_body = re.sub(r"<!--.*?-->", "", opt_body).strip()

                    # Check if option body contains an image embed: ![label](url)
                    opt_img = None
                    opt_img_match = re.search(r"!\[[^\]]*\]\(([^)]+)\)", opt_body)
                    if opt_img_match:
                        opt_img = opt_img_match.group(1).strip()
                        # Remove markdown image syntax from option text
                        opt_body = re.sub(r"!\[[^\]]*\]\([^)]+\)", "", opt_body).strip()
                        # If option has an image, strip redundant label placeholders like 'छवि (A)', 'Figure A', '(A)'
                        opt_body = re.sub(r"(?im)^\s*(?:छवि|आकृति|चित्र|चित्र\s*संख्या|Figure|Fig\.?|Image|Option|विकल्प)\s*[\(\[]?\s*[A-Da-d1-4]\s*[\)\]]?\s*$", "", opt_body).strip()
                        opt_body = re.sub(r"(?im)^\s*[\(\[]?\s*[A-Da-d1-4]\s*[\)\]]?\s*$", "", opt_body).strip()

                    options.append(
                        ParsedOption(
                            option_number=opt_num,
                            option_text=opt_body,
                            image_url=opt_img,
                            is_correct=is_corr,
                        )
                    )
                else:
                    # Continuation line for the last option
                    if options and s_line:
                        if ignoring_trailing_noise or s_line.startswith("<!--"):
                            continue

                        # Ignore section banners, UI action buttons, or trailing case study/direction banners
                        is_banner = bool(re.search(r"(?:BASIC\s*LAW|GENERAL\s*HINDI|NUMERICAL|MENTAL\s*APTITUDE|GENERAL\s*KNOWLEDGE|TEST\s*OF\s*REASONING)[^\n]*?(?:BASIC\s*LAW|GENERAL\s*HINDI|NUMERICAL|MENTAL\s*APTITUDE|GENERAL\s*KNOWLEDGE|TEST\s*OF\s*REASONING)", s_line, re.IGNORECASE))
                        is_ui_noise = bool(re.match(r"^(?:Save\s*&\s*Print|Bookmark|Mark\s*for\s*Review|Question\s*ID\s*:|Chosen\s*Option\s*:)", s_line, re.IGNORECASE))
                        is_case_study = bool(re.match(r"^(?:Case\s*Study|Directions\s*:|अनुच्छेद\s*पढ़कर|अनुच्छेद\s*पढ़कर)", s_line, re.IGNORECASE))
                        if is_banner or is_ui_noise or is_case_study:
                            ignoring_trailing_noise = True
                            continue

                        if "GROUND_TRUTH" in s_line:
                            options[-1].is_correct = True
                        s_line = re.sub(r"<!--.*?-->", "", s_line).strip()

                        # If continuation line has an image
                        opt_img_match = re.search(r"!\[[^\]]*\]\(([^)]+)\)", s_line)
                        if opt_img_match:
                            options[-1].image_url = opt_img_match.group(1).strip()
                            clean_l = re.sub(r"!\[[^\]]*\]\([^)]+\)", "", s_line).strip()
                            if clean_l:
                                options[-1].option_text = (options[-1].option_text + "\n" + clean_l).strip()
                        elif s_line:
                            options[-1].option_text = (options[-1].option_text + "\n" + s_line).strip()
            else:
                # Question stem line
                stem_lines.append(line)

        # Clean stem text
        stem_raw = "\n".join(stem_lines).strip()

        # Find single correct option
        correct_option = None
        for opt in options:
            if opt.is_correct:
                correct_option = opt.option_number
                break

        return ParsedQuestion(
            question_number=local_num,
            global_question_number=global_num,
            question_id=question_id,
            section_name=section_name,
            topic=topic,
            stem_raw=stem_raw,
            figure_paths=figure_paths,
            options=options,
            correct_option=correct_option,
            provenance=provenance,
            crop_image_path=crop_image_path,
        )
