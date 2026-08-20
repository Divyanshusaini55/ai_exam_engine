import os
import re
import uuid
from pathlib import Path
import fitz  # PyMuPDF
from PIL import Image

class FastPdfParser:
    def __init__(self, staging_dir: str = "/tmp/ai_exam_staging"):
        self.staging_dir = Path(staging_dir)
        self.staging_dir.mkdir(parents=True, exist_ok=True)

    def clean_indic_text(self, text: str) -> str:
        """
        Cleans Devanagari OCR spacing artifacts:
        - Reconnects separated matras (e.g. 'क िस' -> 'किस', 'व िधेयक' -> 'विधेयक')
        - Reconnects virama / half-letters (e.g. 'स ं व िधान' -> 'संविधान')
        - Removes duplicate consecutive lines
        """
        if not text:
            return ""

        # 1. Fix Hindi split matras: Consonant + space + vowel sign
        # Hindi vowel signs: U+093E to U+094C, U+0902 (Anusvara), U+0903 (Visarga), U+0901 (Chandrabindu), U+094D (Virama)
        dev_matras = r'[\u093e-\u094c\u0901-\u0903\u094d]'
        
        # 'क िस' -> 'किस' (matra placed after consonant with space)
        text = re.sub(rf'([\u0904-\u0939])\s+({dev_matras})', r'\1\2', text)
        
        # Inverted matra artifacts (e.g. Chhoti I ' ि' preceding consonant: ' ि' + space + 'क' -> 'िक')
        text = re.sub(rf'(\u093f)\s+([\u0904-\u0939])', r'\2\1', text)

        # 2. Fix split Hindi words like 'न ि म् न'
        text = re.sub(r'([\u0904-\u0939])\s+([\u094d])\s+([\u0904-\u0939])', r'\1\2\3', text)

        # 3. Clean repetitive OCR noise lines
        lines = [l.strip() for l in text.split('\n')]
        cleaned_lines = []
        for line in lines:
            if not line:
                continue
            # Filter out exam candidate noise headers
            if re.match(r'^(?:Roll No|Registration No|Name|Exam Date|Exam Time|Post Name):', line, re.IGNORECASE):
                continue
            if line.strip() in ['M', 'Boo', 'M Boo', 'M\nBoo']:
                continue
                
            # Deduplicate immediate consecutive identical lines
            if cleaned_lines and cleaned_lines[-1] == line:
                continue
                
            cleaned_lines.append(line)

        return "\n".join(cleaned_lines)

    def parse(self, pdf_path: str) -> dict:
        """
        Parses PDF using PyMuPDF into structured page text and extracted diagram images.
        """
        doc = fitz.open(pdf_path)
        extracted_images = []
        pages_text = []

        for pno, page in enumerate(doc):
            # Extract text
            raw_page_text = page.get_text("text")
            cleaned_page_text = self.clean_indic_text(raw_page_text)
            
            if cleaned_page_text:
                pages_text.append({
                    "page_number": pno + 1,
                    "text": cleaned_page_text
                })

            # Extract diagram images from page
            image_list = page.get_images(full=True)
            for img_index, img_info in enumerate(image_list):
                xref = img_info[0]
                base_image = doc.extract_image(xref)
                image_bytes = base_image["image"]
                image_ext = base_image["ext"]
                
                # Filter out tiny icon images (e.g. logos/bullets < 40px)
                if base_image["width"] > 40 and base_image["height"] > 40:
                    token_id = f"IMAGE_P{pno+1}_{xref}"
                    img_path = self.staging_dir / f"{token_id}.{image_ext}"
                    with open(img_path, "wb") as f_img:
                        f_img.write(image_bytes)
                    extracted_images.append({
                        "token": token_id,
                        "page_number": pno + 1,
                        "path": str(img_path)
                    })

        full_markdown = "\n\n".join([f"<!-- Page {p['page_number']} -->\n{p['text']}" for p in pages_text])

        return {
            "markdown": full_markdown,
            "pages": pages_text,
            "images": extracted_images
        }
