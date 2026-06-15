"""
Self-correcting LangGraph graph for generating exam summaries.

Nodes
-----
node_sample      – fetch & sample ≤30 questions from the database
node_analyze     – run QuestionAnalyzerGraph → AggregationEngine.aggregate()
node_generate    – build prompt (with optional correction block) & call Gemini
node_validate    – call QualityValidator.validate_summary(); synthesise reason on failure
node_save        – persist valid summary
node_save_best   – persist best-effort summary with MANUAL REVIEW prefix

Routing after node_validate:
  is_valid=True                          → node_save
  is_valid=False AND retry_count < 3     → node_generate  (self-correction loop)
  is_valid=False AND retry_count >= 3    → node_save_best
"""

from __future__ import annotations

import re
import json
import random
import logging
from typing import Optional, TypedDict

from langgraph.graph import StateGraph, END

from quiz.models import Exam, Question
from quiz.ai.gemini_client import GeminiClient
from quiz.ai.prompt_builder import PromptBuilder
from quiz.ai.aggregation_engine import AggregationEngine
from quiz.ai.markdown_formatter import MarkdownFormatter
from quiz.ai.validators import QualityValidator
from quiz.ai.langgraph.base import with_backoff
from quiz.ai.langgraph.question_analysis_graph import QuestionAnalyzerGraph

logger = logging.getLogger("quiz.ai.langgraph.exam_summary_graph")


# State

class SummaryState(TypedDict):
    exam_id: int
    exam_title: str
    sampled_questions: list          # list[dict]
    aggregated_data: dict
    draft_summary: str
    validation_feedback: Optional[str]  # MUST be None on init — never ""
    is_valid: bool
    retry_count: int



# Helpers

def _synthesise_failure_reason(markdown_text: str) -> str:
    """Re-check which REQUIRED_SECTIONS are missing and build a human-readable
    reason string.  The real QualityValidator only returns bool, so we replicate
    its section-check logic here to produce feedback for the correction prompt."""
    missing = []
    if not markdown_text or len(markdown_text) < 500:
        missing.append("Summary is too short (< 500 chars).")
    for section in QualityValidator.REQUIRED_SECTIONS:
        pattern = rf"^#+\s+.*{re.escape(section)}"
        if not re.search(pattern, markdown_text, re.IGNORECASE | re.MULTILINE):
            missing.append(f"Missing required section: '{section}'")
    return "; ".join(missing) if missing else "Unknown validation failure."



# Nodes

def node_sample(state: SummaryState) -> dict:
    """Fetch questions for the exam and sample ≤30."""
    exam = Exam.objects.get(pk=state["exam_id"])
    qs = Question.objects.filter(exam=exam).only(
        "id", "question_text", "subject", "topic", "difficulty", "marks"
    )
    raw = list(
        qs.values("id", "question_text", "subject", "topic", "difficulty", "marks")
    )
    if not raw:
        raise ValueError(f"Exam {state['exam_id']} has no questions.")

    max_sample = 30
    if len(raw) > max_sample:
        random.seed(state["exam_id"])
        sampled = random.sample(raw, max_sample)
    else:
        sampled = raw

    logger.info("Sampled %d / %d questions for exam %s.", len(sampled), len(raw), state["exam_id"])
    return {"sampled_questions": sampled, "exam_title": exam.title}


def node_analyze(state: SummaryState) -> dict:
    """Run question analysis graph, then aggregate."""
    analyzer = QuestionAnalyzerGraph()
    analyzed = analyzer.analyze(state["sampled_questions"])

    # Attach question_text back for the aggregation engine
    validated_by_id = {q["id"]: q for q in state["sampled_questions"]}
    for aq in analyzed:
        q_id = aq.get("id")
        if q_id in validated_by_id:
            aq["question_text"] = validated_by_id[q_id].get("question_text", "")
        else:
            aq["question_text"] = ""

    aggregated = AggregationEngine.aggregate(analyzed)

    # Remove raw question list to prevent token bloat
    aggregated.pop("exam_questions", None)

    logger.info("Aggregation complete for exam %s.", state["exam_id"])
    return {"aggregated_data": aggregated}


@with_backoff
def node_generate(state: SummaryState) -> dict:
    """Build summary prompt (optionally with correction feedback) and call Gemini."""
    aggregated_json = json.dumps(state["aggregated_data"], indent=2)
    prompt = PromptBuilder.build_summary_prompt(state["exam_title"], aggregated_json)

    # Append correction block if there is validation feedback
    if state.get("validation_feedback") is not None:
        retry = state["retry_count"]
        prompt += (
            f"\n\n--- CORRECTION REQUIRED (attempt {retry} of 3) ---\n"
            f"Your previous response was rejected for:\n\n"
            f"{state['validation_feedback']}\n\n"
            f"Rewrite the summary addressing each point above."
        )

    client = GeminiClient()
    result = client.generate_content(prompt)
    raw_summary = result.get("text", "").strip()
    cleaned = MarkdownFormatter.clean(raw_summary)

    logger.info(
        "Generated summary draft (%d chars) using model %s.",
        len(cleaned),
        result.get("model_used", "unknown"),
    )
    return {"draft_summary": cleaned}


def node_validate(state: SummaryState) -> dict:
    """Validate the draft summary.  On failure, synthesise a reason string."""
    is_valid = QualityValidator.validate_summary(state["draft_summary"])

    if is_valid:
        logger.info("Summary passed validation for exam %s.", state["exam_id"])
        return {"is_valid": True, "validation_feedback": None}

    reason = _synthesise_failure_reason(state["draft_summary"])
    retry = state["retry_count"] + 1
    logger.warning(
        "Summary validation FAILED (attempt %d) for exam %s: %s",
        retry, state["exam_id"], reason,
    )
    return {"is_valid": False, "validation_feedback": reason, "retry_count": retry}


def node_save(state: SummaryState) -> dict:
    """Persist the validated summary."""
    Exam.objects.filter(pk=state["exam_id"]).update(ai_summary=state["draft_summary"])
    logger.info("Saved validated summary for exam %s.", state["exam_id"])
    return {}


def node_save_best(state: SummaryState) -> dict:
    """Persist best-effort summary with a manual-review prefix."""
    prefix = (
        "[AUTO-GENERATED — QUALITY CHECK FAILED AFTER 3 RETRIES. "
        "MANUAL REVIEW REQUIRED]\n\n"
    )
    fallback = prefix + state["draft_summary"]
    Exam.objects.filter(pk=state["exam_id"]).update(ai_summary=fallback)
    logger.warning("Saved FALLBACK summary for exam %s (quality check failed).", state["exam_id"])
    return {}



# Routing

def _after_validate(state: SummaryState) -> str:
    if state["is_valid"]:
        return "node_save"
    if state["retry_count"] < 3:
        return "node_generate"
    return "node_save_best"


# Graph compilation

def _build_graph() -> StateGraph:
    g = StateGraph(SummaryState)

    g.add_node("node_sample", node_sample)
    g.add_node("node_analyze", node_analyze)
    g.add_node("node_generate", node_generate)
    g.add_node("node_validate", node_validate)
    g.add_node("node_save", node_save)
    g.add_node("node_save_best", node_save_best)

    g.set_entry_point("node_sample")
    g.add_edge("node_sample", "node_analyze")
    g.add_edge("node_analyze", "node_generate")
    g.add_edge("node_generate", "node_validate")

    g.add_conditional_edges(
        "node_validate",
        _after_validate,
        {
            "node_save": "node_save",
            "node_generate": "node_generate",
            "node_save_best": "node_save_best",
        },
    )

    g.add_edge("node_save", END)
    g.add_edge("node_save_best", END)

    return g



# Public API

class ExamSummaryGraph:
    """Drop-in replacement for ExamSummaryService with a self-correcting loop."""

    def __init__(self):
        self._app = _build_graph().compile()

    def generate(self, exam_id: int) -> SummaryState:
        initial_state: SummaryState = {
            "exam_id": exam_id,
            "exam_title": "",
            "sampled_questions": [],
            "aggregated_data": {},
            "draft_summary": "",
            "validation_feedback": None,   # MUST be None, never ""
            "is_valid": False,
            "retry_count": 0,
        }
        return self._app.invoke(initial_state)
