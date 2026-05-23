import logging

logger = logging.getLogger('quiz.ai.concept_engine')

class ConceptEngine:
    @staticmethod
    def clean_and_normalize(concepts_list: list) -> list:
        """
        Normalizes concept names:
        - strips whitespaces
        - capitalizes first letter
        - deduplicates case-insensitively
        """
        if not concepts_list:
            return []

        cleaned = []
        seen = set()

        for concept in concepts_list:
            if not concept or not isinstance(concept, str):
                continue
                
            norm = concept.strip()
            # Normalize title case or sentence case
            if len(norm) > 1:
                norm = norm[0].upper() + norm[1:]
                
            norm_lower = norm.lower()
            if norm_lower not in seen:
                seen.add(norm_lower)
                cleaned.append(norm)

        return cleaned
