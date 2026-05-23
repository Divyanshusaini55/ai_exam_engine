import logging

logger = logging.getLogger('quiz.ai.pattern_engine')

class PatternEngine:
    @staticmethod
    def extract_patterns(analyzed_questions: list) -> dict:
        """
        Deduce tricks, shortcuts, cognitive levels, and question styles from the analyzed questions.
        """
        techniques = {}
        blueprints = {}

        # 1. Blueprint (Question Type -> Required Skill)
        # 2. Tricks & Shortcuts (Technique -> Frequency, Difficulty)
        for q in analyzed_questions:
            # Cognitive Level Mapping
            cog_level = q.get('cognitive_level') or 'Application'
            blueprints.setdefault(cog_level, 0)
            blueprints[cog_level] += 1

            # Extract methods/solving techniques
            methods = q.get('methods') or []
            for method in methods:
                norm_method = method.strip()
                if not norm_method:
                    continue
                techniques.setdefault(norm_method, {'frequency': 0, 'difficulty': 'Medium'})
                techniques[norm_method]['frequency'] += 1
                
                # Dynamic difficulty heuristic based on question difficulty
                q_diff = q.get('difficulty') or 'Medium'
                if q_diff == 'Hard':
                    techniques[norm_method]['difficulty'] = 'Hard'

        # Format techniques output
        formatted_techniques = []
        for name, stats in techniques.items():
            formatted_techniques.append({
                'technique': name,
                'frequency': stats['frequency'],
                'difficulty': stats['difficulty']
            })

        # Format blueprint
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
