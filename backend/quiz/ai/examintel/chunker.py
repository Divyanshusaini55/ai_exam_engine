from __future__ import annotations
import json
from pathlib import Path
from typing import List, Dict, Any

from quiz.ai.examintel.models import QuestionBlock
from quiz.ai.examintel.markdown_generator import render_question_markdown


def chunk_questions(
    questions: List[QuestionBlock],
    chunk_size: int = 5,
) -> List[List[QuestionBlock]]:

    if chunk_size <= 0:
        chunk_size = 5
    return [questions[i : i + chunk_size] for i in range(0, len(questions), chunk_size)]


def export_question_chunks(
    questions: List[QuestionBlock],
    doc_title: str,
    output_dir: Path,
    chunk_size: int = 5,
) -> List[Dict[str, Any]]:

    chunks_dir = output_dir / "chunks"
    chunks_dir.mkdir(parents=True, exist_ok=True)

    grouped_chunks = chunk_questions(questions, chunk_size=chunk_size)
    manifest_entries: List[Dict[str, Any]] = []

    for idx, chunk in enumerate(grouped_chunks):
        chunk_idx = idx + 1
        q_start = chunk[0].question_number
        q_end = chunk[-1].question_number
        sec_name = chunk[0].section_name or "General"

        chunk_filename = f"chunk_{chunk_idx:03d}_q{q_start}_to_q{q_end}.md"
        chunk_path = chunks_dir / chunk_filename

        # Render chunk Markdown
        chunk_lines: List[str] = [
            f"# {doc_title} (Chunk {chunk_idx}: Questions {q_start} to {q_end})",
            f"**Section**: `{sec_name}`",
            "",
            "> **Instructions for LLM Refiner**: Refine and structure each question below into standard JSON format.",
            "> Ground-truth answers are indicated via `- [x]` and `<!-- DETERMINISTIC_SIGNAL -->` tags. Do NOT override or guess.",
            "",
            "---",
            "",
        ]

        question_ids = []
        ground_truth_map: Dict[str, Any] = {}

        for q in chunk:
            q_md = render_question_markdown(q, include_context=True)
            chunk_lines.append(q_md)
            if q.question_id:
                question_ids.append(q.question_id)
            if q.detected_answer:
                ground_truth_map[q.question_number] = {
                    "answer": q.detected_answer,
                    "source": q.source,
                    "confidence": q.confidence,
                }

        chunk_content = "\n".join(chunk_lines)
        with open(chunk_path, "w", encoding="utf-8") as f:
            f.write(chunk_content)

        manifest_entries.append({
            "chunk_index": chunk_idx,
            "chunk_filename": chunk_filename,
            "chunk_path": str(chunk_path.relative_to(output_dir)),
            "section": sec_name,
            "start_question": q_start,
            "end_question": q_end,
            "question_count": len(chunk),
            "question_ids": question_ids,
            "ground_truth_signals": ground_truth_map,
        })

    # Save manifest.json
    manifest_path = chunks_dir / "manifest.json"
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(
            {
                "exam_title": doc_title,
                "total_questions": len(questions),
                "total_chunks": len(grouped_chunks),
                "chunk_size": chunk_size,
                "chunks": manifest_entries,
            },
            f,
            indent=2,
            ensure_ascii=False,
        )

    return manifest_entries
