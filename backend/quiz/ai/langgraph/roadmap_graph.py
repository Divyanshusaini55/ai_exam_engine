"""
LangGraph graph replacing the linear RoadmapEngine pipeline.

Generates a structured JSON study roadmap from a syllabus PDF (or from
general AI knowledge when no PDF is available).  Retries once with a
stricter prompt on schema-validation failure.

Nodes
-----
node_extract_pdf     – extract text from PDF via PyPDF2 (or set empty)
node_build_prompt    – construct the roadmap prompt (stricter on retry)
node_generate_json   – call Gemini (with backoff)
node_validate_schema – parse JSON, check schema, route accordingly

Routing after node_validate_schema:
  roadmap is not None                → END
  roadmap is None AND retry ≤ 1     → node_build_prompt  (one retry)
  roadmap is None AND retry > 1     → END  (accept None, log error)
"""

from __future__ import annotations

import re
import json
import logging
from typing import Optional, TypedDict

import PyPDF2
from langgraph.graph import StateGraph, END

from quiz.ai.gemini_client import GeminiClient
from quiz.ai.langgraph.base import with_backoff

logger = logging.getLogger("quiz.ai.langgraph.roadmap_graph")



# State


class RoadmapState(TypedDict):
    pdf_path: Optional[str]
    syllabus_text: str
    prompt: str
    raw_json: str
    roadmap: Optional[dict]
    retry_count: int
    error: Optional[str]



# Nodes


def node_extract_pdf(state: RoadmapState) -> dict:
    """Extract text from the PDF if a path is provided."""
    pdf_path = state.get("pdf_path")
    if not pdf_path:
        return {"syllabus_text": ""}

    try:
        with open(pdf_path, "rb") as fh:
            reader = PyPDF2.PdfReader(fh)
            pages = [page.extract_text() or "" for page in reader.pages]
        text = "\n".join(pages).strip()

        # Clean — same logic as the existing RoadmapEngine
        text = text.encode("utf-8", "ignore").decode("utf-8")
        text = re.sub(r"[\ud800-\udfff]", "", text)
        text = re.sub(r"[ \t]+", " ", text)
        text = re.sub(r"(?i)page\s+\d+(\s+of\s+\d+)?", "", text)
        text = re.sub(r"\n{3,}", "\n\n", text)

        logger.info("Extracted %d chars from PDF %s.", len(text), pdf_path)
        return {"syllabus_text": text.strip()}
    except Exception as exc:
        logger.warning("Failed to read PDF %s: %s — falling back to AI knowledge.", pdf_path, exc)
        return {"syllabus_text": ""}


def node_build_prompt(state: RoadmapState) -> dict:
    """Build the roadmap-generation prompt."""
    syllabus = state.get("syllabus_text", "")
    retry = state.get("retry_count", 0)

    schema_block = (
        '{"phases": [{"name": str, "subjects": [{"name": str, "topics": '
        '[{"name": str, "time_estimate_hours": int, "prerequisites": [str]}]}]}]}'
    )

    if syllabus:
        truncated = syllabus[:8000]
        prompt = (
            "You are an expert curriculum designer for competitive examinations.\n"
            "Analyze the following syllabus text and produce a structured study roadmap.\n\n"
            "---\nSyllabus Content:\n"
            f"{truncated}\n"
            "---\n\n"
            "Return a JSON object matching this EXACT schema:\n"
            f"{schema_block}\n\n"
            "RULES:\n"
            "- Cover ALL subjects mentioned in the syllabus.\n"
            "- Group related subtopics into coherent chapter-level topics.\n"
            "- Map prerequisite dependencies between topics.\n"
            "- Respond ONLY with valid JSON. No markdown, no prose.\n"
        )
    else:
        prompt = (
            "You are an expert curriculum designer for Indian competitive exams "
            "(UPSC, SSC, Banking).\n"
            "Create a detailed study roadmap covering all major subjects.\n\n"
            "Return a JSON object matching this EXACT schema:\n"
            f"{schema_block}\n\n"
            "RULES:\n"
            "- Include all standard subjects (Quantitative Aptitude, Reasoning, "
            "English, General Awareness, etc.).\n"
            "- Map prerequisite dependencies between topics.\n"
            "- Respond ONLY with valid JSON. No markdown, no prose.\n"
        )

    if retry > 0:
        prompt += (
            "\n\nIMPORTANT: Return ONLY valid JSON. "
            "No markdown, no prose, no explanation."
        )

    return {"prompt": prompt}


@with_backoff
def node_generate_json(state: RoadmapState) -> dict:
    """Call GeminiClient to generate the roadmap JSON."""
    client = GeminiClient()
    result = client.generate_content(state["prompt"])
    raw = result.get("text", "").strip()

    # Strip markdown fences
    if raw.startswith("```json"):
        raw = raw[7:]
    if raw.startswith("```"):
        raw = raw[3:]
    if raw.endswith("```"):
        raw = raw[:-3]
    raw = raw.strip()

    logger.info("LLM returned %d chars for roadmap generation.", len(raw))
    return {"raw_json": raw}


def node_validate_schema(state: RoadmapState) -> dict:
    """Parse raw_json and validate the roadmap schema."""
    raw = state.get("raw_json", "")
    retry = state.get("retry_count", 0)

    try:
        data = json.loads(raw)
        phases = data.get("phases")
        if not isinstance(phases, list) or len(phases) == 0:
            raise ValueError("'phases' must be a non-empty list.")
        for i, phase in enumerate(phases):
            if "name" not in phase:
                raise ValueError(f"Phase {i} missing 'name'.")
            if "subjects" not in phase:
                raise ValueError(f"Phase {i} missing 'subjects'.")
        logger.info("Roadmap schema validation passed (%d phases).", len(phases))
        return {"roadmap": data, "error": None}
    except Exception as exc:
        logger.warning("Roadmap schema validation failed (attempt %d): %s", retry + 1, exc)
        return {"roadmap": None, "error": str(exc), "retry_count": retry + 1}



# Routing


def _after_validate(state: RoadmapState) -> str:
    if state.get("roadmap") is not None:
        return END
    if state.get("retry_count", 0) <= 1:
        return "node_build_prompt"
    logger.error("Roadmap generation failed after retries. Returning None.")
    return END



# Graph compilation


def _build_graph() -> StateGraph:
    g = StateGraph(RoadmapState)

    g.add_node("node_extract_pdf", node_extract_pdf)
    g.add_node("node_build_prompt", node_build_prompt)
    g.add_node("node_generate_json", node_generate_json)
    g.add_node("node_validate_schema", node_validate_schema)

    g.set_entry_point("node_extract_pdf")
    g.add_edge("node_extract_pdf", "node_build_prompt")
    g.add_edge("node_build_prompt", "node_generate_json")
    g.add_edge("node_generate_json", "node_validate_schema")

    g.add_conditional_edges(
        "node_validate_schema",
        _after_validate,
        {"node_build_prompt": "node_build_prompt", END: END},
    )

    return g



# Public API

class RoadmapEngineGraph:
    """Drop-in replacement for the linear RoadmapEngine."""

    def __init__(self):
        self._app = _build_graph().compile()

    def generate(self, pdf_path: Optional[str] = None) -> Optional[dict]:
        initial_state: RoadmapState = {
            "pdf_path": pdf_path,
            "syllabus_text": "",
            "prompt": "",
            "raw_json": "",
            "roadmap": None,
            "retry_count": 0,
            "error": None,
        }
        final = self._app.invoke(initial_state)
        return final.get("roadmap")
