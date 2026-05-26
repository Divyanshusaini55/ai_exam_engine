class PromptBuilder:
    @staticmethod
    def build_question_analysis_prompt(questions_json: str) -> str:
        return f"""
You are an expert academic analyst.
Analyze the following list of exam questions in JSON and infer the academic solving intelligence for each:
- subject: General subject area (e.g. "Math", "Physics", "Computer Science", "History", "Grammar", etc.).
- subtopic: Specific subtopic (e.g. "Probability", "Electrostatics", "Array traversal", "Tenses", etc.).
- difficulty: "Easy", "Medium", or "Hard".
- skills_required: List of cognitive/academic skills needed (e.g. "Algebraic reasoning", "Logical sequencing", "Memorization", "Text comprehension").
- concepts: List of academic concepts tested (e.g. "Permutation", "Coulomb's Law", "recursion", "Subject-verb agreement").
- formulas: List of mathematical/scientific/logical equations or formulas required (e.g. "$P(A) = \\frac{{n(A)}}{{n(S)}}$", or empty if none). Use LaTeX math formatting.
- methods: List of solving methods/heuristics (e.g. "Cross multiplication", "Truth table", "Elimination", "Coordinate tracking").
- cognitive_level: One of "Recall", "Application", "Multi-step", "Analytical", "Conceptual".

Return ONLY a valid JSON list matching this schema, mapping each question by its ID:
[
  {{
    "id": 1,
    "subject": "...",
    "subtopic": "...",
    "difficulty": "...",
    "skills_required": ["..."],
    "concepts": ["..."],
    "formulas": ["..."],
    "methods": ["..."],
    "cognitive_level": "..."
  }}
]

Questions:
{questions_json}
"""

    @staticmethod
    def build_summary_prompt(exam_title: str, aggregated_json: str) -> str:
        return f"""
You are an expert academic evaluator.
Generate a focused, structured academic analysis and overview for the exam "{exam_title}".

Inputs:
Use the following aggregated statistics and patterns JSON. Analyze it to produce your report:
{aggregated_json}

CRITICAL RULES:
1. Keep your analysis concise and impactful. Avoid overly long paragraphs. Use bullet points where appropriate.
2. Ground key observations in specific questions from the exam. CITE specific question IDs (e.g. Question #12) to illustrate your points, but do not do this for every single item if it becomes repetitive.
3. Output must be a clean, structured Exam Analysis + Coaching Notes.

Your summary MUST follow this markdown structure exactly:

# Overview
[Provide a concise overview of the exam's general difficulty, scope, and coverage. Mention key question styles and cognitive reasoning required.]

---

# Subject Coverage
[Generate a detailed markdown table showing the breakdown of subjects in the exam. Columns: Subject | Presence | Observation. Columns must be:
- Subject: Name of the subject.
- Presence: Weightage/distribution percentage or question count.
- Observation: Detailed, analytical takeaway about the subject's difficulty, focus areas, and specific question styles. You must cite specific Question IDs from the exam as examples of how these subjects manifest.]

---

# Skills Required
[Analyze the cognitive and academic skills required to tackle this exam based on the skills distribution. For each skill, write a detailed paragraph explaining what the skill entails, how it manifests in the questions, and cite specific Question IDs and text snippets to demonstrate where that skill is required.]

---

# Concept Map
[Group the inferred concepts required to solve questions by subject. For each subject, list the concepts with their frequency, and write a detailed sentence citing the specific Question ID(s) where the concept was tested and how it was applied. Example:
## Quantitative Aptitude
- **Ratio reasoning** (Frequency: 5): Tested in Question #12 ("A train covers...") and Question #15 ("Two partners A and B..."), requiring scaling of values to solve profit-sharing.]

---

# Formula Sheet
[Compile a LaTeX-compatible markdown table mapping the formulas/rules/identities, their topic, and a highly detailed usage description. Columns: Formula / Rule | Topic | Usage. Use standard LaTeX math styling (e.g. $A = \\frac{{1}}{{2}}bh$). In the usage column, write a thorough explanation citing the specific Question ID(s) where this formula was required. If no formulas were found or implied, write "No explicit formulas detected."]

---

# Question Patterns
[Compile a detailed blueprint mapping Question Types (e.g. Direct Formula, Concept Application, Multi-step) to the Required Skills and cognitive levels. For each pattern, write a detailed explanation of how it tests the candidate, citing specific example questions from the exam.]

---

# Preparation Guide
[Provide a highly actionable, structured study roadmap categorized into:
- **Must Learn**: Core concepts and formulas that candidates must study first, citing specific questions in the exam that require them.
- **Practice**: Specific question styles, problem types, and scenarios to drill repeatedly, referencing specific questions as models.
- **Master**: Advanced techniques, shortcut optimizations, and time-saving heuristics to speed up solving, referencing specific questions where they can be applied.]

---

# Weak Areas
[Identify typical weak areas or tricky topics based on the hard/multi-step question topics in the aggregated data. Provide detailed advice and corrective actions on how to overcome these conceptual bottlenecks, citing specific hard questions (ID and text snippet) that candidates typically struggle with.]

---

# Difficulty
[Provide the percentages for Easy, Medium, and Hard questions. Explain the reasoning behind this difficulty profile. Contrast specific Easy questions in this exam with Hard questions in this exam (citing their IDs and text snippets), detailing what made the hard section difficult and how cognitive levels align with this profile.]

RULES:
1. Return ONLY the raw markdown. Do NOT wrap the response in markdown code blocks like ```markdown.
2. Only output formulas if confidence is high (confidence > 0.65). If multiple solving paths exist, show the most efficient one.
3. Deduplicate formulas and merge similar concepts.
4. Use LaTeX math formatting (e.g. $Speed = \\frac{{Distance}}{{Time}}$) for formulas.
"""
