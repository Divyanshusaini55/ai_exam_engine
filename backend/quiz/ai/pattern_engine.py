import logging

logger = logging.getLogger('quiz.ai.pattern_engine')

class PatternEngine:
    @staticmethod
    def extract_patterns(analyzed_questions: list) -> dict:
        techniques = {}
        blueprints = {}
        for q in analyzed_questions:
            cog_level = q.get('cognitive_level') or 'Application'
            blueprints.setdefault(cog_level, 0)
            blueprints[cog_level] += 1
            methods = q.get('methods') or []
            for method in methods:
                norm_method = method.strip()
                if not norm_method:
                    continue
                techniques.setdefault(norm_method, {'frequency': 0, 'difficulty': 'Medium'})
                techniques[norm_method]['frequency'] += 1
                q_diff = q.get('difficulty') or 'Medium'
                if q_diff == 'Hard':
                    techniques[norm_method]['difficulty'] = 'Hard'
        formatted_techniques = []
        for name, stats in techniques.items():
            formatted_techniques.append({
                'technique': name,
                'frequency': stats['frequency'],
                'difficulty': stats['difficulty']
            })

        formatted_blueprints = []
        for level, count in blueprints.items():
            skill_map = {
                'Recall': 'Memorization & Conceptual Recall',
                'Application': 'Formula & Rule Application',
                'Multi-step': 'Logical Sequencing & Calculation',
                'Analytical': 'Pattern Spotting & Breakdown',
                'Conceptual': 'Fundamental Understanding'
            }
            formatted_blueprints.append({
                'question_type': level,
                'required_skill': skill_map.get(level, 'Problem Solving'),
                'count': count
            })

        return {
            'techniques': formatted_techniques,
            'blueprints': formatted_blueprints
        }
