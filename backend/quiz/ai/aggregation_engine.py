import logging
from quiz.ai.concept_engine import ConceptEngine
from quiz.ai.formula_engine import FormulaEngine
from quiz.ai.pattern_engine import PatternEngine

logger = logging.getLogger('quiz.ai.aggregation_engine')

class AggregationEngine:
    @staticmethod
    def aggregate(analyzed_questions: list) -> dict:
        total = len(analyzed_questions)
        if total == 0:
            return {}

        subjects = {}
        concepts = {}
        formulas = []
        difficulties = {'Easy': 0, 'Medium': 0, 'Hard': 0}
        skills = {}
        weak_topics = {}

        for q in analyzed_questions:
            q_text = q.get('question_text') or ''
            q_id = q.get('id')
            q_text_truncated = (q_text[:200] + '...') if len(q_text) > 200 else q_text

            # Subject Distribution
            sub = q.get('subject') or 'General'
            subjects.setdefault(sub, {'count': 0, 'hard_count': 0, 'examples': []})
            subjects[sub]['count'] += 1
            if q.get('difficulty') == 'Hard':
                subjects[sub]['hard_count'] += 1
            if len(subjects[sub]['examples']) < 3 and q_text:
                subjects[sub]['examples'].append(f"Q#{q_id}: {q_text_truncated}")

            # Concept Mapping
            q_concepts = ConceptEngine.clean_and_normalize(q.get('concepts') or [])
            for c in q_concepts:
                concepts.setdefault(c, {'count': 0, 'examples': []})
                concepts[c]['count'] += 1
                if len(concepts[c]['examples']) < 3 and q_text:
                    concepts[c]['examples'].append(f"Q#{q_id}: {q_text_truncated}")

            # Formulas sheet
            q_formulas = FormulaEngine.clean_and_format(q.get('formulas') or [])
            for f in q_formulas:
                formulas.append({
                    'formula_or_rule': f,
                    'topic': q.get('subtopic') or q.get('subject') or 'General',
                    'usage': f"Specifically applied to solve Question #{q_id} ('{q_text_truncated}')"
                })

            # Skills required
            q_skills = q.get('skills_required') or []
            for s in q_skills:
                skills.setdefault(s, {'count': 0, 'examples': []})
                skills[s]['count'] += 1
                if len(skills[s]['examples']) < 3 and q_text:
                    skills[s]['examples'].append(f"Q#{q_id}: {q_text_truncated}")

            # Difficulty Engine
            diff = q.get('difficulty') or 'Medium'
            if diff in difficulties:
                difficulties[diff] += 1

            # Weak areas tracking (from Hard/Multi-step questions)
            cog_level = q.get('cognitive_level') or 'Application'
            if diff == 'Hard' or cog_level in ('Multi-step', 'Analytical'):
                topic = q.get('subtopic') or q.get('topic') or 'General'
                if topic:
                    weak_topics.setdefault(topic, [])
                    if len(weak_topics[topic]) < 3 and q_text:
                        weak_topics[topic].append(f"Q#{q_id}: {q_text_truncated}")

        # Subject presence formatting
        subject_distribution = []
        for name, stats in subjects.items():
            pct = (stats['count'] / total) * 100
            observation = "Standard coverage."
            if stats['hard_count'] > 0:
                observation = f"Heavy presence of complex analytical questions ({stats['hard_count']} hard questions)."
            elif pct > 40:
                observation = f"Primary subject area dominating the paper."
            if stats['examples']:
                observation += " Key examples: " + " | ".join(stats['examples'])
            subject_distribution.append({
                'subject': name,
                'presence': f"{pct:.1f}% ({stats['count']}/{total} questions)",
                'observation': observation
            })

        # Concept frequency list
        concept_map = []
        for name, stats in concepts.items():
            concept_map.append({
                'concept': name,
                'frequency': stats['count'],
                'tested_in_questions': stats['examples']
            })
        concept_map.sort(key=lambda x: x['frequency'], reverse=True)

        # Skills frequency
        skills_required = []
        for name, stats in skills.items():
            skills_required.append({
                'skill': name,
                'frequency': stats['count'],
                'tested_in_questions': stats['examples']
            })
        skills_required.sort(key=lambda x: x['frequency'], reverse=True)

        # Pattern extraction
        patterns = PatternEngine.extract_patterns(analyzed_questions)

        # Difficulty percentages
        difficulty_percentages = {
            'Easy': f"{(difficulties['Easy'] / total) * 100:.1f}%",
            'Medium': f"{(difficulties['Medium'] / total) * 100:.1f}%",
            'Hard': f"{(difficulties['Hard'] / total) * 100:.1f}%"
        }

        # Deduplicate and consolidate formula sheet entries
        formula_sheet = []
        seen_formulas = set()
        for item in formulas:
            key = item['formula_or_rule'].lower()
            if key not in seen_formulas:
                seen_formulas.add(key)
                formula_sheet.append(item)

        # Format weak areas list
        formatted_weak_areas = []
        for topic, examples in list(weak_topics.items())[:8]:
            formatted_weak_areas.append({
                'topic': topic,
                'example_questions': examples
            })

        # Catalog of all questions in the exam
        exam_questions_list = []
        for q in analyzed_questions:
            q_text = q.get('question_text') or ''
            q_text_truncated = (q_text[:200] + '...') if len(q_text) > 200 else q_text
            exam_questions_list.append({
                'id': q.get('id'),
                'question_text': q_text_truncated,
                'subject': q.get('subject'),
                'subtopic': q.get('subtopic') or q.get('topic'),
                'concepts': ConceptEngine.clean_and_normalize(q.get('concepts') or []),
                'formulas': FormulaEngine.clean_and_format(q.get('formulas') or []),
                'difficulty': q.get('difficulty'),
                'cognitive_level': q.get('cognitive_level')
            })

        return {
            'subject_distribution': subject_distribution,
            'concept_map': concept_map[:25],  # Top 25 concepts
            'formula_sheet': formula_sheet[:20],    # Top 20 formulas
            'skills_required': skills_required,
            'question_patterns': patterns['blueprints'],
            'tricks_shortcuts': patterns['techniques'],
            'weak_areas': formatted_weak_areas,
            'difficulty_profile': {
                'distribution': difficulty_percentages,
                'counts': difficulties
            },
            'exam_questions': exam_questions_list
        }
