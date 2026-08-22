
from pathlib import Path
from typing import List, Tuple
import fitz

from quiz.ai.examintel.models import Span, PageLayout


def extract_text_layout(pdf_path: str) -> List[PageLayout]:
    path_obj = Path(pdf_path)
    if not path_obj.is_file():
        raise FileNotFoundError(f"PDF file not found at: {pdf_path}")

    try:
        doc = fitz.open(pdf_path)
    except Exception as exc:
        raise ValueError(f"Failed to open PDF document at {pdf_path}: {exc}") from exc

    page_layouts: List[PageLayout] = []

    try:
        for page_idx in range(len(doc)):
            page_num = page_idx + 1
            page = doc[page_idx]
            page_dict = page.get_text("dict")
            blocks = page_dict.get("blocks", [])

            spans_list: List[Span] = []

            for b_idx, block in enumerate(blocks):
                # block type 0 is text; type 1 is image
                if block.get("type", 0) != 0:
                    continue

                lines = block.get("lines", [])
                for l_idx, line in enumerate(lines):
                    spans = line.get("spans", [])
                    for s_idx, span in enumerate(spans):
                        raw_text = span.get("text", "")
                        # We keep non-empty spans or meaningful spaces
                        if not raw_text:
                            continue

                        bbox_raw = span.get("bbox", (0.0, 0.0, 0.0, 0.0))
                        bbox: Tuple[float, float, float, float] = (
                            float(bbox_raw[0]),
                            float(bbox_raw[1]),
                            float(bbox_raw[2]),
                            float(bbox_raw[3]),
                        )
                        span_id = f"p{page_num}_b{b_idx}_l{l_idx}_s{s_idx}"

                        spans_list.append(
                            Span(
                                text=raw_text,
                                bbox=bbox,
                                page_number=page_num,
                                span_id=span_id,
                            )
                        )

            page_layouts.append(
                PageLayout(page_number=page_num, spans=spans_list)
            )
    finally:
        doc.close()

    return page_layouts
