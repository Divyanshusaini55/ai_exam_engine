import re
from typing import Literal, Optional, Tuple, List, Dict

from quiz.ai.examintel.models import (
    StyledSpan,
    AnswerKeyEntry,
    AnswerSignal,
    AnswerSignalSource,
    AnswerSignalConfidence,
)


def _extract_option_label(text: str) -> Optional[str]:
    clean = text.strip()
    if not clean:
        return None

    # Exact single letter/digit
    if len(clean) == 1 and (clean.isalpha() or clean.isdigit()):
        return clean.upper()

    # Regex matching option prefix
    match = re.match(
        r"^(?:\(?([A-Ea-e1-5])[\.\)\:\-\]\s]|\b(?:Option|Choice)\s*\(?([A-Ea-e1-5])\)?[:\.\-\s]*)",
        clean,
        re.IGNORECASE,
    )
    if match:
        label = match.group(1) or match.group(2)
        if label:
            return label.upper()

    return None


def _normalize_q_key(q_num: str) -> str:
    """Normalizes question number string"""
    clean = re.sub(r"[^\d]", "", q_num)
    if clean:
        return str(int(clean))
    return q_num.strip().lower()


def _group_spans_by_option(
    spans: List[StyledSpan],
) -> Dict[str, List[StyledSpan]]:

    groups: Dict[str, List[StyledSpan]] = {}
    current_label: Optional[str] = None
    default_letters = ["A", "B", "C", "D", "E", "F", "G", "H"]
    auto_idx = 0

    for span in spans:
        label = _extract_option_label(span.text)
        if label:
            current_label = label
            groups.setdefault(current_label, []).append(span)
        elif current_label is not None:
            # Continuation span for current option
            groups[current_label].append(span)
        else:
            # Span before any label or unlabelled span
            fallback_label = (
                default_letters[auto_idx] if auto_idx < len(default_letters) else f"OPT_{auto_idx+1}"
            )
            groups.setdefault(fallback_label, []).append(span)
            auto_idx += 1

    return groups


def _determine_inline_signal(
    question_option_spans: List[StyledSpan],
) -> Tuple[Optional[str], Optional[str]]:
    if not question_option_spans:
        return None, "No option spans provided."

    option_groups = _group_spans_by_option(question_option_spans)
    if not option_groups:
        return None, "Unable to parse option groups from spans."

    # Determine dominant color bucket for each option group
    option_colors: Dict[str, str] = {}
    for opt_label, group_spans in option_groups.items():
        buckets = [s.color_bucket for s in group_spans]
        if "green_family" in buckets:
            option_colors[opt_label] = "green_family"
        elif "red_family" in buckets:
            option_colors[opt_label] = "red_family"
        elif "other" in buckets:
            option_colors[opt_label] = "other"
        else:
            option_colors[opt_label] = "neutral"

    green_options = [opt for opt, col in option_colors.items() if col == "green_family"]
    red_options = [opt for opt, col in option_colors.items() if col == "red_family"]
    non_red_options = [opt for opt, col in option_colors.items() if col != "red_family"]

    # Case 1: Green marker presence
    if len(green_options) == 1:
        chosen = green_options[0]
        notes = f"Option '{chosen}' marked in green_family inline highlight."
        return chosen, notes

    if len(green_options) > 1:
        notes = f"Contradictory inline signal: multiple options marked in green_family ({', '.join(sorted(green_options))})."
        return None, notes

    # Case 2: Red marker elimination (only when >= 2 options are red and exactly 1 non-red remains)
    if len(red_options) >= 2 and len(non_red_options) == 1 and len(option_colors) >= 2:
        chosen = non_red_options[0]
        notes = f"Option '{chosen}' determined by red-marking elimination (options {', '.join(sorted(red_options))} marked red)."
        return chosen, notes

    if len(red_options) >= 2 and len(non_red_options) > 1:
        notes = f"Ambiguous inline red-marking: multiple non-red options remain ({', '.join(sorted(non_red_options))})."
        return None, notes

    if len(red_options) > 0 and len(non_red_options) == 0:
        notes = "Ambiguous inline red-marking: all options marked in red_family."
        return None, notes

    return None, "No conclusive inline color markers found."


def fuse_answer_signals(
    question_number: str,
    question_option_spans: List[StyledSpan],
    answer_key_entries: List[AnswerKeyEntry],
) -> AnswerSignal:
    # 1. Determine inline signal
    inline_val, inline_notes = _determine_inline_signal(question_option_spans)

    # 2. Determine key signal
    norm_q = _normalize_q_key(question_number)
    key_entry: Optional[AnswerKeyEntry] = None
    for entry in answer_key_entries:
        if _normalize_q_key(entry.question_number) == norm_q:
            key_entry = entry
            break

    key_val = key_entry.answer_value.strip().upper() if key_entry else None

    # Normalize inline value if present
    inline_norm = inline_val.strip().upper() if inline_val else None

    # 3. Apply exact fusion rules
    if inline_norm is not None and key_val is not None:
        if inline_norm == key_val:
            return AnswerSignal(
                question_number=question_number,
                detected_value=inline_norm,
                source="both_agree",
                confidence="high",
                conflict=False,
                notes=f"Inline color marker ({inline_norm}) agrees with answer key section (Page {key_entry.source_page}). {inline_notes}",
            )
        else:
            return AnswerSignal(
                question_number=question_number,
                detected_value=None,  # Do not auto-pick on conflict
                source="conflict",
                confidence="low",
                conflict=True,
                notes=(
                    f"Conflict detected: inline marker indicates '{inline_norm}', "
                    f"while answer key section indicates '{key_val}' (Page {key_entry.source_page}). "
                    f"Signals are not auto-resolved."
                ),
            )

    if inline_norm is not None and key_val is None:
        return AnswerSignal(
            question_number=question_number,
            detected_value=inline_norm,
            source="inline_color_marker",
            confidence="medium",
            conflict=False,
            notes=inline_notes,
        )

    if inline_norm is None and key_val is not None:
        return AnswerSignal(
            question_number=question_number,
            detected_value=key_val,
            source="answer_key_section",
            confidence=key_entry.confidence,
            conflict=False,
            notes=f"Determined from answer key section (Page {key_entry.source_page}, confidence: {key_entry.confidence}). {inline_notes or ''}".strip(),
        )

    # Neither present
    return AnswerSignal(
        question_number=question_number,
        detected_value=None,
        source="none",
        confidence="none",
        conflict=False,
        notes=f"No inline color marker or answer key entry found for question {question_number}. {inline_notes or ''}".strip(),
    )
