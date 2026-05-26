import re
import json
import logging
import PyPDF2
from quiz.ai.gemini_client import GeminiClient

logger = logging.getLogger('quiz.ai.roadmap_engine')

class RoadmapEngine:
    def __init__(self):
        self.client = GeminiClient()

    def extract_and_clean_pdf(self, pdf_path: str) -> str:
        """
        Stage 1 & 2: PDF Extraction & Text Cleaning
        """
        logger.info(f"Extracting text from PDF syllabus: {pdf_path}")
        text = ""
        try:
            with open(pdf_path, 'rb') as f:
                reader = PyPDF2.PdfReader(f)
                for page in reader.pages:
                    text += page.extract_text() or ""
        except Exception as e:
            logger.error(f"Failed to read PDF syllabus file: {e}")
            raise e

        # Clean text and strip invalid UTF-8/surrogate characters
        text = text.encode('utf-8', 'ignore').decode('utf-8')
        text = re.sub(r'[\ud800-\udfff]', '', text)
        text = re.sub(r'[ \t]+', ' ', text)
        text = re.sub(r'(?i)page\s+\d+(\s+of\s+\d+)?', '', text)
        text = re.sub(r'\n{3,}', '\n\n', text)
        return text.strip()

    def parse_syllabus(self, subcategory_name: str, syllabus_text: str = None) -> dict:
        """
        Stage 3, 4 & 5: AI Syllabus Parser + Knowledge Graph Builder
        """
        if syllabus_text:
            logger.info(f"Generating question-grounded syllabus roadmap from PDF text for {subcategory_name}")
            prompt = f"""
You are an expert curriculum designer and academic graph engineer for competitive examinations.
Analyze the following official syllabus text extracted from a PDF for the "{subcategory_name}" exam:

---
Syllabus Content:
{syllabus_text[:120000]}
---

CRITICAL REQUIREMENTS FOR MAXIMUM ACCURACY AND COMPLETENESS:
1. SUBJECT-BASED PHASES (NO BIAS): You must identify ALL subjects, sections, modules, or papers mentioned in the syllabus text (e.g. Mathematics, Reasoning, English, General Awareness, Computer Basics, Statistics, etc.). You MUST create dedicated study phases for each of these subjects. Do NOT focus only on one subject (like Mathematics) while ignoring or summarizing others. English, General Awareness, Reasoning, and other subjects must get equal representation and dedicated phases in the roadmap.
2. COHERENT TOPIC GROUPING: Do NOT create a separate topic node for every single word in the syllabus, as that leads to excessive fragmentation. Instead, group closely related subtopics into logical, coherent chapter-level topics (e.g., group "Whole Numbers, Decimals, Fractions and relationships between numbers" into a single topic "Number System Basics"). Aim for a total of around 25 to 35 topics across all phases to cover 100% of the syllabus comprehensively and in a highly readable timeline.
3. DEPENDENCY MAPPING (KNOWLEDGE GRAPH): Carefully link prerequisite topics (e.g. "Number System Basics" is a prerequisite for "Fractions", or "Grammar Basics" is a prerequisite for "Spotting Errors").

Your output MUST be a valid JSON object matching the following structure:
{{
    "title": "Complete Roadmap for {subcategory_name}",
    "description": "An AI-curated study roadmap structured around the official syllabus.",
    "phases": [
        {{
            "title": "Phase 1: [Subject/Area Name]",
            "description": "...",
            "topics": [
                {{
                    "title": "Number System Basics",
                    "description": "Understanding prime numbers, fractions, decimals, HCF, LCM, and relationships between numbers.",
                    "estimated_minutes": 120,
                    "prerequisites": []
                }},
                {{
                    "title": "Percentage and Interest",
                    "description": "Percentages, simple and compound interest calculations.",
                    "estimated_minutes": 90,
                    "prerequisites": ["Number System Basics"]
                }}
            ]
        }}
    ]
}}

Respond ONLY with valid JSON. Do NOT wrap in markdown block wrappers like ```json.
"""
        else:
            logger.info(f"Generating fallback roadmap using AI general knowledge for {subcategory_name}")
            prompt = f"""
You are an expert curriculum designer and academic graph engineer.
Create a detailed, step-by-step study roadmap for the "{subcategory_name}" exam.
You MUST comprehensively cover all major subjects associated with this exam (e.g. Mathematics, Reasoning, English, General Knowledge, etc.).
Divide the syllabus into logical phases.
For each phase, list the specific topics a student must study.
Estimate the time in minutes needed to study each topic.
Crucially, map Knowledge Graph dependencies (Prerequisites): list the exact titles of other topics in the roadmap that the student must master BEFORE studying each topic.

Respond STRICTLY in valid JSON matching this structure:
{{
    "title": "Complete Roadmap for {subcategory_name}",
    "description": "An AI-generated syllabus study roadmap.",
    "phases": [
        {{
            "title": "Phase 1: Foundation",
            "description": "Building the basics",
            "topics": [
                {{
                    "title": "Number System", 
                    "description": "Basic arithmetic concepts", 
                    "estimated_minutes": 120,
                    "prerequisites": []
                }}
            ]
        }}
    ]
}}

Respond ONLY with valid JSON. Do NOT wrap in markdown block wrappers like ```json.
"""

        res = self.client.generate_content(prompt)
        output = res['text'].strip()

        # Clean json block
        if output.startswith("```json"):
            output = output[7:]
        if output.startswith("```"):
            output = output[3:]
        if output.endswith("```"):
            output = output[:-3]
        output = output.strip()

        try:
            data = json.loads(output)
            # Schema Validation
            if not isinstance(data, dict) or 'phases' not in data:
                raise ValueError("AI output missing root fields or 'phases' array.")
            return data
        except Exception as e:
            logger.error(f"Failed to parse or validate roadmap JSON: {e}. Output was: {output}")
            raise ValueError(f"Invalid structured JSON returned by AI: {e}")
