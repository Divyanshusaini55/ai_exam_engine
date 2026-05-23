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
        """
        Validates the generated markdown summary against quality checks:
        - Must contain all required sections (case-insensitive check for headers).
        - Must have a minimal length of 500 characters.
        """
        if not markdown_text or len(markdown_text) < 500:
            logger.warning("Summary rejected: Length is too short.")
            return False

        # Check for headings (case-insensitive)
        for section in QualityValidator.REQUIRED_SECTIONS:
            # Match # Section or ## Section
            pattern = rf'^#+\s+.*{re.escape(section)}'
            if not re.search(pattern, markdown_text, re.IGNORECASE | re.MULTILINE):
                logger.warning(f"Summary rejected: Missing required section '{section}'")
                return False

        logger.info("Summary passed all quality validation checks.")
        return True
