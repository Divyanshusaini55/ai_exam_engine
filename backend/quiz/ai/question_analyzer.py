import json
import logging
import re
from quiz.ai.gemini_client import GeminiClient
from quiz.ai.prompt_builder import PromptBuilder

logger = logging.getLogger('quiz.ai.question_analyzer')

class QuestionAnalyzer:
    def __init__(self, client: GeminiClient):
        self.client = client

    def ingest_and_validate(self, raw_questions: list) -> list:
        validated = []
        seen_texts = set()

        for idx, q in enumerate(raw_questions):
            text = q.get('question_text', '').strip()
            if not text:
                logger.warning(f"Ingestion skip: Question index {idx} has missing text.")
                continue

            # Normalize text for deduplication
            normalized_text = re.sub(r'\s+', ' ', text.lower())
            if normalized_text in seen_texts:
                logger.debug(f"Ingestion duplicate skip: Question '{text[:50]}...'")
                continue

            seen_texts.add(normalized_text)

            # Normalization of fields
            validated.append({
                'id': q.get('id') or (idx + 1),
                'question_text': text,
                'options': q.get('options') or [],
                'subject': q.get('subject') or 'General',
                'topic': q.get('topic') or 'General',
                'difficulty': q.get('difficulty') or 'Medium',
                'marks': q.get('marks') or q.get('points') or 1,
                'question_type': q.get('question_type') or 'MCQ'
            })

        logger.info(f"Ingested and validated {len(validated)} questions (removed {len(raw_questions) - len(validated)} invalid/duplicates).")
        return validated

    def analyze_questions(self, questions: list, batch_size: int = 30) -> list:
        analyzed_results = []
        for start_idx in range(0, len(questions), batch_size):
            batch = questions[start_idx : start_idx + batch_size]
            logger.info(f"Analyzing batch of size {len(batch)} (questions {start_idx + 1} to {start_idx + len(batch)})")

            # Prepare structured JSON directly (do not convert to plain text prompts)
            batch_json = json.dumps(batch, indent=2)
            prompt = PromptBuilder.build_question_analysis_prompt(batch_json)

            try:
                result = self.client.generate_content(prompt)
                raw_text = result.get('text', '').strip()

                try:
                    data = json.loads(raw_text)
                except json.JSONDecodeError:
                    from quiz.ai import extract_json_from_text
                    data = extract_json_from_text(raw_text)

                if data and isinstance(data, list):
                    analyzed_results.extend(data)
                else:
                    logger.warning(f"Batch returned invalid format. Output length: {len(raw_text)}")
                    # Fallback default objects
                    for q in batch:
                        analyzed_results.append(self._make_default_analysis(q))

            except Exception as e:
                logger.error(f"Error during batch analysis: {e}")
                # Fallback on complete failure
                for q in batch:
                    analyzed_results.append(self._make_default_analysis(q))

        return analyzed_results

    def _make_default_analysis(self, q: dict) -> dict:
        return {
            'id': q['id'],
            'subject': q.get('subject', 'General'),
            'subtopic': q.get('topic', 'General'),
            'difficulty': q.get('difficulty', 'Medium'),
            'skills_required': ['Understanding'],
            'concepts': [q.get('topic', 'General')],
            'formulas': [],
            'methods': [],
            'cognitive_level': 'Application'
        }
