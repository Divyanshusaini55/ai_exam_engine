import re
import logging

logger = logging.getLogger('quiz.ai.validators')

class QualityValidator:
    REQUIRED_SECTIONS = [
        "Overview",
        "Subject Coverage",
        "Skills Required",
        "Concept Map",
        "Formula Sheet",
        "Question Patterns",
        "Preparation Guide",
        "Weak Areas",
        "Difficulty"
    ]

    @staticmethod
    def validate_summary(markdown_text: str) -> bool:
        if not markdown_text or len(markdown_text) < 500:
            logger.warning("Summary rejected: Length is too short.")
            return False
        for section in QualityValidator.REQUIRED_SECTIONS:
            # Match # Section or ## Section
            pattern = rf'^#+\s+.*{re.escape(section)}'
            if not re.search(pattern, markdown_text, re.IGNORECASE | re.MULTILINE):
                logger.warning(f"Summary rejected: Missing required section '{section}'")
                return False

        logger.info("Summary passed all quality validation checks.")
        return True
