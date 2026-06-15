"""
LangGraph graph replacing the linear QuestionAnalyzer pipeline.

Nodes
-----
node_ingest    – deduplicate & validate raw questions
node_batch     – slice into chunks of 30
node_call_llm  – call Gemini via PromptBuilder (with backoff)
node_parse     – parse JSON, fall back to DEFAULT_METADATA on failure

Routing: after node_parse loop back to node_call_llm while batches remain.
"""

from __future__ import annotations

import json
import re
import logging
import operator
from typing import Annotated, List, Optional, Set, TypedDict

from langgraph.graph import StateGraph, END

from quiz.ai.gemini_client import GeminiClient
from quiz.ai.prompt_builder import PromptBuilder
from quiz.ai.langgraph.base import with_backoff, append

logger = logging.getLogger("quiz.ai.langgraph.question_analysis_graph")


# State

class QuestionAnalysisState(TypedDict):
    raw_questions: list                          # input — list[dict]
    deduplicated: list                           # after ingest — list[dict]
    batches: list                                # list[list[dict]]
    current_batch_index: int
    results: Annotated[List[dict], operator.add]  # accumulates across batches
    _llm_raw: str
    error: Optional[str]


# Default metadata fallback (matches QuestionAnalyzer._make_default_analysis)

def _default_metadata(q: dict) -> dict:
    return {
        "id": q.get("id"),
        "subject": q.get("subject", "General"),
        "subtopic": q.get("topic", "General"),
        "difficulty": q.get("difficulty", "Medium"),
        "skills_required": ["Understanding"],
        "concepts": [q.get("topic", "General")],
        "formulas": [],
        "methods": [],
        "cognitive_level": "Application",
    }



# Nodes

def node_ingest(state: QuestionAnalysisState) -> dict:
    """Strip, deduplicate, and validate raw_questions."""
    validated = []
    seen_texts: Set[str] = set()

    for idx, q in enumerate(state["raw_questions"]):
        text = (q.get("question_text") or "").strip()
        if not text:
            continue
        normalised = re.sub(r"\s+", " ", text.lower())
        if normalised in seen_texts:
            continue
        seen_texts.add(normalised)
        validated.append({
            "id": q.get("id") or (idx + 1),
            "question_text": text,
            "options": q.get("options") or [],
            "subject": q.get("subject") or "General",
            "topic": q.get("topic") or "General",
            "difficulty": q.get("difficulty") or "Medium",
            "marks": q.get("marks") or q.get("points") or 1,
            "question_type": q.get("question_type") or "MCQ",
        })

    logger.info(
        "Ingested %d questions (removed %d invalid/duplicates).",
        len(validated),
        len(state["raw_questions"]) - len(validated),
    )
    return {
        "deduplicated": validated,
        "current_batch_index": 0,
        "results": [],
    }


def node_batch(state: QuestionAnalysisState) -> dict:
    """Slice deduplicated questions into batches of 30."""
    items = state["deduplicated"]
    batch_size = 30
    batches = [items[i : i + batch_size] for i in range(0, len(items), batch_size)]
    logger.info("Created %d batch(es) of ≤30 questions.", len(batches))
    return {"batches": batches}


@with_backoff
def node_call_llm(state: QuestionAnalysisState) -> dict:
    """Build prompt for the current batch and call GeminiClient."""
    idx = state["current_batch_index"]
    batch = state["batches"][idx]
    batch_json = json.dumps(batch, indent=2)
    prompt = PromptBuilder.build_question_analysis_prompt(batch_json)

    client = GeminiClient()
    result = client.generate_content(prompt)
    raw_text = result.get("text", "").strip()
    logger.info("LLM returned %d chars for batch %d.", len(raw_text), idx)
    return {"_llm_raw": raw_text}


def node_parse(state: QuestionAnalysisState) -> dict:
    """Parse _llm_raw as JSON list.  Fallback to DEFAULT_METADATA on failure."""
    raw = state.get("_llm_raw", "")
    idx = state["current_batch_index"]
    batch = state["batches"][idx]
    error = None

    # Strip markdown fences
    cleaned = raw.strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    if cleaned.startswith("```"):
        cleaned = cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    cleaned = cleaned.strip()

    parsed: Optional[List[dict]] = None
    try:
        data = json.loads(cleaned)
        if isinstance(data, list):
            parsed = data
        else:
            raise ValueError("Expected a JSON list, got %s" % type(data).__name__)
    except Exception as exc:
        error = f"Batch {idx} parse error: {exc}"
        logger.warning(error)

    if parsed is None:
        logger.info("Falling back to DEFAULT_METADATA for batch %d.", idx)
        parsed = [_default_metadata(q) for q in batch]

    return {
        "results": parsed,
        "current_batch_index": idx + 1,
        "_llm_raw": "",
        "error": error,
    }



# Routing

def _after_parse(state: QuestionAnalysisState) -> str:
    if state["current_batch_index"] < len(state["batches"]):
        return "node_call_llm"
    return END



# Graph compilation

def _build_graph() -> StateGraph:
    g = StateGraph(QuestionAnalysisState)

    g.add_node("node_ingest", node_ingest)
    g.add_node("node_batch", node_batch)
    g.add_node("node_call_llm", node_call_llm)
    g.add_node("node_parse", node_parse)

    g.set_entry_point("node_ingest")
    g.add_edge("node_ingest", "node_batch")
    g.add_edge("node_batch", "node_call_llm")
    g.add_edge("node_call_llm", "node_parse")

    g.add_conditional_edges(
        "node_parse",
        _after_parse,
        {"node_call_llm": "node_call_llm", END: END},
    )

    return g



# Public API

class QuestionAnalyzerGraph:
    """Drop-in replacement for the linear QuestionAnalyzer pipeline."""

    def __init__(self):
        self._app = _build_graph().compile()

    def analyze(self, questions: List[dict]) -> List[dict]:
        """Run the full question-analysis graph and return accumulated results."""
        initial_state: QuestionAnalysisState = {
            "raw_questions": questions,
            "deduplicated": [],
            "batches": [],
            "current_batch_index": 0,
            "results": [],
            "_llm_raw": "",
            "error": None,
        }
        final = self._app.invoke(initial_state)
        return final["results"]
