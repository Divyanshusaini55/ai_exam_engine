import re

class MarkdownFormatter:
    @staticmethod
    def clean(text: str) -> str:
        """
        Cleans up raw output:
        - strips code blocks
        - repairs headings spacing
        - normalizes double lines
        """
        if not text:
            return ""

        # 1. Remove markdown code block wrappers
        text = re.sub(r'^```(?:markdown)?\n', '', text, flags=re.MULTILINE)
        text = re.sub(r'\n```$', '', text, flags=re.MULTILINE)
        text = text.strip()

        # 2. Fix broken headings (ensure a space exists after #)
        text = re.sub(r'^(#+)([^#\s])', r'\1 \2', text, flags=re.MULTILINE)

        # 3. Clean up excessive/duplicate empty lines (keep max 2 consecutive blank lines)
        text = re.sub(r'\n{3,}', '\n\n', text)

        # 4. Remove duplicate spaces in lines but keep newlines
        lines = []
        for line in text.splitlines():
            # If it's not a table line, reduce spaces
            if '|' not in line:
                line = re.sub(r'[ \t]+', ' ', line)
            lines.append(line)

        return "\n".join(lines).strip()
