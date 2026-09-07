from __future__ import annotations
import os
import logging
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from django.conf import settings

logger = logging.getLogger("quiz.ai.examintel.asset_storage_agent")


class AssetStorageAgent:
    """
    Enterprise Visual Asset Ingestion Agent.
    Uploads local diagrams, option figures, and 300 DPI high-res crops into
    Django Object Storage (AWS S3, Cloudflare R2, or local MediaStorage),
    rewriting local relative paths to permanent public CDN / Media URLs.
    """

    @classmethod
    def ingest_exam_assets(
        cls,
        exam_slug: str,
        base_dir: str | Path,
        questions: list,
        backend_base_url: Optional[str] = None,
    ) -> Dict[str, str]:
        """
        Scans all visual assets in the parsed questions, uploads them to default_storage,
        and returns a dictionary mapping: local_relative_path -> public_cdn_url.
        Also mutates question objects in-place to update their image URLs.
        """
        base_path = Path(base_dir)
        url_map: Dict[str, str] = {}

        # Collect all unique asset paths referenced
        asset_paths: set[str] = set()
        for q in questions:
            for fig in getattr(q, "figure_paths", []) or []:
                if fig:
                    asset_paths.add(fig)
            for opt in getattr(q, "options", []) or []:
                opt_img = getattr(opt, "image_url", None)
                if opt_img:
                    asset_paths.add(opt_img)
            crop = getattr(q, "crop_image_path", None)
            if crop:
                asset_paths.add(crop)

        logger.info(f"Discovered {len(asset_paths)} visual assets for exam '{exam_slug}'. Ingesting to object storage...")

        # Base URL resolution for local dev
        effective_base = backend_base_url or getattr(settings, "BACKEND_PUBLIC_URL", "http://localhost:8000")
        if effective_base.endswith("/"):
            effective_base = effective_base[:-1]

        import concurrent.futures

        def upload_single_asset(rel_path: str) -> tuple[str, str]:
            disk_file = base_path / rel_path
            if not disk_file.exists():
                disk_file = base_path.parent / rel_path
            if not disk_file.exists() and Path(rel_path).exists():
                disk_file = Path(rel_path)

            if not disk_file.exists() or not disk_file.is_file():
                logger.warning(f"Visual asset file not found on disk: '{rel_path}'")
                return rel_path, rel_path

            clean_subpath = rel_path.lstrip("./").lstrip("/")
            storage_target = f"exams/{exam_slug}/{clean_subpath}"

            try:
                if not default_storage.exists(storage_target):
                    with open(disk_file, "rb") as f:
                        file_bytes = f.read()
                    default_storage.save(storage_target, ContentFile(file_bytes))

                public_url = default_storage.url(storage_target)
                if public_url.startswith("/") and not public_url.startswith("//"):
                    full_cdn_url = f"{effective_base}{public_url}"
                else:
                    full_cdn_url = public_url

                return rel_path, full_cdn_url
            except Exception as e:
                logger.error(f"Failed to upload asset '{storage_target}': {e}")
                return rel_path, rel_path

        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            upload_results = list(executor.map(upload_single_asset, sorted(asset_paths)))

        for rel, cdn in upload_results:
            url_map[rel] = cdn

        # Now rewrite all references in the question objects
        for q in questions:
            # Stem figures
            if hasattr(q, "figure_paths") and q.figure_paths:
                q.figure_paths = [url_map.get(f, f) for f in q.figure_paths]

            # Option images
            if hasattr(q, "options") and q.options:
                for opt in q.options:
                    if hasattr(opt, "image_url") and opt.image_url:
                        opt.image_url = url_map.get(opt.image_url, opt.image_url)

            # Crop images
            if hasattr(q, "crop_image_path") and q.crop_image_path:
                q.crop_image_path = url_map.get(q.crop_image_path, q.crop_image_path)

        logger.info(f"Successfully mapped and updated {len(url_map)} assets to CDN URLs for '{exam_slug}'.")
        return url_map
