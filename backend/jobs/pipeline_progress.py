"""
jobs.pipeline_progress - Re-exports from quiz.ai.examintel.pipeline_monitor
===========================================================================
Provides unified interface for pipeline progress tracking, stage management,
and abort detection across both jobs and examintel modules.
"""

from quiz.ai.examintel.pipeline_monitor import (
    PipelineStage,
    set_pipeline_stage,
    is_pipeline_aborted,
    abort_pipeline,
    get_pipeline_status,
    list_active_pipelines,
    STAGE_DEFAULT_PROGRESS,
)

__all__ = [
    "PipelineStage",
    "set_pipeline_stage",
    "is_pipeline_aborted",
    "abort_pipeline",
    "get_pipeline_status",
    "list_active_pipelines",
    "STAGE_DEFAULT_PROGRESS",
]
