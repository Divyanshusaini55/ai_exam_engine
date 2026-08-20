import logging
import re
import uuid
import json
import concurrent.futures
import threading
from typing import Annotated, List, Optional, TypedDict
import operator

from langgraph.graph import StateGraph, END
from pydantic import BaseModel, Field

from quiz.ai.gemini_client import GeminiClient
from quiz.ai.prompt_builder import PromptBuilder
from quiz.ai.langgraph.base import with_backoff
from quiz.ai.pdf_parser.docling_parser import DoclingParser
from quiz.ai import extract_json_from_text
from quiz.ai.langfuse_client import observe, update_trace_metadata

logger = logging.getLogger("quiz.ai.langgraph.exam_ingestion_graph")

class ExamIngestionState(TypedDict):
    pdf_path: str
    gemini_file_name: Optional[str]
    markdown_text: str
    images: list
    raw_chunks: list
    extracted_json: Annotated[List[dict], operator.add]
    fused_json: list
    final_payloads: list
    errors: Annotated[List[str], operator.add]

# --- Nodes ---

@observe(name="node_parse_pdf")
def node_parse_pdf(state: ExamIngestionState) -> dict:
    pdf_path = state.get("pdf_path")
    print(f"\n>>> [NODE 1] node_parse_pdf: Started processing {pdf_path}")
    logger.info("node_parse_pdf: Parsing PDF using PyMuPDF and Normalizer")
    parser = DoclingParser()
    result = parser.parse(pdf_path)
    
    return {
        "markdown_text": result["markdown"],
        "images": result["images"],
        "gemini_file_name": None
    }

@observe(name="node_vision_segment")
def node_vision_segment(state: ExamIngestionState) -> dict:
    print(f"\n>>> [NODE 2] node_vision_segment: Segmenting text for parallel extraction")
    logger.info("node_vision_segment: Segmenting markdown text into semantic question chunks")
    
    # Matches question boundaries: Question No.1, Q.1, Q1, 1., etc.
    q_start_pattern = re.compile(
        r'^(?:<!--\s*Page\s*\d+\s*-->\s*)?(?:##\s*)?(?:-\s*)?(?:Question\s*(?:No\.?)?\s*\d+|Q\.?\s*\d+|^\d+[\.\)])',
        re.IGNORECASE | re.MULTILINE
    )
    
    text = state["markdown_text"]
    lines = text.split("\n")
    
    chunks = []
    current_chunk = []
    question_count = 0
    
    for line in lines:
        if q_start_pattern.match(line.strip()):
            question_count += 1
            if question_count >= 12 or (sum(len(l) for l in current_chunk) > 12000 and question_count >= 6):
                chunk_str = "\n".join(current_chunk).strip()
                if chunk_str:
                    chunks.append(chunk_str)
                current_chunk = []
                question_count = 1
                
        current_chunk.append(line)
        
    if current_chunk:
        chunk_str = "\n".join(current_chunk).strip()
        if chunk_str:
            chunks.append(chunk_str)
            
    print(f"    [+] Segmented text into {len(chunks)} semantic chunks.")
    return {"raw_chunks": chunks}

@observe(name="node_extract_json")
def node_extract_json(state: ExamIngestionState) -> dict:
    print(f"\n>>> [NODE 3] node_extract_json: Extracting structured JSON with Language Awareness...")
    logger.info("node_extract_json: Extracting structured JSON from chunks")
    client = GeminiClient()
    extracted = []
    errors = []
    
    raw_chunks = state.get("raw_chunks", [])
    total_chunks = len(raw_chunks)
    logger.info(f"Starting JSON extraction for {total_chunks} chunks...")
    
    lock = threading.Lock()

    def process_chunk(idx, chunk):
        logger.info(f"--- Processing Chunk {idx+1}/{total_chunks} ---")
        prompt = (
            "You are an expert exam paper digitization AI for Indian competitive examinations.\n"
            "Convert the following exam text into a structured JSON array of question objects.\n\n"
            "CRITICAL LANGUAGE EXTRACTION RULES:\n"
            "1. BILINGUAL QUESTIONS (The question appears in BOTH English and Hindi):\n"
            "   - Extract the clean English text as 'question_text'.\n"
            "   - Extract the clean Hindi translation as 'question_text_hi'.\n"
            "   - For options: extract English text as 'answer_text' and Hindi as 'answer_text_hi'.\n"
            "   - Set 'language': 'en'.\n"
            "   - NEVER concatenate English and Hindi together into 'question_text'!\n\n"
            "2. HINDI-ONLY QUESTIONS (The question only exists in Hindi, e.g. Hindi Grammar/Literature):\n"
            "   - Extract clean Hindi text as 'question_text'.\n"
            "   - Extract Hindi options into 'answer_text'.\n"
            "   - Set 'question_text_hi': null and 'language': 'hi'.\n\n"
            "3. ENGLISH-ONLY QUESTIONS (The question only exists in English):\n"
            "   - Extract clean English text as 'question_text'.\n"
            "   - Extract English options into 'answer_text'.\n"
            "   - Set 'question_text_hi': null and 'language': 'en'.\n\n"
            "OFFICIAL ANSWER IDENTIFICATION:\n"
            "- Look for '(Correct Answer)', '(Chosen option)', green ticks, or marked correct options in the text.\n"
            "- Set 'is_correct': true for the official correct option, and false for all others.\n"
            "- Do NOT include '(Correct Answer)' or '(Chosen option)' in the actual option text string.\n\n"
            "TOKEN & COST EFFICIENCY RULE:\n"
            "- DO NOT write explanations or reasoning steps. Always return 'explanation': '' to save output tokens.\n\n"
            "OUTPUT FORMAT (STRICT JSON ARRAY):\n"
            "[\n"
            "  {\n"
            "    \"question_text\": \"English question text (or Hindi if only Hindi is available)\",\n"
            "    \"question_text_hi\": \"Hindi question text if bilingual, else null\",\n"
            "    \"language\": \"en\",\n"
            "    \"subject\": \"General Hindi / General Awareness / Quantitative Aptitude / Reasoning\",\n"
            "    \"topic\": \"Specific Topic Name\",\n"
            "    \"difficulty\": \"Medium\",\n"
            "    \"options\": [\n"
            "      {\"id\": \"A\", \"answer_text\": \"Option A text\", \"answer_text_hi\": \"Option A Hindi text (or null)\", \"is_correct\": true},\n"
            "      {\"id\": \"B\", \"answer_text\": \"Option B text\", \"answer_text_hi\": \"Option B Hindi text (or null)\", \"is_correct\": false},\n"
            "      {\"id\": \"C\", \"answer_text\": \"Option C text\", \"answer_text_hi\": \"Option C Hindi text (or null)\", \"is_correct\": false},\n"
            "      {\"id\": \"D\", \"answer_text\": \"Option D text\", \"answer_text_hi\": \"Option D Hindi text (or null)\", \"is_correct\": false}\n"
            "    ],\n"
            "    \"explanation\": \"\"\n"
            "  }\n"
            "]\n\n"
            "IMPORTANT: Return ONLY valid JSON array. No markdown fences or conversational text.\n\n"
            f"Text:\n{chunk}"
        )
        
        max_retries = 2
        for attempt in range(max_retries):
            try:
                res = client.generate_content(prompt)
                parsed_data = extract_json_from_text(res.get('text', ''))
                
                if parsed_data:
                    questions_batch = []
                    if isinstance(parsed_data, list):
                        questions_batch = parsed_data
                    elif isinstance(parsed_data, dict) and 'questions' in parsed_data:
                        questions_batch = parsed_data['questions']
                    elif isinstance(parsed_data, dict):
                        questions_batch = [parsed_data]
                        
                    with lock:
                        extracted.extend(questions_batch)
                        logger.info(f"      [OK] Chunk {idx+1}: Extracted {len(questions_batch)} questions. Total so far: {len(extracted)}")
                    return
                else:
                    if attempt == max_retries - 1:
                        logger.warning(f"      [WARNING] Chunk {idx+1}: Invalid JSON after {max_retries} attempts.")
            except Exception as e:
                if attempt == max_retries - 1:
                    logger.error(f"      [ERROR] Chunk {idx+1} extraction failed: {e}")
                    with lock:
                        errors.append(f"Extraction error on chunk {idx+1}: {str(e)}")

    # Run in parallel
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(process_chunk, idx, chunk) for idx, chunk in enumerate(raw_chunks)]
        concurrent.futures.wait(futures)
            
    print(f"    [+] Finished extraction. Total questions extracted: {len(extracted)}")
    return {"extracted_json": extracted, "errors": errors}

@observe(name="node_bilingual_fuse")
def node_bilingual_fuse(state: ExamIngestionState) -> dict:
    print(f"\n>>> [NODE 4] node_bilingual_fuse: Cleaning and deduplicating questions")
    logger.info("node_bilingual_fuse: Cleaning option texts and deduplicating questions")
    
    raw_questions = state.get("extracted_json", [])
    seen_stems = set()
    cleaned_questions = []
    
    for q in raw_questions:
        if not isinstance(q, dict):
            continue
            
        q_text = (q.get("question_text") or "").strip()
        if not q_text:
            continue
            
        # Clean repetitive lines inside the question stem
        lines = [l.strip() for l in q_text.split('\n') if l.strip()]
        unique_lines = []
        for l in lines:
            if not unique_lines or unique_lines[-1] != l:
                unique_lines.append(l)
        q_text = "\n".join(unique_lines)
        q["question_text"] = q_text

        # Deduplicate identical questions across chunk boundaries
        stem_signature = re.sub(r'\s+', '', q_text.lower())[:80]
        if stem_signature in seen_stems:
            continue
        seen_stems.add(stem_signature)

        # Clean option texts
        opts = q.get("options", [])
        cleaned_opts = []
        for opt in opts:
            if isinstance(opt, dict):
                ans_text = (opt.get("answer_text") or "").strip()
                ans_text_hi = (opt.get("answer_text_hi") or "").strip()
                
                # Remove residual (Correct Answer) / (Chosen option) annotations
                clean_ans = re.sub(r'\s*\((?:Correct Answer|Chosen option|Chosen Answer)\)\s*', '', ans_text, flags=re.IGNORECASE).strip()
                clean_ans_hi = re.sub(r'\s*\((?:Correct Answer|Chosen option|Chosen Answer)\)\s*', '', ans_text_hi, flags=re.IGNORECASE).strip()
                
                cleaned_opts.append({
                    "id": opt.get("id", ""),
                    "answer_text": clean_ans or ans_text,
                    "answer_text_hi": clean_ans_hi if clean_ans_hi else None,
                    "is_correct": bool(opt.get("is_correct", False))
                })
        q["options"] = cleaned_opts
        cleaned_questions.append(q)
        
    print(f"    [+] Fused and deduplicated: {len(cleaned_questions)} unique questions.")
    return {"fused_json": cleaned_questions}

@observe(name="node_math_normalize")
def node_math_normalize(state: ExamIngestionState) -> dict:
    print(f"\n>>> [NODE 5] node_math_normalize: Normalizing LaTeX math formulas")
    logger.info("node_math_normalize: Normalizing LaTeX math formulas")
    
    questions = state.get("fused_json", [])
    
    for q in questions:
        q_text = q.get("question_text", "")
        # Normalize simple square roots: sqrt(X) -> $\sqrt{X}$
        q_text = re.sub(r'sqrt\(([^)]+)\)', r'$\\sqrt{\1}$', q_text)
        # Normalize simple fractions: (\d+)/(\d+) -> $\frac{\1}{\2}$ when surrounded by math
        q_text = re.sub(r'(?<=\s)(\d+)/(\d+)(?=\s|$)', r'$\\frac{\1}{\2}$', q_text)
        q["question_text"] = q_text
        
    return {"final_payloads": questions}

@observe(name="node_agentic_solve")
def node_agentic_solve(state: ExamIngestionState) -> dict:
    print(f"\n>>> [NODE 6] node_agentic_solve: Checking and resolving missing answers in batches")
    logger.info("node_agentic_solve: Checking and resolving missing answers in batches")
    
    client = GeminiClient()
    questions = state.get("final_payloads", [])
    
    # 1. Identify questions that lack a marked correct option
    unresolved = []
    for idx, q in enumerate(questions):
        opts = q.get("options", [])
        if any(o.get("is_correct") for o in opts):
            q["solver_verified"] = True
        else:
            unresolved.append((idx, q))
            
    if not unresolved:
        print(f"    [+] All {len(questions)} questions already have verified answers. Zero solver calls needed.")
        return {"final_payloads": questions}
        
    print(f"    [*] Found {len(unresolved)} questions with missing answers. Solving in batched groups of 10...")
    
    # Batch unresolved questions in groups of 10 (saves 90% of solver calls)
    batch_size = 10
    batches = [unresolved[i:i + batch_size] for i in range(0, len(unresolved), batch_size)]
    
    def process_solver_batch(batch):
        batch_items = []
        for local_idx, (orig_idx, q) in enumerate(batch):
            opts_summary = [f"{o.get('id', chr(65+j))}: {o.get('answer_text', '')}" for j, o in enumerate(q.get("options", []))]
            batch_items.append({
                "item_id": local_idx,
                "question": q.get("question_text", ""),
                "options": opts_summary
            })
            
        prompt = (
            "You are an expert exam key resolver. For each multiple-choice question below, determine the single correct option ID (e.g. 'A', 'B', 'C', 'D').\n"
            "DO NOT write explanations, reasoning, or hints — return ONLY a compact JSON array.\n\n"
            "OUTPUT FORMAT (STRICT JSON ARRAY):\n"
            "[\n"
            '  {"item_id": 0, "correct_option": "B"},\n'
            '  {"item_id": 1, "correct_option": "A"}\n'
            "]\n\n"
            f"Questions:\n{json.dumps(batch_items, ensure_ascii=False)}"
        )
        
        try:
            res = client.generate_content(prompt)
            answers_list = extract_json_from_text(res.get('text', ''))
            if isinstance(answers_list, list):
                ans_map = {item.get("item_id"): str(item.get("correct_option", "")).strip().upper() for item in answers_list if isinstance(item, dict)}
                for local_idx, (orig_idx, q) in enumerate(batch):
                    correct_opt_id = ans_map.get(local_idx)
                    if correct_opt_id:
                        for opt in q.get("options", []):
                            if opt.get("id", "").upper() == correct_opt_id:
                                opt["is_correct"] = True
                                q["solver_verified"] = True
                                break
        except Exception as e:
            logger.error(f"Solver batch failed: {e}")
            
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        list(executor.map(process_solver_batch, batches))
        
    return {"final_payloads": questions}

@observe(name="node_pydantic_validate")
def node_pydantic_validate(state: ExamIngestionState) -> dict:
    print(f"\n>>> [NODE 7] node_pydantic_validate: Transforming into Canonical V2 Schema")
    logger.info("node_pydantic_validate: Transforming into Canonical V2 Schema")
    
    v2_payloads = []
    
    for item in state.get("final_payloads", []):
        q_id = f"q_{uuid.uuid4().hex[:8]}"
        
        # Build options and correct IDs
        v2_options = []
        correct_ids = []
        
        for idx, opt in enumerate(item.get("options", [])):
            opt_id = opt.get("id") or chr(65 + idx)
            v2_options.append({
                "id": opt_id,
                "text": opt.get("answer_text", ""),
                "answer_text_hi": opt.get("answer_text_hi"),
                "image_url": opt.get("image_url")
            })
            if opt.get("is_correct"):
                correct_ids.append(opt_id)
                
        # Subject & classification
        subject = item.get("subject") or "General"
        topic = item.get("topic") or "General"
        difficulty = item.get("difficulty") or "Medium"
        lang = item.get("language") or "en"
        
        v2_item = {
            "id": q_id,
            "schema_version": "v2",
            "origin": "pyq_extracted",
            "question_type": "mcq_multi" if len(correct_ids) > 1 else "mcq_single",
            "passage_id": None,
            "content": {
                "text": item.get("question_text", ""),
                "images": {}
            },
            "question_text_hi": item.get("question_text_hi"),
            "options": v2_options,
            "answer": {
                "correct_options": correct_ids
            },
            "explanation": {
                "text": item.get("explanation", ""),
                "images": {}
            },
            "tutor_data": {
                "hints": item.get("hints", []),
                "solution_steps": item.get("solution_steps", [])
            },
            "marking": {
                "positive": 2.0,
                "negative": 0.5,
                "partial_scheme": None
            },
            "classification": {
                "subject": subject,
                "topic": topic,
                "subtopic": "General",
                "cognitive_level": "apply",
                "difficulty_label": difficulty,
                "difficulty_score": None,
                "difficulty_source": None
            },
            "exam_history": [],
            "source": None,
            "generation_meta": None,
            "verification": {
                "verified": item.get("solver_verified", False),
                "extracted_at": None,
                "reviewed_by": None
            },
            "metadata": {
                "language": lang,
                "translation_group_id": None,
                "tags": [subject.lower()],
                "ideal_time_seconds": 60
            }
        }
        v2_payloads.append(v2_item)
        
    return {"final_payloads": v2_payloads}

@observe(name="node_cleanup")
def node_cleanup(state: ExamIngestionState) -> dict:
    print(f"\n>>> [NODE] Pipeline Execution Complete.")
    logger.info("Pipeline Execution Complete.")
    return {}

class ExamIngestionGraph:
    def __init__(self):
        g = StateGraph(ExamIngestionState)
        g.add_node("node_parse_pdf", node_parse_pdf)
        g.add_node("node_vision_segment", node_vision_segment)
        g.add_node("node_extract_json", node_extract_json)
        g.add_node("node_bilingual_fuse", node_bilingual_fuse)
        g.add_node("node_math_normalize", node_math_normalize)
        g.add_node("node_agentic_solve", node_agentic_solve)
        g.add_node("node_pydantic_validate", node_pydantic_validate)
        g.add_node("node_cleanup", node_cleanup)
        
        g.set_entry_point("node_parse_pdf")
        g.add_edge("node_parse_pdf", "node_vision_segment")
        g.add_edge("node_vision_segment", "node_extract_json")
        g.add_edge("node_extract_json", "node_bilingual_fuse")
        g.add_edge("node_bilingual_fuse", "node_math_normalize")
        g.add_edge("node_math_normalize", "node_agentic_solve")
        g.add_edge("node_agentic_solve", "node_pydantic_validate")
        g.add_edge("node_pydantic_validate", "node_cleanup")
        g.add_edge("node_cleanup", END)
        
        self.graph = g.compile()
        
    @observe(name="exam_ingestion_pipeline")
    def run(self, pdf_path: str) -> dict:
        update_trace_metadata(
            tags=["exam_ingestion", "bilingual_pipeline"],
            input={"pdf_path": pdf_path}
        )
        initial_state = {
            "pdf_path": pdf_path,
            "gemini_file_name": None,
            "markdown_text": "",
            "images": [],
            "raw_chunks": [],
            "extracted_json": [],
            "fused_json": [],
            "final_payloads": [],
            "errors": []
        }
        result = self.graph.invoke(initial_state)
        update_trace_metadata(
            output={
                "extracted_questions_count": len(result.get("final_payloads", [])),
                "errors_count": len(result.get("errors", []))
            }
        )
        return result
