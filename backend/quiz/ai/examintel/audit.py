from __future__ import annotations
import json
import logging
import os
import re
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger("quiz.ai.examintel.audit")


class StageAuditCheck:
    def __init__(self, name: str, passed: bool, message: str, severity: str = "INFO"):
        self.name = name
        self.passed = passed
        self.message = message
        self.severity = severity  # "INFO", "WARNING", "ERROR"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "passed": self.passed,
            "severity": self.severity,
            "message": self.message,
        }


class StageReport:
    def __init__(self, stage_number: int, stage_name: str, artifact_path: Optional[str] = None):
        self.stage_number = stage_number
        self.stage_name = stage_name
        self.artifact_path = artifact_path
        self.start_time = time.time()
        self.duration_seconds: float = 0.0
        self.item_count: int = 0
        self.checks: List[StageAuditCheck] = []
        self.metrics: Dict[str, Any] = {}

    def complete(self):
        self.duration_seconds = round(time.time() - self.start_time, 3)

    def add_check(self, name: str, passed: bool, message: str, severity: str = "INFO"):
        self.checks.append(StageAuditCheck(name=name, passed=passed, message=message, severity=severity))

    def to_dict(self) -> Dict[str, Any]:
        return {
            "stage_number": self.stage_number,
            "stage_name": self.stage_name,
            "artifact_path": self.artifact_path,
            "duration_seconds": self.duration_seconds,
            "item_count": self.item_count,
            "metrics": self.metrics,
            "checks": [c.to_dict() for c in self.checks],
            "passed_all_checks": all(c.passed for c in self.checks if c.severity == "ERROR"),
        }


def get_pipeline_stages_dir(pdf_path: str, base_media_root: Optional[str] = None) -> Path:
    """Returns the dedicated directory for intermediate stage artifacts."""
    stem = Path(pdf_path).stem
    if base_media_root:
        out_dir = Path(base_media_root) / "exam_assets" / stem / "pipeline_stages"
    else:
        out_dir = Path("/tmp/exam_assets") / stem / "pipeline_stages"
    out_dir.mkdir(parents=True, exist_ok=True)
    return out_dir


def save_stage_artifact(
    output_dir: Path,
    filename: str,
    content: Any,
) -> str:
    """
    Saves an intermediate artifact (JSON or Markdown) to the pipeline stages directory.
    Returns the absolute path string.
    """
    output_path = output_dir / filename
    try:
        if isinstance(content, str):
            with open(output_path, "w", encoding="utf-8") as f:
                f.write(content)
        elif isinstance(content, (dict, list)):
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(content, f, indent=2, ensure_ascii=False, default=str)
        else:
            with open(output_path, "w", encoding="utf-8") as f:
                f.write(str(content))
        return str(output_path)
    except Exception as e:
        logger.error(f"Failed to save stage artifact {filename}: {e}")
        return ""


# ─────────────────────────────────────────────────────────────────────────────
# STAGE AUDIT CHECKERS
# ─────────────────────────────────────────────────────────────────────────────

def audit_stage1_layout(layouts: List[Any], spans_count: int, stage_report: StageReport):
    """Stage 1 Checks: Layout extraction & text spans."""
    stage_report.item_count = len(layouts)
    stage_report.metrics["total_pages"] = len(layouts)
    stage_report.metrics["total_text_spans"] = spans_count

    stage_report.add_check(
        name="Page Count Check",
        passed=len(layouts) > 0,
        message=f"Extracted {len(layouts)} page layouts.",
        severity="ERROR" if len(layouts) == 0 else "INFO",
    )
    stage_report.add_check(
        name="Text Spans Extracted",
        passed=spans_count > 0,
        message=f"Found {spans_count} text spans across document.",
        severity="ERROR" if spans_count == 0 else "INFO",
    )


def audit_stage2_markdown(markdown_text: str, stage_report: StageReport):
    """Stage 2 Checks: Rendered exam Markdown."""
    char_len = len(markdown_text.strip())
    headings = len(re.findall(r"^#{1,3}\s+", markdown_text, re.MULTILINE))
    stage_report.metrics["char_length"] = char_len
    stage_report.metrics["heading_count"] = headings

    stage_report.add_check(
        name="Markdown Length",
        passed=char_len > 100,
        message=f"Generated Markdown with {char_len} characters.",
        severity="ERROR" if char_len <= 100 else "INFO",
    )
    stage_report.add_check(
        name="Structured Headings",
        passed=headings >= 1,
        message=f"Found {headings} question/section markdown headers.",
        severity="WARNING" if headings == 0 else "INFO",
    )


def audit_stage3_chunks(questions: List[Dict[str, Any]], stage_report: StageReport):
    """Stage 3 Checks: Question chunk segmentation & options."""
    stage_report.item_count = len(questions)
    total_opts = sum(len(q.get("options", [])) for q in questions)
    has_answers = sum(1 for q in questions if q.get("detected_answer"))

    stage_report.metrics["question_count"] = len(questions)
    stage_report.metrics["total_options"] = total_opts
    stage_report.metrics["questions_with_detected_answers"] = has_answers

    stage_report.add_check(
        name="Extracted Questions Count",
        passed=len(questions) > 0,
        message=f"Segmented {len(questions)} question chunks.",
        severity="ERROR" if len(questions) == 0 else "INFO",
    )

    # Check for options
    low_opt_count = sum(1 for q in questions if len(q.get("options", [])) < 2)
    stage_report.add_check(
        name="Options Completeness",
        passed=low_opt_count == 0,
        message=f"{len(questions) - low_opt_count}/{len(questions)} questions have at least 2 options.",
        severity="WARNING" if low_opt_count > 0 else "INFO",
    )


def audit_stage4_indic(questions: List[Dict[str, Any]], stage_report: StageReport):
    """Stage 4 Checks: Devanagari ligatures and spacing."""
    stage_report.item_count = len(questions)
    devanagari_count = 0
    corrupt_glyph_count = 0
    legacy_glyphs = r"[ÍȲȱ¼·É×ƶÖǯÊÆµȉȃȴ´ȸƝƓƢĕĒ³ȮÒƹǆǂǓȵȳɏɢȾɞĀčÛěǽǼ¾ǣƠƤƷȰ¸²ɟɣɥƱƲ]"

    for q in questions:
        stem = q.get("question_text", "")
        if any("\u0900" <= c <= "\u097f" for c in stem):
            devanagari_count += 1
        if re.search(legacy_glyphs, stem):
            corrupt_glyph_count += 1

    stage_report.metrics["devanagari_questions"] = devanagari_count
    stage_report.metrics["corrupt_glyphs_remaining"] = corrupt_glyph_count

    stage_report.add_check(
        name="Indic Matra Repair",
        passed=corrupt_glyph_count == 0,
        message=f"{corrupt_glyph_count} questions contain unmapped legacy font glyphs.",
        severity="WARNING" if corrupt_glyph_count > 0 else "INFO",
    )


def audit_stage5_katex(questions: List[Dict[str, Any]], stage_report: StageReport):
    """Stage 5 Checks: KaTeX LaTeX math formulas."""
    stage_report.item_count = len(questions)
    math_count = 0
    unbalanced_katex = 0

    for q in questions:
        stem = q.get("question_text", "")
        dollar_count = stem.count("$")
        if dollar_count > 0:
            math_count += 1
            if dollar_count % 2 != 0:
                unbalanced_katex += 1

    stage_report.metrics["math_questions"] = math_count
    stage_report.metrics["unbalanced_katex_delimiters"] = unbalanced_katex

    stage_report.add_check(
        name="KaTeX Delimiters Balance",
        passed=unbalanced_katex == 0,
        message=f"{unbalanced_katex} questions have unbalanced '$' KaTeX delimiters.",
        severity="WARNING" if unbalanced_katex > 0 else "INFO",
    )


def audit_stage6_bilingual(questions: List[Dict[str, Any]], stage_report: StageReport):
    """Stage 6 Checks: Clean separation of English and Hindi."""
    stage_report.item_count = len(questions)
    bilingual_count = 0
    separated_options_count = 0

    for q in questions:
        en_text = q.get("question_text") or ""
        hi_text = q.get("question_text_hi") or ""
        if en_text and hi_text and en_text != hi_text:
            bilingual_count += 1

        opts = q.get("options", [])
        has_sep_opts = any(bool(o.get("text_hi") or o.get("answer_text_hi")) for o in opts)
        if has_sep_opts:
            separated_options_count += 1

    stage_report.metrics["bilingual_questions_count"] = bilingual_count
    stage_report.metrics["separated_options_count"] = separated_options_count

    stage_report.add_check(
        name="Bilingual Language Separation",
        passed=True,
        message=f"Bilingual questions detected: {bilingual_count}, Options with separated Hindi text: {separated_options_count}.",
        severity="INFO",
    )


def audit_stage7_solved(questions: List[Dict[str, Any]], stage_report: StageReport):
    """Stage 7 Checks: Answer key resolution."""
    stage_report.item_count = len(questions)
    solved_count = 0

    for q in questions:
        opts = q.get("options", [])
        if any(o.get("is_correct") for o in opts) or q.get("detected_answer"):
            solved_count += 1

    stage_report.metrics["verified_answers_count"] = solved_count
    missing_ans = len(questions) - solved_count

    stage_report.add_check(
        name="Answer Key Verification",
        passed=missing_ans == 0,
        message=f"{solved_count}/{len(questions)} questions have verified correct answers.",
        severity="ERROR" if missing_ans > 0 else "INFO",
    )


def audit_stage8_canonical_v2(payloads: List[Dict[str, Any]], stage_report: StageReport):
    """Stage 8 Checks: Canonical V2 schema integrity."""
    stage_report.item_count = len(payloads)
    valid_v2_count = 0
    unique_ids = set()

    for p in payloads:
        if p.get("schema_version") == "v2" and p.get("id") and p.get("content") and "answer" in p:
            valid_v2_count += 1
        unique_ids.add(p.get("id"))

    stage_report.metrics["valid_v2_payloads"] = valid_v2_count
    stage_report.metrics["unique_uuids"] = len(unique_ids)

    stage_report.add_check(
        name="V2 Schema Compliance",
        passed=valid_v2_count == len(payloads) and len(payloads) > 0,
        message=f"{valid_v2_count}/{len(payloads)} questions strictly match Canonical V2 Schema.",
        severity="ERROR" if valid_v2_count != len(payloads) else "INFO",
    )
    stage_report.add_check(
        name="UUID Uniqueness",
        passed=len(unique_ids) == len(payloads),
        message=f"{len(unique_ids)} unique question UUIDs generated.",
        severity="ERROR" if len(unique_ids) != len(payloads) else "INFO",
    )


# ─────────────────────────────────────────────────────────────────────────────
# FINAL REPORT GENERATOR
# ─────────────────────────────────────────────────────────────────────────────

def generate_pipeline_audit_report(
    pdf_path: str,
    stage_reports: List[StageReport],
    output_dir: Path,
) -> Tuple[str, str]:
    """
    Generates both pipeline_audit_report.json and pipeline_audit_report.md.
    Returns (json_path, md_path).
    """
    total_duration = sum(sr.duration_seconds for sr in stage_reports)
    all_passed = all(sr.to_dict().get("passed_all_checks", True) for sr in stage_reports)

    # 1. JSON Report
    report_dict = {
        "source_pdf": Path(pdf_path).name,
        "total_stages": len(stage_reports),
        "total_duration_seconds": round(total_duration, 3),
        "overall_status": "PASSED" if all_passed else "WARNINGS_DETECTED",
        "stages": [sr.to_dict() for sr in stage_reports],
    }

    json_path = save_stage_artifact(output_dir, "pipeline_audit_report.json", report_dict)

    # 2. Markdown Report
    md_lines = [
        f"# Ingestion Pipeline Audit Report",
        f"",
        f"> **Exam Source**: `{Path(pdf_path).name}`  ",
        f"> **Overall Status**: `{'✅ PASSED' if all_passed else '⚠️ WARNINGS DETECTED'}` | **Total Pipeline Duration**: `{round(total_duration, 2)}s`",
        f"",
        f"---",
        f"",
        f"## 📊 Pipeline Stages Summary Table",
        f"",
        f"| Stage # | Stage Name | Output Artifact | Items | Duration | Status |",
        f"| :--- | :--- | :--- | :--- | :--- | :--- |",
    ]

    for sr in stage_reports:
        d = sr.to_dict()
        art_name = Path(d["artifact_path"]).name if d["artifact_path"] else "N/A"
        status_badge = "✅ Passed" if d["passed_all_checks"] else "⚠️ Check Warnings"
        md_lines.append(
            f"| **Stage {d['stage_number']}** | {d['stage_name']} | [`{art_name}`](./{art_name}) | {d['item_count']} | {d['duration_seconds']}s | {status_badge} |"
        )

    md_lines.extend([
        f"",
        f"---",
        f"",
        f"## 🔍 Detailed Stage Audit Logs",
        f"",
    ])

    for sr in stage_reports:
        d = sr.to_dict()
        md_lines.append(f"### Stage {d['stage_number']}: {d['stage_name']}")
        if d.get("artifact_path"):
            md_lines.append(f"- **Local Artifact**: `{d['artifact_path']}`")
        md_lines.append(f"- **Duration**: `{d['duration_seconds']}s` | **Items Processed**: `{d['item_count']}`")
        
        if d.get("metrics"):
            md_lines.append(f"- **Metrics**:")
            for mk, mv in d["metrics"].items():
                md_lines.append(f"  - `{mk}`: **{mv}**")

        if d.get("checks"):
            md_lines.append(f"- **Automated Assertions**:")
            for chk in d["checks"]:
                icon = "✅" if chk["passed"] else ("❌" if chk["severity"] == "ERROR" else "⚠️")
                md_lines.append(f"  - {icon} **{chk['name']}**: {chk['message']}")
        md_lines.append("")

    md_content = "\n".join(md_lines)
    md_path = save_stage_artifact(output_dir, "pipeline_audit_report.md", md_content)

    return json_path, md_path
