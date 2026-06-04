import re
import logging

logger = logging.getLogger('quiz.ai.formula_engine')

class FormulaEngine:
    @staticmethod
    def clean_and_format(formulas_list: list) -> list:
        if not formulas_list:
            return []

        cleaned = []
        seen = set()

        for formula in formulas_list:
            if not formula or not isinstance(formula, str):
                continue

            form = formula.strip()
            if re.search(r'[+\-*/=^_\\]', form) and not (form.startswith('$') and form.endswith('$')):
                form = f"${form}$"

            form_lower = form.lower()
            if form_lower not in seen:
                seen.add(form_lower)
                cleaned.append(form)

        return cleaned
