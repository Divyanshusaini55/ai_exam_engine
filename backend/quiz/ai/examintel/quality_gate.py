"""
examintel - Automated Ingestion Quality Gate & Audit Score
==========================================================
Computes an automated Ingestion Quality Score (0 to 100) and provides
actionable diagnostic flags across sequence integrity, option validity,
answer key coverage, and question stem health.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any, Union

from quiz.ai.examintel.models import QuestionBlock


@dataclass
class IngestionQualityReport:
    total_questions: int
    score: float
    grade: str
    is_passed: bool
    sequence_score: float
    options_score: float
    answer_coverage_score: float
    stem_quality_score: float
    missing_numbers: List[int] = field(default_factory=list)
    invalid_option_questions: List[str] = field(default_factory=list)
    unverified_answer_questions: List[str] = field(default_factory=list)
    short_stem_questions: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)

    def summary_badge(self) -> str:
        status_icon = "🟢" if self.is_passed else "🟡"
        lines = [
            f"   {status_icon} Ingestion Health Score: {self.score:.1f}/100 [Grade: {self.grade}]",
            f"      • Sequence:        {self.sequence_score:.1f}/25.0 (Missing: {len(self.missing_numbers)})",
            f"      • Option Integrity: {self.options_score:.1f}/25.0 (Anomalies: {len(self.invalid_option_questions)})",
            f"      • Answer Key Match: {self.answer_coverage_score:.1f}/30.0 ({self.total_questions - len(self.unverified_answer_questions)}/{self.total_questions} verified)",
            f"      • Stem Quality:    {self.stem_quality_score:.1f}/20.0 (Short stems: {len(self.short_stem_questions)})",
        ]
        if self.warnings:
            lines.append("      ⚠️  Warnings:")
            for w in self.warnings[:3]:
                lines.append(f"         - {w}")
            if len(self.warnings) > 3:
                lines.append(f"         ... and {len(self.warnings) - 3} more")
        return "\n".join(lines)


def evaluate_ingestion_quality(
    questions: List[Union[QuestionBlock, Dict[str, Any]]],
    total_expected: Optional[int] = None,
) -> IngestionQualityReport:
    """
    Evaluates the quality of extracted questions and outputs a comprehensive audit score.
    """
    total_q = len(questions)
    if total_q == 0:
        return IngestionQualityReport(
            total_questions=0,
            score=0.0,
            grade="F",
            is_passed=False,
            sequence_score=0.0,
            options_score=0.0,
            answer_coverage_score=0.0,
            stem_quality_score=0.0,
            warnings=["No questions extracted from document."],
        )

    # Convert to unified dictionary view
    q_dicts: List[Dict[str, Any]] = []
    for q in questions:
        if isinstance(q, dict):
            q_dicts.append(q)
        elif hasattr(q, "model_dump"):
            q_dicts.append(q.model_dump())
        elif hasattr(q, "dict"):
            q_dicts.append(q.dict())
        else:
            q_dicts.append({
                "question_number": getattr(q, "question_number", ""),
                "question_text": getattr(q, "question_text", ""),
                "options": getattr(q, "options", []),
                "detected_answer": getattr(q, "detected_answer", None),
                "crop_image_path": getattr(q, "crop_image_path", None),
                "diagram_image_paths": getattr(q, "diagram_image_paths", []),
            })

    warnings: List[str] = []

    # ── 1. Sequence Completeness (25 pts) ───────────────────────────────────
    g_nums = []
    for q in q_dicts:
        raw_g = str(q.get("global_question_number", "")).strip()
        if raw_g.isdigit():
            g_nums.append(int(raw_g))

    if len(g_nums) == total_q and len(set(g_nums)) > len(set(str(q.get("question_number", "")) for q in q_dicts)):
        q_nums = g_nums
    else:
        q_nums = []
        for q in q_dicts:
            raw_n = str(q.get("question_number", "")).strip()
            if raw_n.isdigit():
                q_nums.append(int(raw_n))

    missing_nums: List[int] = []
    if q_nums:
        min_n = min(q_nums)
        max_n = max(q_nums)
        expected_seq = set(range(min_n, max_n + 1))
        actual_seq = set(q_nums)
        missing_nums = sorted(list(expected_seq - actual_seq))

    if missing_nums:
        pct_missing = len(missing_nums) / max(total_q, 1)
        sequence_score = max(0.0, 25.0 * (1.0 - pct_missing * 2.0))
        warnings.append(f"Question sequence has gaps: missing Q{missing_nums[:5]}")
    else:
        sequence_score = 25.0

    # ── 2. Option Integrity (25 pts) ─────────────────────────────────────────
    invalid_opts: List[str] = []
    for q in q_dicts:
        opts = q.get("options", [])
        num_opts = len(opts)
        q_label = str(q.get("question_number", "?"))
        # Standard exams require 3 to 5 options (usually 4)
        if num_opts < 3 or num_opts > 5:
            invalid_opts.append(q_label)

    if invalid_opts:
        pct_invalid = len(invalid_opts) / total_q
        options_score = max(0.0, 25.0 * (1.0 - pct_invalid * 2.5))
        warnings.append(f"{len(invalid_opts)} questions have irregular option counts (Q{invalid_opts[:4]})")
    else:
        options_score = 25.0

    # ── 3. Answer Key Coverage (30 pts) ──────────────────────────────────────
    unverified: List[str] = []
    for q in q_dicts:
        det_ans = q.get("detected_answer")
        q_label = str(q.get("question_number", "?"))
        if not det_ans:
            unverified.append(q_label)

    answer_coverage_pct = (total_q - len(unverified)) / total_q
    # If no answer key present in paper, answer coverage drops to 0, which triggers review
    answer_coverage_score = 30.0 * answer_coverage_pct
    if len(unverified) > 0 and answer_coverage_pct < 0.90:
        warnings.append(f"Answer key coverage is {answer_coverage_pct * 100:.1f}% ({len(unverified)} questions unverified)")

    # ── 4. Stem Quality & Text Density (20 pts) ──────────────────────────────
    short_stems: List[str] = []
    for q in q_dicts:
        stem = str(q.get("question_text", "")).strip()
        has_vis = bool(q.get("crop_image_path") or q.get("diagram_image_paths"))
        q_label = str(q.get("question_number", "?"))
        if len(stem) < 8 and not has_vis:
            short_stems.append(q_label)

    if short_stems:
        pct_short = len(short_stems) / total_q
        stem_quality_score = max(0.0, 20.0 * (1.0 - pct_short * 3.0))
        warnings.append(f"{len(short_stems)} questions have abnormally short stems without diagrams (Q{short_stems[:4]})")
    else:
        stem_quality_score = 20.0

    # ── Composite Score ──────────────────────────────────────────────────────
    total_score = round(sequence_score + options_score + answer_coverage_score + stem_quality_score, 1)

    if total_score >= 95.0:
        grade = "A+"
    elif total_score >= 88.0:
        grade = "A"
    elif total_score >= 78.0:
        grade = "B"
    elif total_score >= 65.0:
        grade = "C"
    else:
        grade = "D"

    is_passed = bool(total_score >= 75.0)

    return IngestionQualityReport(
        total_questions=total_q,
        score=total_score,
        grade=grade,
        is_passed=is_passed,
        sequence_score=round(sequence_score, 1),
        options_score=round(options_score, 1),
        answer_coverage_score=round(answer_coverage_score, 1),
        stem_quality_score=round(stem_quality_score, 1),
        missing_numbers=missing_nums,
        invalid_option_questions=invalid_opts,
        unverified_answer_questions=unverified,
        short_stem_questions=short_stems,
        warnings=warnings,
    )
