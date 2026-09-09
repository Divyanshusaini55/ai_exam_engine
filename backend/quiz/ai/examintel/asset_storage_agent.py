from __future__ import annotations
import os
import logging
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any
import concurrent.futures

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
    Supports QuestionBlock objects, ParsedQuestion objects, and canonical dict payloads.
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
        Scans all visual assets in the output directory and question objects,
        uploads them to default_storage (S3/R2/local), and returns a dictionary
        mapping: local_relative_path -> public_cdn_url.
        Also mutates question objects/dicts in-place to update their image URLs.
        """
        base_path = Path(base_dir)
        url_map: Dict[str, str] = {}

        # 1. Collect all unique asset paths referenced in question objects/dicts
        asset_paths: set[str] = set()
        for q in questions:
            if isinstance(q, dict):
                # Dict representation (canonical v2, fused_json, etc.)
                content = q.get("content") or {}
                images = content.get("images") or {}
                if isinstance(images, dict):
                    for img_k, img_v in images.items():
                        if isinstance(img_v, dict) and img_v.get("url"):
                            asset_paths.add(img_v["url"])
                        elif isinstance(img_v, str) and img_v.strip():
                            asset_paths.add(img_v.strip())
                        elif isinstance(img_v, list):
                            for sub in img_v:
                                if isinstance(sub, str) and sub.strip():
                                    asset_paths.add(sub.strip())
                                elif isinstance(sub, dict) and sub.get("url"):
                                    asset_paths.add(sub["url"])

                for d in q.get("diagram_paths") or []:
                    if d:
                        asset_paths.add(d)

                for opt in q.get("options") or []:
                    if isinstance(opt, dict):
                        opt_img = opt.get("image_url") or opt.get("option_image_path")
                        if opt_img:
                            asset_paths.add(opt_img)

                crop = q.get("crop_image_url") or q.get("crop_image_path")
                if crop:
                    asset_paths.add(crop)
            else:
                # Class instance (QuestionBlock, ParsedQuestion, CanonicalV2Question, etc.)
                for fig in (getattr(q, "figure_paths", None) or getattr(q, "diagram_image_paths", None) or []):
                    if fig:
                        asset_paths.add(fig)

                for opt in getattr(q, "options", []) or []:
                    opt_img = getattr(opt, "image_url", None) or getattr(opt, "option_image_path", None)
                    if opt_img:
                        asset_paths.add(opt_img)

                crop = getattr(q, "crop_image_path", None) or getattr(q, "crop_image_url", None)
                if crop:
                    asset_paths.add(crop)

        # 2. Also proactively scan base_path / "assets" on disk for all generated PNGs/JPGs
        assets_disk_dir = base_path / "assets"
        if not assets_disk_dir.exists() and (base_path.parent / "assets").exists():
            assets_disk_dir = base_path.parent / "assets"

        if assets_disk_dir.exists():
            for p in assets_disk_dir.glob("*"):
                if p.is_file() and p.suffix.lower() in [".png", ".jpg", ".jpeg", ".webp"]:
                    asset_paths.add(f"assets/{p.name}")
            crops_dir = assets_disk_dir / "crops"
            if crops_dir.exists():
                for cp in crops_dir.glob("*"):
                    if cp.is_file() and cp.suffix.lower() in [".png", ".jpg", ".jpeg", ".webp"]:
                        asset_paths.add(f"assets/crops/{cp.name}")

        logger.info(f"Discovered {len(asset_paths)} visual assets for exam '{exam_slug}'. Ingesting to object storage...")

        # Base URL resolution for local dev fallback
        effective_base = backend_base_url or getattr(settings, "BACKEND_PUBLIC_URL", "http://localhost:8000")
        if effective_base.endswith("/"):
            effective_base = effective_base[:-1]

        def upload_single_asset(rel_path: str) -> tuple[str, str]:
            if not rel_path or rel_path.startswith("http://") or rel_path.startswith("https://"):
                return rel_path, rel_path

            # Locate file on disk
            candidates = [
                base_path / rel_path,
                base_path.parent / rel_path,
                Path(settings.BASE_DIR) / rel_path,
            ]
            if hasattr(settings, "MEDIA_ROOT") and settings.MEDIA_ROOT:
                candidates.append(Path(settings.MEDIA_ROOT) / rel_path)
                candidates.append(Path(settings.MEDIA_ROOT) / "exam_assets" / exam_slug / rel_path)
            if Path(rel_path).is_absolute() and Path(rel_path).exists():
                candidates.insert(0, Path(rel_path))

            disk_file = None
            for cand in candidates:
                if cand.exists() and cand.is_file():
                    disk_file = cand
                    break

            if not disk_file:
                logger.warning(f"Visual asset file not found on disk: '{rel_path}'")
                return rel_path, rel_path

            clean_subpath = rel_path.lstrip("./").lstrip("/")
            if clean_subpath.startswith(f"exams/{exam_slug}/"):
                storage_target = clean_subpath
            else:
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
            # Also register bare filename key (e.g. 'page_2_img_45.png' -> cdn)
            p_name = Path(rel).name
            if p_name not in url_map:
                url_map[p_name] = cdn
            if not rel.startswith("assets/") and f"assets/{rel}" not in url_map:
                url_map[f"assets/{rel}"] = cdn

        # Helper to rewrite a path or URL using url_map
        def map_url(u: Optional[str]) -> Optional[str]:
            if not u:
                return u
            return url_map.get(u, url_map.get(Path(u).name, u))

        # Now rewrite all references in question objects / dicts in-place
        for q in questions:
            if isinstance(q, dict):
                # 1. Content images
                content = q.get("content")
                if isinstance(content, dict):
                    images = content.get("images")
                    if isinstance(images, dict):
                        for img_k, img_v in images.items():
                            if isinstance(img_v, dict) and img_v.get("url"):
                                img_v["url"] = map_url(img_v["url"])
                            elif isinstance(img_v, str):
                                images[img_k] = map_url(img_v)
                            elif isinstance(img_v, list):
                                images[img_k] = [map_url(x) if isinstance(x, str) else (map_url(x.get("url")) if isinstance(x, dict) else x) for x in img_v]

                if "diagram_paths" in q and isinstance(q["diagram_paths"], list):
                    q["diagram_paths"] = [map_url(d) for d in q["diagram_paths"]]

                if "crop_image_url" in q and q["crop_image_url"]:
                    q["crop_image_url"] = map_url(q["crop_image_url"])

                # 2. Options
                for opt in q.get("options") or []:
                    if isinstance(opt, dict):
                        if "image_url" in opt and opt["image_url"]:
                            opt["image_url"] = map_url(opt["image_url"])
                        if "option_image_path" in opt and opt["option_image_path"]:
                            opt["option_image_path"] = map_url(opt["option_image_path"])
            else:
                # Class instance
                if hasattr(q, "figure_paths") and q.figure_paths:
                    q.figure_paths = [map_url(f) for f in q.figure_paths]

                if hasattr(q, "diagram_image_paths") and q.diagram_image_paths:
                    q.diagram_image_paths = [map_url(f) for f in q.diagram_image_paths]

                if hasattr(q, "options") and q.options:
                    for opt in q.options:
                        if hasattr(opt, "image_url") and opt.image_url:
                            opt.image_url = map_url(opt.image_url)
                        if hasattr(opt, "option_image_path") and opt.option_image_path:
                            opt.option_image_path = map_url(opt.option_image_path)

                if hasattr(q, "crop_image_path") and q.crop_image_path:
                    q.crop_image_path = map_url(q.crop_image_path)
                if hasattr(q, "crop_image_url") and q.crop_image_url:
                    q.crop_image_url = map_url(q.crop_image_url)

        logger.info(f"Successfully mapped and updated {len(url_map)} assets to CDN URLs for '{exam_slug}'.")
        return url_map
