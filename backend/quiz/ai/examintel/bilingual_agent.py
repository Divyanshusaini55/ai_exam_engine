from __future__ import annotations
import re
from typing import Optional, Tuple, List
from pydantic import BaseModel

from quiz.ai.examintel.markdown_exam_parser import ParsedQuestion, ParsedOption


class BilingualQuestionPayload(BaseModel):
    language: str  # "en" | "hi" | "bilingual"
    stem_en: str
    stem_hi: Optional[str] = None
    options: List[BilingualOptionPayload]


class BilingualOptionPayload(BaseModel):
    option_number: str
    text_en: str
    text_hi: Optional[str] = None
    image_url: Optional[str] = None
    is_correct: bool = False


class BilingualAgent:
    """
    Deterministic Agent that analyzes language profiles of questions and options,
    separating Latin (English) and Devanagari (Hindi) content into discrete fields.
    """

    LATIN_REGEX = re.compile(r"[A-Za-z]")
    DEVANAGARI_REGEX = re.compile(r"[\u0900-\u097F]")

    @classmethod
    def process_question(cls, q: ParsedQuestion) -> BilingualQuestionPayload:
        stem_raw = q.stem_raw.strip()

        has_devanagari = bool(cls.DEVANAGARI_REGEX.search(stem_raw))
        has_latin = bool(cls.LATIN_REGEX.search(stem_raw))

        # Check section hint (e.g. "General Hindi" -> pure Hindi)
        sec_lower = (q.section_name or "").lower()
        is_hindi_section = "hindi" in sec_lower and "general knowledge" not in sec_lower

        if is_hindi_section or (has_devanagari and not has_latin):
            # Pure Hindi Question
            language = "hi"
            stem_en = stem_raw
            stem_hi = None
            processed_options = []
            for opt in q.options:
                processed_options.append(
                    BilingualOptionPayload(
                        option_number=opt.option_number,
                        text_en=opt.option_text,
                        text_hi=None,
                        image_url=opt.image_url,
                        is_correct=opt.is_correct,
                    )
                )
        elif has_latin and not has_devanagari:
            # Pure English Question
            language = "en"
            stem_en = stem_raw
            stem_hi = None
            processed_options = []
            for opt in q.options:
                processed_options.append(
                    BilingualOptionPayload(
                        option_number=opt.option_number,
                        text_en=opt.option_text,
                        text_hi=None,
                        image_url=opt.image_url,
                        is_correct=opt.is_correct,
                    )
                )
        else:
            # Bilingual Question (English + Hindi)
            language = "bilingual"
            stem_en, stem_hi = cls._split_bilingual_text(stem_raw)

            processed_options = []
            for opt in q.options:
                opt_en, opt_hi = cls._split_bilingual_option(opt.option_text)
                processed_options.append(
                    BilingualOptionPayload(
                        option_number=opt.option_number,
                        text_en=opt_en,
                        text_hi=opt_hi,
                        image_url=opt.image_url,
                        is_correct=opt.is_correct,
                    )
                )

        return BilingualQuestionPayload(
            language=language,
            stem_en=stem_en,
            stem_hi=stem_hi,
            options=processed_options,
        )

    @classmethod
    def _split_bilingual_text(cls, text: str) -> Tuple[str, Optional[str]]:
        lines = [l.strip() for l in text.splitlines() if l.strip()]
        if not lines:
            return text, None

        en_lines: List[str] = []
        hi_lines: List[str] = []

        for line in lines:
            line_has_hi = bool(cls.DEVANAGARI_REGEX.search(line))
            line_has_en = bool(cls.LATIN_REGEX.search(line))

            # Check for inline slash separator: "What is X? / X क्या है?"
            if " / " in line and line_has_hi and line_has_en:
                parts = line.split(" / ", 1)
                p0_hi = bool(cls.DEVANAGARI_REGEX.search(parts[0]))
                p1_hi = bool(cls.DEVANAGARI_REGEX.search(parts[1]))
                if not p0_hi and p1_hi:
                    en_lines.append(parts[0].strip())
                    hi_lines.append(parts[1].strip())
                    continue
                elif p0_hi and not p1_hi:
                    hi_lines.append(parts[0].strip())
                    en_lines.append(parts[1].strip())
                    continue

            if line_has_hi:
                # Any sentence containing Devanagari in Indian exams is a Hindi sentence
                # (even if quoting English words, variables, or code words like 'lo ma ku')
                hi_lines.append(line)
            elif line_has_en:
                # Pure English sentence
                en_lines.append(line)
            else:
                # Math formula, numbers, or symbols only (e.g. "$0.3585858...$")
                if en_lines and not hi_lines:
                    en_lines.append(line)
                elif hi_lines and not en_lines:
                    hi_lines.append(line)
                else:
                    en_lines.append(line)
                    hi_lines.append(line)

        stem_en = "\n".join(en_lines).strip() or text
        stem_hi = "\n".join(hi_lines).strip() or None

        return stem_en, stem_hi

    @classmethod
    def _split_bilingual_option(cls, opt_text: str) -> Tuple[str, Optional[str]]:
        if not opt_text:
            return "", None

        lines = [l.strip() for l in opt_text.splitlines() if l.strip()]
        if len(lines) == 1:
            line = lines[0]
            if " / " in line:
                parts = line.split(" / ", 1)
                part1_has_hi = bool(cls.DEVANAGARI_REGEX.search(parts[0]))
                part2_has_hi = bool(cls.DEVANAGARI_REGEX.search(parts[1]))
                if not part1_has_hi and part2_has_hi:
                    return parts[0].strip(), parts[1].strip()
                elif part1_has_hi and not part2_has_hi:
                    return parts[1].strip(), parts[0].strip()

            has_hi = bool(cls.DEVANAGARI_REGEX.search(line))
            return line, (line if has_hi else None)

        en_parts = []
        hi_parts = []
        for line in lines:
            if cls.DEVANAGARI_REGEX.search(line):
                hi_parts.append(line)
            else:
                en_parts.append(line)

        opt_en = "\n".join(en_parts).strip() or opt_text
        opt_hi = "\n".join(hi_parts).strip() if hi_parts else None

        return opt_en, opt_hi
