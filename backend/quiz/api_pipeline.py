"""
quiz.api_pipeline - REST Monitoring API Endpoints for ExamIntel Pipelines
========================================================================
Provides endpoints for real-time progress polling, stage history inspection,
pipeline abort triggers, and active execution monitoring.
"""

from __future__ import annotations
import logging
from typing import Dict, Any

from rest_framework import views, status, permissions
from rest_framework.response import Response

from quiz.ai.examintel.pipeline_monitor import (
    get_pipeline_status,
    abort_pipeline,
    list_active_pipelines,
    PipelineStage,
)

logger = logging.getLogger("quiz.api_pipeline")


class PipelineStatusView(views.APIView):
    """
    GET /api/jobs/pipeline/<run_id>/status/
    Returns full real-time status, active stage, percentage, and timing breakdown.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request, run_id: str):
        if not run_id:
            return Response(
                {"error": "Missing required run_id parameter."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        status_data = get_pipeline_status(run_id)
        if not status_data:
            return Response(
                {
                    "run_id": run_id,
                    "status": "NOT_FOUND",
                    "stage": None,
                    "progress": 0,
                    "message": f"No active or historical pipeline found for run_id '{run_id}'.",
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        # Standardize response structure
        return Response({
            "run_id": run_id,
            "status": status_data.get("status", "UNKNOWN"),
            "stage": status_data.get("stage"),
            "stage_label": str(status_data.get("stage", "")).replace("_", " ").title(),
            "progress": status_data.get("progress", 0),
            "progress_percent": f"{status_data.get('progress', 0)}%",
            "is_aborted": status_data.get("is_aborted", False),
            "error": status_data.get("error"),
            "details": status_data.get("details", {}),
            "stages_history": status_data.get("stages_history", []),
            "started_at": status_data.get("started_at"),
            "updated_at": status_data.get("updated_at"),
            "completed_at": status_data.get("completed_at"),
            "duration_seconds": status_data.get("duration_seconds"),
        }, status=status.HTTP_200_OK)


class PipelineAbortView(views.APIView):
    """
    POST /api/jobs/pipeline/<run_id>/abort/
    Signals the running pipeline to abort immediately before downstream heavy operations.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request, run_id: str):
        if not run_id:
            return Response(
                {"error": "Missing required run_id parameter."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        reason = request.data.get("reason", "Manually aborted via monitoring API")
        res = abort_pipeline(run_id, reason=reason)
        return Response(res, status=status.HTTP_200_OK)


class PipelineActiveListView(views.APIView):
    """
    GET /api/jobs/pipeline/active/
    Lists all currently active running pipeline instances.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        active_runs = list_active_pipelines()
        return Response({
            "count": len(active_runs),
            "active_runs": active_runs,
        }, status=status.HTTP_200_OK)
