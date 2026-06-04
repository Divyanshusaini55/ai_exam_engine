import re

class MarkdownFormatter:
    @staticmethod
    def clean(text: str) -> str:
        if not text:
            return ""

        text = re.sub(r'^```(?:markdown)?\n', '', text, flags=re.MULTILINE)
        text = re.sub(r'\n```$', '', text, flags=re.MULTILINE)
        text = text.strip()

        text = re.sub(r'^(#+)([^#\s])', r'\1 \2', text, flags=re.MULTILINE)

        text = re.sub(r'\n{3,}', '\n\n', text)
        lines = []
        for line in text.splitlines():
            if '|' not in line:
                line = re.sub(r'[ \t]+', ' ', line)
            lines.append(line)

        return "\n".join(lines).strip()
