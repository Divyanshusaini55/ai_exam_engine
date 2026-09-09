"""
examintel - Real-Time Pipeline Monitoring & Progress Tracking Engine
=====================================================================
Provides granular step-by-step progress tracking, Redis/DB dual state storage,
manual abort/cancellation control, and diagnostic metrics across all
stages of the ExamIntel ingestion pipeline.
"""

from __future__ import annotations
import os
import time
import json
import uuid
import logging
from enum import Enum
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List, Union

from django.core.cache import cache

logger = logging.getLogger("quiz.ai.examintel.pipeline_monitor")

CACHE_KEY_PREFIX = "pipeline_run:"
ACTIVE_RUNS_SET_KEY = "pipeline_active_runs"
DEFAULT_TTL = 86400  # 24 hours


def _is_valid_uuid(val: Any) -> bool:
    if not val:
        return False
    try:
        uuid.UUID(str(val))
        return True
    except (ValueError, AttributeError, TypeError):
        return False


class PipelineStage(str, Enum):
    INITIALIZING = "INITIALIZING"
    LAYOUT_EXTRACTION = "LAYOUT_EXTRACTION"
    MARKDOWN_GENERATION = "MARKDOWN_GENERATION"
    QUESTION_CHUNKING = "QUESTION_CHUNKING"
    INDIC_FONT_REPAIR = "INDIC_FONT_REPAIR"
    KATEX_VISION_REFINE = "KATEX_VISION_REFINE"
    BILINGUAL_ALIGNMENT = "BILINGUAL_ALIGNMENT"
    AGENTIC_SOLVE = "AGENTIC_SOLVE"
    CANONICAL_V2_ASSEMBLY = "CANONICAL_V2_ASSEMBLY"
    DB_PERSISTENCE = "DB_PERSISTENCE"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    ABORTED = "ABORTED"


# Default milestone progress percentage benchmarks for each stage
STAGE_DEFAULT_PROGRESS: Dict[PipelineStage, int] = {
    PipelineStage.INITIALIZING: 5,
    PipelineStage.LAYOUT_EXTRACTION: 15,
    PipelineStage.MARKDOWN_GENERATION: 30,
    PipelineStage.QUESTION_CHUNKING: 45,
    PipelineStage.INDIC_FONT_REPAIR: 55,
    PipelineStage.KATEX_VISION_REFINE: 70,
    PipelineStage.BILINGUAL_ALIGNMENT: 80,
    PipelineStage.AGENTIC_SOLVE: 88,
    PipelineStage.CANONICAL_V2_ASSEMBLY: 95,
    PipelineStage.DB_PERSISTENCE: 98,
    PipelineStage.COMPLETED: 100,
    PipelineStage.FAILED: 100,
    PipelineStage.ABORTED: 100,
}


def _cache_key(run_id: str) -> str:
    return f"{CACHE_KEY_PREFIX}{run_id}"


def _abort_key(run_id: str) -> str:
    return f"pipeline_abort:{run_id}"


def is_pipeline_aborted(run_id: Optional[str]) -> bool:
    """
    Checks if a pipeline run has been flagged for abort/cancellation.
    Sub-millisecond lookup against cache; also checks DB if run_id is a BackgroundJob.
    """
    if not run_id:
        return False

    try:
        if cache.get(_abort_key(run_id)):
            return True
    except Exception:
        pass

    # Check state cache
    try:
        state = cache.get(_cache_key(run_id))
        if state and isinstance(state, dict):
            if state.get("is_aborted") or state.get("stage") == PipelineStage.ABORTED.value:
                return True
    except Exception:
        pass

    # Check BackgroundJob if applicable
    if _is_valid_uuid(run_id):
        try:
            from jobs.models import BackgroundJob
            job = BackgroundJob.objects.filter(pk=run_id).first()
            if job and job.status in ["CANCELLED", "FAILED"]:
                return True
        except Exception:
            pass

    return False


def abort_pipeline(run_id: str, reason: str = "Manually aborted by user / admin") -> Dict[str, Any]:
    """
    Sets the abort signal for a pipeline run, preventing downstream heavy operations.
    Updates in-memory cache and transitions BackgroundJob to CANCELLED.
    """
    if not run_id:
        return {"success": False, "error": "Missing run_id"}

    logger.warning(f"Pipeline run '{run_id}' abort signal triggered. Reason: {reason}")

    # Set abort cache flag
    try:
        cache.set(_abort_key(run_id), True, timeout=DEFAULT_TTL)
    except Exception as e:
        logger.error(f"Failed setting abort key in cache: {e}")

    # Update state
    now_iso = datetime.now(timezone.utc).isoformat()
    state = get_pipeline_status(run_id) or {
        "run_id": run_id,
        "started_at": now_iso,
        "stage": PipelineStage.INITIALIZING.value,
        "progress": 0,
        "stages_history": [],
    }

    state["is_aborted"] = True
    state["stage"] = PipelineStage.ABORTED.value
    state["status"] = "ABORTED"
    state["error"] = reason
    state["completed_at"] = now_iso
    state["updated_at"] = now_iso

    try:
        cache.set(_cache_key(run_id), state, timeout=DEFAULT_TTL)
        _remove_active_run(run_id)
    except Exception as e:
        logger.error(f"Failed updating cache for aborted pipeline: {e}")

    # Synchronize with BackgroundJob if applicable
    if _is_valid_uuid(run_id):
        try:
            from jobs.models import BackgroundJob
            job = BackgroundJob.objects.filter(pk=run_id).first()
            if job and not job.is_terminal:
                job.status = "CANCELLED"
                job.metadata = {**(job.metadata or {}), "abort_reason": reason, "aborted_at": now_iso}
                job.save(update_fields=["status", "metadata"])
        except Exception as e:
            logger.warning(f"Failed to sync abort state to BackgroundJob: {e}")

    return {"success": True, "run_id": run_id, "status": "ABORTED", "reason": reason}


def set_pipeline_stage(
    run_id: Optional[str],
    stage: Union[PipelineStage, str],
    progress: Optional[int] = None,
    details: Optional[Dict[str, Any]] = None,
    error: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Records a stage transition for the specified pipeline run.
    Updates real-time cache and synchronizes with BackgroundJob.
    """
    if not run_id:
        return {}

    stage_val = stage.value if isinstance(stage, PipelineStage) else str(stage)
    now_iso = datetime.now(timezone.utc).isoformat()
    now_ts = time.time()

    # Determine progress percentage
    if progress is None:
        try:
            stage_enum = PipelineStage(stage_val)
            progress = STAGE_DEFAULT_PROGRESS.get(stage_enum, 0)
        except Exception:
            progress = 0
    elif isinstance(progress, float) and 0 < progress <= 1.0:
        progress = int(round(progress * 100))
    else:
        progress = int(round(progress))
    progress = max(0, min(100, progress))

    # Retrieve existing state or initialize
    state = get_pipeline_status(run_id)
    if not state:
        state = {
            "run_id": run_id,
            "status": "RUNNING",
            "stage": stage_val,
            "progress": progress,
            "started_at": now_iso,
            "started_ts": now_ts,
            "updated_at": now_iso,
            "is_aborted": False,
            "error": None,
            "details": {},
            "stages_history": [],
        }
        _register_active_run(run_id)

    # Check if this run is already aborted
    if state.get("is_aborted") and stage_val != PipelineStage.ABORTED.value:
        logger.info(f"Ignoring stage update '{stage_val}' for aborted run '{run_id}'.")
        return state

    # Finalize duration for previous active stage
    current_active_stage = state.get("stage")
    stages_history = list(state.get("stages_history", []))

    if current_active_stage and current_active_stage != stage_val:
        prev_started_ts = state.get("current_stage_started_ts", state.get("started_ts", now_ts))
        stage_duration = round(now_ts - prev_started_ts, 3)

        # Update or append historical record
        found = False
        for hist in stages_history:
            if hist.get("stage") == current_active_stage and hist.get("status") == "RUNNING":
                hist["status"] = "COMPLETED"
                hist["duration_seconds"] = stage_duration
                hist["completed_at"] = now_iso
                found = True
                break
        if not found:
            stages_history.append({
                "stage": current_active_stage,
                "status": "COMPLETED",
                "duration_seconds": stage_duration,
                "completed_at": now_iso,
            })

    # Start the new stage entry in history
    if stage_val not in [PipelineStage.COMPLETED.value, PipelineStage.FAILED.value, PipelineStage.ABORTED.value]:
        stages_history.append({
            "stage": stage_val,
            "status": "RUNNING",
            "started_at": now_iso,
            "details": details or {},
        })

    # Update overall state
    state["stage"] = stage_val
    state["progress"] = progress
    state["updated_at"] = now_iso
    state["current_stage_started_ts"] = now_ts
    state["stages_history"] = stages_history

    if details:
        state["details"] = {**(state.get("details") or {}), **details}

    if error:
        state["error"] = error
        state["status"] = "FAILED"
    elif stage_val == PipelineStage.COMPLETED.value:
        state["status"] = "COMPLETED"
        state["completed_at"] = now_iso
        _remove_active_run(run_id)
    elif stage_val == PipelineStage.ABORTED.value:
        state["status"] = "ABORTED"
        state["is_aborted"] = True
        state["completed_at"] = now_iso
        _remove_active_run(run_id)
    elif stage_val == PipelineStage.FAILED.value:
        state["status"] = "FAILED"
        state["completed_at"] = now_iso
        _remove_active_run(run_id)
    else:
        state["status"] = "RUNNING"

    # Save to Redis cache
    try:
        cache.set(_cache_key(run_id), state, timeout=DEFAULT_TTL)
    except Exception as e:
        logger.error(f"Failed to cache pipeline status for '{run_id}': {e}")

    # Synchronize with BackgroundJob if run_id is registered
    if _is_valid_uuid(run_id):
        try:
            from jobs.models import BackgroundJob
            job = BackgroundJob.objects.filter(pk=run_id).first()
            if job and not job.is_terminal:
                job.stage = stage_val
                job.progress = progress
                job.metadata = {
                    **(job.metadata or {}),
                    "pipeline_stage": stage_val,
                    "details": details or {},
                    "updated_at": now_iso,
                }
                if error:
                    job.error = error
                    job.status = "FAILED"
                elif stage_val == PipelineStage.COMPLETED.value:
                    job.status = "COMPLETED"
                elif stage_val == PipelineStage.ABORTED.value:
                    job.status = "CANCELLED"
                job.save(update_fields=["stage", "progress", "metadata", "status"] + (["error"] if error else []))
        except Exception as e:
            # Non-fatal if not using BackgroundJob
            pass

    logger.info(f"Pipeline '{run_id}' [Progress: {progress}%] Stage -> {stage_val}")
    return state


def get_pipeline_status(run_id: str) -> Optional[Dict[str, Any]]:
    """
    Retrieves the complete step-by-step progress and diagnostic status for a run.
    """
    if not run_id:
        return None

    try:
        cached = cache.get(_cache_key(run_id))
        if cached and isinstance(cached, dict):
            return cached
    except Exception:
        pass

    # Fallback to BackgroundJob if in database
    if _is_valid_uuid(run_id):
        try:
            from jobs.models import BackgroundJob
            job = BackgroundJob.objects.filter(pk=run_id).first()
            if job:
                return {
                    "run_id": str(job.id),
                    "status": job.status,
                    "stage": job.stage or PipelineStage.INITIALIZING.value,
                    "progress": job.progress,
                    "is_aborted": job.status == "CANCELLED",
                    "error": job.error,
                    "details": (job.metadata or {}).get("details", {}),
                    "stages_history": (job.metadata or {}).get("stages_history", []),
                    "started_at": job.started_at.isoformat() if job.started_at else None,
                    "completed_at": job.completed_at.isoformat() if job.completed_at else None,
                }
        except Exception:
            pass

    return None


def list_active_pipelines() -> List[Dict[str, Any]]:
    """
    Returns a list of all currently active (RUNNING) pipeline instances.
    """
    active_runs = []
    try:
        run_ids = cache.get(ACTIVE_RUNS_SET_KEY) or []
        for rid in list(run_ids):
            st = get_pipeline_status(rid)
            if st and st.get("status") == "RUNNING":
                active_runs.append(st)
            else:
                # Evict stale from active set
                _remove_active_run(rid)
    except Exception as e:
        logger.error(f"Error listing active pipelines: {e}")
    return active_runs


def _register_active_run(run_id: str):
    try:
        active = set(cache.get(ACTIVE_RUNS_SET_KEY) or [])
        active.add(run_id)
        cache.set(ACTIVE_RUNS_SET_KEY, list(active), timeout=DEFAULT_TTL)
    except Exception:
        pass


def _remove_active_run(run_id: str):
    try:
        active = set(cache.get(ACTIVE_RUNS_SET_KEY) or [])
        if run_id in active:
            active.remove(run_id)
            cache.set(ACTIVE_RUNS_SET_KEY, list(active), timeout=DEFAULT_TTL)
    except Exception:
        pass
