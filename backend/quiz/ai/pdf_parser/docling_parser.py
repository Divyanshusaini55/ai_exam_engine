import os
import logging
from pathlib import Path
from .pymupdf_parser import FastPdfParser

logger = logging.getLogger(__name__)

class DoclingParser:
    def __init__(self, staging_dir: str = "/tmp/ai_exam_staging"):
        self.staging_dir = Path(staging_dir)
        self.fast_parser = FastPdfParser(staging_dir=staging_dir)

    def parse(self, pdf_path: str) -> dict:
        """
        High-performance parser utilizing PyMuPDF with Devanagari text normalization and image extraction.
        """
        try:
            return self.fast_parser.parse(pdf_path)
        except Exception as e:
            logger.error(f"FastPdfParser error: {e}. Falling back to default extraction.")
            import fitz
            doc = fitz.open(pdf_path)
            full_text = "\n\n".join([page.get_text() for page in doc])
            return {
                "markdown": full_text,
                "pages": [{"page_number": i + 1, "text": page.get_text()} for i, page in enumerate(doc)],
                "images": []
            }
