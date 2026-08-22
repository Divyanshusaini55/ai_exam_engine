from __future__ import annotations
from pathlib import Path
import colorsys
import re
from typing import Literal
import fitz
import numpy as np
from PIL import Image

from quiz.ai.examintel.models import StyledSpan, OcrBox, ColorBucketType


NEUTRAL_SATURATION_MAX: float = 0.18

NEUTRAL_VALUE_MIN_BLACK: float = 0.18

NEUTRAL_VALUE_MAX_WHITE: float = 0.95

GREEN_HUE_MIN_DEG: float = 65.0

GREEN_HUE_MAX_DEG: float = 175.0

GREEN_SATURATION_MIN: float = 0.20

GREEN_VALUE_MIN: float = 0.15

RED_HUE_WRAP_HIGH_DEG: float = 340.0

RED_HUE_WRAP_LOW_DEG: float = 25.0

RED_SATURATION_MIN: float = 0.20

RED_VALUE_MIN: float = 0.15

RASTER_FALLBACK_DPI: int = 300

RASTER_BG_RGB_THRESHOLD: int = 225

def unpack_pymupdf_color(color_val: int | tuple | list | None) -> tuple[int, int, int]:
    if color_val is None:
        return (0, 0, 0)

    if isinstance(color_val, int):
        # Packed sRGB int: (r << 16) | (g << 8) | b
        r = (color_val >> 16) & 0xFF
        g = (color_val >> 8) & 0xFF
        b = color_val & 0xFF
        return (r, g, b)

    if isinstance(color_val, (tuple, list)):
        if len(color_val) >= 3:
            # Handle float representation (0.0 - 1.0) or int representation (0 - 255)
            if all(isinstance(c, float) and 0.0 <= c <= 1.0 for c in color_val[:3]):
                return (
                    max(0, min(255, int(round(color_val[0] * 255)))),
                    max(0, min(255, int(round(color_val[1] * 255)))),
                    max(0, min(255, int(round(color_val[2] * 255)))),
                )
            return (
                max(0, min(255, int(color_val[0]))),
                max(0, min(255, int(color_val[1]))),
                max(0, min(255, int(color_val[2]))),
            )
        if len(color_val) == 1:
            # Grayscale single value
            gray = color_val[0]
            val = int(round(gray * 255)) if isinstance(gray, float) and 0.0 <= gray <= 1.0 else int(gray)
            val = max(0, min(255, val))
            return (val, val, val)

    return (0, 0, 0)


def classify_color_hsv(r: int, g: int, b: int) -> ColorBucketType:
    r_norm = max(0.0, min(1.0, r / 255.0))
    g_norm = max(0.0, min(1.0, g / 255.0))
    b_norm = max(0.0, min(1.0, b / 255.0))

    h_norm, s_norm, v_norm = colorsys.rgb_to_hsv(r_norm, g_norm, b_norm)
    hue_deg = h_norm * 360.0

    # 1. Check for neutral (black, dark charcoal, grey, or white)
    if s_norm <= NEUTRAL_SATURATION_MAX or v_norm <= NEUTRAL_VALUE_MIN_BLACK:
        return "neutral"
    if v_norm >= NEUTRAL_VALUE_MAX_WHITE and s_norm <= NEUTRAL_SATURATION_MAX:
        return "neutral"

    # 2. Check for green family
    if (
        GREEN_HUE_MIN_DEG <= hue_deg <= GREEN_HUE_MAX_DEG
        and s_norm >= GREEN_SATURATION_MIN
        and v_norm >= GREEN_VALUE_MIN
    ):
        return "green_family"

    # 3. Check for red family (wrapped around 0/360)
    if (
        (hue_deg >= RED_HUE_WRAP_HIGH_DEG or hue_deg <= RED_HUE_WRAP_LOW_DEG)
        and s_norm >= RED_SATURATION_MIN
        and v_norm >= RED_VALUE_MIN
    ):
        return "red_family"

    # 4. Other distinct saturated colors (blue, violet, orange, cyan, etc.)
    return "other"


def extract_style_signals(pdf_path: str) -> list[StyledSpan]:
    path_obj = Path(pdf_path)
    if not path_obj.is_file():
        raise FileNotFoundError(f"PDF file not found at: {pdf_path}")

    try:
        doc = fitz.open(pdf_path)
    except Exception as exc:
        raise ValueError(f"Failed to open PDF document at {pdf_path}: {exc}") from exc

    styled_spans: list[StyledSpan] = []

    try:
        for page_idx in range(len(doc)):
            page_num = page_idx + 1
            page = doc[page_idx]
            page_dict = page.get_text("dict")
            blocks = page_dict.get("blocks", [])

            for b_idx, block in enumerate(blocks):
                if block.get("type", 0) != 0:
                    continue

                lines = block.get("lines", [])
                for l_idx, line in enumerate(lines):
                    spans = line.get("spans", [])
                    for s_idx, span in enumerate(spans):
                        raw_text = span.get("text", "")
                        if not raw_text:
                            continue

                        bbox_raw = span.get("bbox", (0.0, 0.0, 0.0, 0.0))
                        bbox: tuple[float, float, float, float] = (
                            float(bbox_raw[0]),
                            float(bbox_raw[1]),
                            float(bbox_raw[2]),
                            float(bbox_raw[3]),
                        )
                        span_id = f"p{page_num}_b{b_idx}_l{l_idx}_s{s_idx}"

                        # Extract RGB color
                        raw_color = span.get("color")
                        rgb = unpack_pymupdf_color(raw_color)
                        color_bucket = classify_color_hsv(rgb[0], rgb[1], rgb[2])

                        # Extract typography flags
                        flags = span.get("flags", 0)
                        font_name = str(span.get("font", ""))
                        font_size = float(span.get("size", 0.0))

                        # Bit 4 (16) = bold, Bit 1 (2) = italic
                        is_bold = bool(flags & 16) or bool(
                            re.search(r"(?:bold|black|heavy|demi|semibold|b\b)", font_name, re.IGNORECASE)
                        )
                        is_italic = bool(flags & 2) or bool(
                            re.search(r"(?:italic|oblique|slant|it\b)", font_name, re.IGNORECASE)
                        )

                        styled_spans.append(
                            StyledSpan(
                                span_id=span_id,
                                text=raw_text,
                                page_number=page_num,
                                bbox=bbox,
                                rgb=rgb,
                                color_bucket=color_bucket,
                                bold=is_bold,
                                italic=is_italic,
                                font_size=font_size,
                            )
                        )
    finally:
        doc.close()

    return styled_spans


def extract_style_signals_from_raster(
    pdf_path: str, ocr_boxes: list[OcrBox]
) -> list[StyledSpan]:
    path_obj = Path(pdf_path)
    if not path_obj.is_file():
        raise FileNotFoundError(f"PDF file not found at: {pdf_path}")

    if not ocr_boxes:
        return []

    try:
        doc = fitz.open(pdf_path)
    except Exception as exc:
        raise ValueError(f"Failed to open PDF document at {pdf_path}: {exc}") from exc

    # Group OCR boxes by page number (1-indexed)
    boxes_by_page: dict[int, list[tuple[int, OcrBox]]] = {}
    for idx, box in enumerate(ocr_boxes):
        boxes_by_page.setdefault(box.page_number, []).append((idx, box))

    results: list[StyledSpan] = []
    scale = RASTER_FALLBACK_DPI / 72.0

    try:
        for page_num, indexed_boxes in boxes_by_page.items():
            page_idx = page_num - 1
            if page_idx < 0 or page_idx >= len(doc):
                continue

            page = doc[page_idx]
            pix = page.get_pixmap(dpi=RASTER_FALLBACK_DPI)
            img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
            img_arr = np.array(img)

            img_h, img_w, _ = img_arr.shape

            for idx, box in indexed_boxes:
                x0, y0, x1, y1 = box.bbox
                px0 = max(0, min(img_w - 1, int(round(x0 * scale))))
                py0 = max(0, min(img_h - 1, int(round(y0 * scale))))
                px1 = max(px0 + 1, min(img_w, int(round(x1 * scale))))
                py1 = max(py0 + 1, min(img_h, int(round(y1 * scale))))

                crop = img_arr[py0:py1, px0:px1]
                if crop.size == 0:
                    rgb = (0, 0, 0)
                else:
                    # Filter out white/near-white background
                    is_bg = (
                        (crop[:, :, 0] >= RASTER_BG_RGB_THRESHOLD)
                        & (crop[:, :, 1] >= RASTER_BG_RGB_THRESHOLD)
                        & (crop[:, :, 2] >= RASTER_BG_RGB_THRESHOLD)
                    )
                    fg_pixels = crop[~is_bg]

                    if len(fg_pixels) > 0:
                        # Median foreground color resists antialiasing fringe pixels
                        med_r = int(round(float(np.median(fg_pixels[:, 0]))))
                        med_g = int(round(float(np.median(fg_pixels[:, 1]))))
                        med_b = int(round(float(np.median(fg_pixels[:, 2]))))
                        rgb = (med_r, med_g, med_b)
                    else:
                        # Fallback to mean/median of crop or neutral black
                        med_r = int(round(float(np.median(crop[:, :, 0]))))
                        med_g = int(round(float(np.median(crop[:, :, 1]))))
                        med_b = int(round(float(np.median(crop[:, :, 2]))))
                        rgb = (med_r, med_g, med_b)

                color_bucket = classify_color_hsv(rgb[0], rgb[1], rgb[2])
                span_id = box.box_id or f"p{page_num}_ocr_{idx}"

                results.append(
                    StyledSpan(
                        span_id=span_id,
                        text=box.text,
                        page_number=page_num,
                        bbox=box.bbox,
                        rgb=rgb,
                        color_bucket=color_bucket,
                        bold=False,
                        italic=False,
                        font_size=0.0,
                    )
                )
    finally:
        doc.close()

    return results
