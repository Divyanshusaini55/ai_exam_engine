from __future__ import annotations
import json
import logging
import concurrent.futures
from typing import List, Dict, Any, Optional
from pydantic import BaseModel

from quiz.ai.gemini_client import GeminiClient
from quiz.ai.concept_engine import ConceptEngine
from quiz.ai.formula_engine import FormulaEngine
from quiz.ai import extract_json_from_text

logger = logging.getLogger("quiz.ai.examintel.academic_tutor_agent")


class EnrichedAcademicData(BaseModel):
    subject: str = "General"
    topic: str = "General"
    subtopic: str = "General"
    cognitive_level: str = "apply"
    difficulty_label: str = "Medium"
    difficulty_score: Optional[float] = 0.5
    tags: List[str] = []
    ideal_time_seconds: int = 60
    explanation_en: str = ""
    explanation_hi: Optional[str] = None
    hints: List[str] = []
    solution_steps: List[str] = []


class AcademicTutorAgent:
    """
    Batched AI Agent that enriches questions with Bloom's taxonomy cognitive levels,
    academic subject/topic taxonomy, KaTeX-formatted bilingual explanations,
    and progressive Socratic hints.
    """

    def __init__(self, client: Optional[GeminiClient] = None):
        self.client = client or GeminiClient()

    def enrich_questions_batch(
        self,
        questions_data: List[Dict[str, Any]],
        batch_size: int = 15,
        max_workers: int = 4,
    ) -> List[EnrichedAcademicData]:
        """
        Enriches a list of questions concurrently in batches of `batch_size`.
        """
        if not questions_data:
            return []

        batches = [questions_data[i : i + batch_size] for i in range(0, len(questions_data), batch_size)]
        results_map: Dict[int, EnrichedAcademicData] = {}

        def process_batch(batch_tuple: tuple[int, List[Dict[str, Any]]]):
            b_idx, batch = batch_tuple
            prompt_items = []
            for item in batch:
                prompt_items.append({
                    "item_id": item["item_id"],
                    "section": item.get("section", "General"),
                    "topic_hint": item.get("topic_hint", ""),
                    "stem_en": item.get("stem_en", ""),
                    "stem_hi": item.get("stem_hi", ""),
                    "options": item.get("options", []),
                    "correct_option": item.get("correct_option", ""),
                })

            prompt = self._build_enrichment_prompt(prompt_items)
            try:
                res = self.client.generate_content(prompt)
                parsed_json = extract_json_from_text(res.get("text", ""))
                if isinstance(parsed_json, list):
                    batch_dict = {
                        it.get("item_id"): it for it in parsed_json if isinstance(it, dict) and "item_id" in it
                    }
                    for item in batch:
                        iid = item["item_id"]
                        enriched = batch_dict.get(iid)
                        if enriched:
                            results_map[iid] = self._normalize_enriched_item(enriched, item)
                        else:
                            results_map[iid] = self.generate_heuristics_enrichment(item)
                else:
                    for item in batch:
                        results_map[item["item_id"]] = self.generate_heuristics_enrichment(item)
            except Exception as e:
                logger.warning(f"Batch {b_idx} academic enrichment failed: {e}. Using heuristics.")
                for item in batch:
                    results_map[item["item_id"]] = self.generate_heuristics_enrichment(item)

        indexed_batches = list(enumerate(batches))
        with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
            list(executor.map(process_batch, indexed_batches))

        # Return ordered by original sequence
        return [results_map.get(item["item_id"], self.generate_heuristics_enrichment(item)) for item in questions_data]

    def _build_enrichment_prompt(self, items: List[Dict[str, Any]]) -> str:
        items_str = json.dumps(items, ensure_ascii=False, indent=1)
        return f"""You are an elite academic curriculum designer and pedagogical expert.
Analyze the following exam questions and produce an academic intelligence and tutor package for each.

For EACH question item, infer:
1. subject: Academic discipline (e.g. "Quantitative Aptitude", "General Knowledge", "General Hindi", "Reasoning", "English").
2. topic: Core topic (use topic_hint if available, or infer e.g. "Number System", "Mirror Images", "कारक").
3. subtopic: Specific concept tested (e.g. "Recurring Decimals", "Lateral Inversion", "कर्म कारक").
4. cognitive_level: One of "remember", "understand", "apply", "analyze", "evaluate".
5. difficulty_label: "Easy", "Medium", or "Hard".
6. difficulty_score: Float between 0.1 (easiest) and 0.9 (hardest).
7. tags: 2-4 lowercase hyphenated tags (e.g. ["number-system", "fractions"]).
8. ideal_time_seconds: Expected solving time in seconds (e.g. 30 to 120).
9. explanation_en: Clear, rigorous explanation in English using KaTeX for all math ($...$, $$...$$).
10. explanation_hi: Clear explanation in Hindi (if question is bilingual or Hindi) with KaTeX math.
11. hints: 1-2 progressive Socratic hints for learning mode (e.g. ["First convert repeating decimals to standard fractions."]).
12. solution_steps: 2-3 concise solution steps.

Return ONLY a strict JSON array of objects mapping by item_id:
[
  {{
    "item_id": 1,
    "subject": "Quantitative Aptitude",
    "topic": "Number System",
    "subtopic": "Recurring Decimals",
    "cognitive_level": "apply",
    "difficulty_label": "Medium",
    "difficulty_score": 0.45,
    "tags": ["number-system", "fractions"],
    "ideal_time_seconds": 45,
    "explanation_en": "Step 1: Let $x = 0.35858...$",
    "explanation_hi": "चरण 1: माना $x = 0.35858...$",
    "hints": ["Multiply by 10 to isolate the non-repeating part."],
    "solution_steps": ["Set up equation $1000x - 10x = 358.58 - 3.58$", "Solve $990x = 355 \\implies x = \\frac{{355}}{{990}}$"]
  }}
]

Questions:
{items_str}
"""

    def _normalize_enriched_item(self, enriched: Dict[str, Any], raw_item: Dict[str, Any]) -> EnrichedAcademicData:
        subject = enriched.get("subject") or raw_item.get("section") or "General"
        topic = enriched.get("topic") or raw_item.get("topic_hint") or "General"
        subtopic = enriched.get("subtopic") or topic or "General"

        cog = str(enriched.get("cognitive_level", "apply")).lower()
        if cog not in ["remember", "understand", "apply", "analyze", "evaluate"]:
            cog = "apply"

        diff_label = str(enriched.get("difficulty_label", "Medium")).capitalize()
        if diff_label not in ["Easy", "Medium", "Hard"]:
            diff_label = "Medium"

        try:
            diff_score = float(enriched.get("difficulty_score", 0.5))
        except Exception:
            diff_score = 0.5

        tags = enriched.get("tags") or [subject.lower().replace(" ", "-")]
        if not isinstance(tags, list):
            tags = [str(tags)]

        try:
            ideal_time = int(enriched.get("ideal_time_seconds", 60))
        except Exception:
            ideal_time = 60

        exp_en = str(enriched.get("explanation_en") or enriched.get("explanation") or "").strip()
        exp_hi = enriched.get("explanation_hi")
        if exp_hi:
            exp_hi = str(exp_hi).strip()

        hints = enriched.get("hints") or []
        if isinstance(hints, str):
            hints = [hints]

        steps = enriched.get("solution_steps") or []
        if isinstance(steps, str):
            steps = [steps]

        return EnrichedAcademicData(
            subject=subject,
            topic=topic,
            subtopic=subtopic,
            cognitive_level=cog,
            difficulty_label=diff_label,
            difficulty_score=diff_score,
            tags=tags,
            ideal_time_seconds=ideal_time,
            explanation_en=exp_en,
            explanation_hi=exp_hi,
            hints=hints,
            solution_steps=steps,
        )

    @classmethod
    def generate_heuristics_enrichment(cls, raw_item: Dict[str, Any]) -> EnrichedAcademicData:
        """Fallback deterministic heuristic enrichment without calling LLM."""
        section = raw_item.get("section") or "General"
        topic = raw_item.get("topic_hint") or section

        # Infer basic cognitive level and subject
        sec_l = section.lower()
        if "hindi" in sec_l:
            subject = "General Hindi"
            cog = "remember"
            tags = ["general-hindi", "grammar"]
        elif "reasoning" in sec_l or "mental" in sec_l:
            subject = "Reasoning"
            cog = "analyze"
            tags = ["reasoning", "logical-ability"]
        elif "aptitude" in sec_l or "numerical" in sec_l or "math" in sec_l:
            subject = "Quantitative Aptitude"
            cog = "apply"
            tags = ["quantitative-aptitude", "mathematics"]
        elif "law" in sec_l or "constitution" in sec_l:
            subject = "Law & Constitution"
            cog = "remember"
            tags = ["law", "constitution", "general-knowledge"]
        else:
            subject = section
            cog = "understand"
            tags = [subject.lower().replace(" ", "-")]

        corr = raw_item.get("correct_option") or ""
        exp = f"Correct option is ({corr})." if corr else "Correct answer as verified in official answer key."

        return EnrichedAcademicData(
            subject=subject,
            topic=topic,
            subtopic=topic,
            cognitive_level=cog,
            difficulty_label="Medium",
            difficulty_score=0.5,
            tags=tags,
            ideal_time_seconds=60,
            explanation_en=exp,
            explanation_hi=None,
            hints=[],
            solution_steps=[],
        )
