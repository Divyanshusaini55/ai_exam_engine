"""
examintel - Passage and Case Study Context Propagation Layer
=============================================================
Detects cluster range headers in exam questions (e.g. 'Case Study - 16 to 17',
'Questions 96 to 100: Read the following passage...').
Automatically propagates the shared reading passage, directions, and shared
diagrams across all questions within the cluster range [start_q .. end_q].
"""

from __future__ import annotations
import re
from typing import List, Optional, Tuple, Dict, Any

from quiz.ai.examintel.models import QuestionBlock


# Range patterns matching question cluster headers
CLUSTER_PATTERNS = [
    # Case Study - 16 to 17 / Case Study: 16 - 17
    r"(?i)\bCase\s*Study\s*[-–:]\s*(\d{1,3})\s*(?:to|-|–)\s*(\d{1,3})\b[\s\S]*?(?:Directions\s*:\s*)?([\s\S]*?)(?=(?:Question\s*No\.?\s*\d+|Q\.?\s*\d+|$))",
    # Questions 96 to 100: Read the following passage...
    r"(?i)\b(?:Questions?|Q\.?)\s*(\d{1,3})\s*(?:to|-|–)\s*(\d{1,3})\s*[:\.]?\s*(?:Read\s+the\s+following\s+passage[\s\S]*?|Study\s+the\s+following\s+[\s\S]*?)([\s\S]*?)(?=(?:Question\s*No\.?\s*\d+|Q\.?\s*\d+|$))",
    # Directions (Q. 16 - 17) / Directions (16-17):
    r"(?i)\bDirections\s*\(?(?:Q\.?\s*)?(\d{1,3})\s*[-–to]+\s*(\d{1,3})\)?\s*[:\.]?\s*([\s\S]*?)(?=(?:Question\s*No\.?\s*\d+|Q\.?\s*\d+|$))",
    # Hindi: निर्देश (प्रश्न 16 - 17): / अनुच्छेद पढ़कर प्रश्न संख्या 16 से 17...
    r"(?i)(?:निर्देश|अनुच्छेद)\s*\(?(?:प्रश्न\s*)?(\d{1,3})\s*(?:से|[-–])\s*(\d{1,3})\)?\s*[:\.]?\s*([\s\S]*?)(?=(?:प्रश्न|Question|$))",
]


def _extract_cluster_header(text: str) -> Optional[Tuple[int, int, str]]:
    """
    Checks if the question stem begins with or contains a cluster range header.
    Returns (start_q, end_q, shared_context_body) if found, otherwise None.
    """
    if not text:
        return None

    for pattern in CLUSTER_PATTERNS:
        m = re.search(pattern, text)
        if m:
            try:
                start_q = int(m.group(1))
                end_q = int(m.group(2))
                # Validate realistic cluster size (typically 2 to 15 questions)
                if start_q < end_q and (end_q - start_q) <= 15:
                    context_body = m.group(0).strip()
                    return start_q, end_q, context_body
            except (ValueError, IndexError):
                continue

    return None


def propagate_shared_contexts(questions: List[QuestionBlock]) -> List[QuestionBlock]:
    """
    Scans a list of QuestionBlocks for case-study or passage headers.
    Propagates shared_context and shared diagram figures to all questions in the cluster.
    """
    if not questions:
        return questions

    # Map question blocks by their local and global question numbers
    q_map: Dict[int, QuestionBlock] = {}
    for q in questions:
        if q.question_number and str(q.question_number).isdigit():
            q_map[int(q.question_number)] = q
        if q.global_question_number:
            q_map[q.global_question_number] = q

    # Iterate through questions looking for passage / cluster initiators
    for q_idx, q in enumerate(questions):
        full_text = q.question_text or ""
        cluster_info = _extract_cluster_header(full_text)

        # Also check if shared_context is already present
        if not cluster_info and q.shared_context:
            cluster_info = _extract_cluster_header(q.shared_context)

        if cluster_info:
            start_q, end_q, context_text = cluster_info

            # Collect diagrams belonging to the cluster initiator
            cluster_diagrams = list(q.diagram_image_paths)

            # Assign shared context to the initiating question if not already set
            if not q.shared_context:
                q.shared_context = context_text.strip()

            # Propagate to all subsequent questions in the cluster range [start_q + 1 .. end_q]
            for target_num in range(start_q + 1, end_q + 1):
                target_q = q_map.get(target_num)
                if not target_q and (q_idx + (target_num - start_q)) < len(questions):
                    target_q = questions[q_idx + (target_num - start_q)]

                if target_q and target_q is not q:
                    # Propagate shared context if missing
                    if not target_q.shared_context:
                        target_q.shared_context = q.shared_context

                    # Propagate diagrams if missing
                    if not target_q.diagram_image_paths and cluster_diagrams:
                        target_q.diagram_image_paths = list(cluster_diagrams)

    return questions
