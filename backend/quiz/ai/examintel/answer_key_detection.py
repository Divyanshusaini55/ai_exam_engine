from pathlib import Path
import re
from typing import Literal, Optional, Tuple, List, Set
import fitz
import pdfplumber

from quiz.ai.examintel.models import PageLayout, AnswerKeyEntry, AnswerKeyConfidence

HEADER_PATTERNS: List[str] = [
    r"(?i)\b(?:answer\s*keys?|solutions?\s*keys?|official\s*(?:answer\s*)?keys?)\b",
    r"(?i)\b(?:key\s*answers?|correct\s*answers?|solutions?\s*&\s*answers?)\b",
    r"(?i)\b(?:answers?\s*(?:to\s*questions?|section|sheet)?)\b",
    r"(?i)\b(?:key\s*(?:sheet|table)?)\b",
    r"(?i)\b(?:q\.?\s*no\.?\s*(?:&|and)?\s*ans(?:wer)?)\b",
]

PAIR_PATTERNS: List[str] = [
    # 1. C, 1. (C), 1 - C, 1: C, 1 -> C, 1 = C, Q1. C, Q.1 : C
    r"(?i)(?:Q\.?\s*|\b)(\d{1,4})\s*[\.\:\-\)\>\=\/]\s*\(?([A-E]|[1-4]|-?\d+(?:\.\d+)?)\)?(?=[,\s;\n]|$)",
    # (1) C, (1) (C)
    r"(?i)\((\d{1,4})\)\s*[\.\:\-\=\s]*\(?([A-E]|[1-4]|-?\d+(?:\.\d+)?)\)?",
    # 1 C   2 A   3 D (whitespace separated)
    r"(?i)\b(\d{1,4})\s*[\t ]+([A-E]|[1-4])\b",
    # Question 1: Option A / Q 1 Ans: C
    r"(?i)(?:Question|Q)\.?\s*(\d{1,4})\s*[:\-\s]\s*(?:Ans(?:wer)?|Option|Key)?\s*[:\-\s]*\(?([A-E]|[1-4]|-?\d+(?:\.\d+)?)\)?",
]

DENSE_SPAN_AVG_LEN_MAX: float = 12.0

DENSE_SPAN_MIN_COUNT: int = 15

MIN_PAIRS_FOR_HIGH_CONFIDENCE: int = 2

MIN_PAIRS_FOR_MEDIUM_CONFIDENCE: int = 4


def _normalize_question_num(raw_q: str) -> str:
    clean = re.sub(r"[^\d]", "", raw_q)
    if clean:
        return str(int(clean))
    return raw_q.strip()


def _normalize_answer_val(raw_val: str) -> str:
    clean = raw_val.strip()
    clean = re.sub(r"^[\(\[\{\<]+|[\)\]\}\>]+$", "", clean).strip()
    if len(clean) == 1 and clean.isalpha():
        return clean.upper()
    return clean


def _extract_pairs_from_text(text: str) -> List[Tuple[str, str]]:
    extracted: List[Tuple[str, str]] = []
    seen_q: Set[str] = set()

    for pattern in PAIR_PATTERNS:
        matches = re.findall(pattern, text)
        for q_raw, ans_raw in matches:
            q_norm = _normalize_question_num(q_raw)
            ans_norm = _normalize_answer_val(ans_raw)
            if q_norm and ans_norm and q_norm not in seen_q:
                # question numbers <= 500
                try:
                    q_int = int(q_norm)
                    if not (1 <= q_int <= 500):
                        continue
                except ValueError:
                    pass

                seen_q.add(q_norm)
                extracted.append((q_norm, ans_norm))

    def sort_key(item: Tuple[str, str]):
        try:
            return (0, int(item[0]))
        except ValueError:
            return (1, item[0])

    extracted.sort(key=sort_key)
    return extracted


def _extract_entries_from_table(table: List[List[Optional[str]]]) -> List[Tuple[str, str]]:
    if not table or len(table) < 2:
        return []

    entries: List[Tuple[str, str]] = []
    seen_q: Set[str] = set()

    # row_q has numbers, row_a has single letters/numbers
    for r_idx in range(0, len(table) - 1, 2):
        row_q = [c.strip() if c else "" for c in table[r_idx]]
        row_a = [c.strip() if c else "" for c in table[r_idx + 1]]

        if len(row_q) == len(row_a) and len(row_q) >= 2:
            # Check if row_q has numbers
            valid_pairs = 0
            temp_pairs: List[Tuple[str, str]] = []
            for q_cell, a_cell in zip(row_q, row_a):
                q_lines = [l.strip() for l in q_cell.split("\n") if l.strip()]
                a_lines = [l.strip() for l in a_cell.split("\n") if l.strip()]
                if len(q_lines) == len(a_lines):
                    for ql, al in zip(q_lines, a_lines):
                        qn = _normalize_question_num(ql)
                        an = _normalize_answer_val(al)
                        if qn.isdigit() and len(an) >= 1:
                            valid_pairs += 1
                            temp_pairs.append((qn, an))

            if valid_pairs >= 2:
                for qn, an in temp_pairs:
                    if qn not in seen_q:
                        seen_q.add(qn)
                        entries.append((qn, an))

    # Column pairs (e.g. [Q.No, Ans] or [Q, Ans, Q, Ans, ...])
    num_cols = max(len(r) for r in table if r)
    for c_idx in range(0, num_cols - 1, 2):
        temp_pairs = []
        valid_count = 0
        for row in table:
            if len(row) <= c_idx + 1:
                continue
            cell_q = row[c_idx] or ""
            cell_a = row[c_idx + 1] or ""

            # Check if cells contain multiline entries
            q_lines = [l.strip() for l in cell_q.split("\n") if l.strip()]
            a_lines = [l.strip() for l in cell_a.split("\n") if l.strip()]

            if len(q_lines) == len(a_lines):
                for ql, al in zip(q_lines, a_lines):
                    # header labels like "Q.No", "Answer"
                    if re.search(r"(?i)(?:q\.?no|question|item|ans|option|key)", ql):
                        continue
                    qn = _normalize_question_num(ql)
                    an = _normalize_answer_val(al)
                    if qn.isdigit() and (len(an) == 1 or re.match(r"^-?\d+(?:\.\d+)?$", an)):
                        valid_count += 1
                        temp_pairs.append((qn, an))

        if valid_count >= 2:
            for qn, an in temp_pairs:
                if qn not in seen_q:
                    seen_q.add(qn)
                    entries.append((qn, an))

    return entries


def detect_answer_key_sections(
    pdf_path: str, page_layouts: List[PageLayout]
) -> List[AnswerKeyEntry]:
    path_obj = Path(pdf_path)
    if not path_obj.is_file():
        raise FileNotFoundError(f"PDF file not found at: {pdf_path}")

    detected_entries: List[AnswerKeyEntry] = []
    seen_q_global: Set[str] = set()

    try:
        doc = fitz.open(pdf_path)
    except Exception as exc:
        raise ValueError(f"Failed to open PDF with PyMuPDF: {exc}") from exc

    pdf_plumber_doc = None
    try:
        pdf_plumber_doc = pdfplumber.open(pdf_path)
    except Exception:
        pdf_plumber_doc = None

    try:
        for page_idx in range(len(doc)):
            page_num = page_idx + 1
            page = doc[page_idx]
            full_text = page.get_text()

            layout = next((pl for pl in page_layouts if pl.page_number == page_num), None)

            # Header detection
            has_header = False
            for pattern in HEADER_PATTERNS:
                if re.search(pattern, full_text):
                    has_header = True
                    break

            # Heuristic B: Token density calculation
            is_dense_page = False
            if layout and len(layout.spans) >= DENSE_SPAN_MIN_COUNT:
                avg_span_len = sum(len(s.text.strip()) for s in layout.spans) / max(len(layout.spans), 1)
                short_spans = sum(1 for s in layout.spans if len(s.text.strip()) <= 4)
                short_ratio = short_spans / max(len(layout.spans), 1)

                if avg_span_len <= DENSE_SPAN_AVG_LEN_MAX or short_ratio >= 0.40:
                    is_dense_page = True

            page_pairs: List[Tuple[str, str]] = []

            #  pdfplumber structured tables
            if pdf_plumber_doc and page_idx < len(pdf_plumber_doc.pages):
                try:
                    tables = pdf_plumber_doc.pages[page_idx].extract_tables()
                    for tbl in tables:
                        tbl_pairs = _extract_entries_from_table(tbl)
                        page_pairs.extend(tbl_pairs)
                except Exception:
                    pass

            #  extract from regex text stream
            if not page_pairs:
                text_pairs = _extract_pairs_from_text(full_text)
                page_pairs.extend(text_pairs)

            if not page_pairs:
                continue

            confidence: Optional[AnswerKeyConfidence] = None
            if has_header and len(page_pairs) >= MIN_PAIRS_FOR_HIGH_CONFIDENCE:
                confidence = "high"
            elif is_dense_page and len(page_pairs) >= MIN_PAIRS_FOR_MEDIUM_CONFIDENCE:
                confidence = "medium"
            elif len(page_pairs) >= MIN_PAIRS_FOR_MEDIUM_CONFIDENCE:
                confidence = "medium"

            if confidence is not None:
                for q_num, ans_val in page_pairs:
                    if q_num not in seen_q_global:
                        seen_q_global.add(q_num)
                        detected_entries.append(
                            AnswerKeyEntry(
                                question_number=q_num,
                                answer_value=ans_val,
                                source_page=page_num,
                                confidence=confidence,
                            )
                        )
    finally:
        doc.close()
        if pdf_plumber_doc:
            pdf_plumber_doc.close()

    # Sort entries numerically if possible
    def entry_sort_key(entry: AnswerKeyEntry):
        try:
            return (0, int(entry.question_number))
        except ValueError:
            return (1, entry.question_number)

    detected_entries.sort(key=entry_sort_key)
    return detected_entries
