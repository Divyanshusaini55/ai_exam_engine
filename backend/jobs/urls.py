from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .api_admin import AdminBackgroundJobViewSet, DashboardStatsView
from quiz.api_pipeline import (
    PipelineStatusView,
    PipelineAbortView,
    PipelineActiveListView,
)

admin_router = DefaultRouter()
admin_router.register(r'jobs', AdminBackgroundJobViewSet, basename='admin-jobs')

urlpatterns = [
    path('admin/', include(admin_router.urls)),
    path('admin/stats/', DashboardStatsView.as_view(), name='admin-dashboard-stats'),
    path('pipeline/active/', PipelineActiveListView.as_view(), name='pipeline-active-list'),
    path('pipeline/<str:run_id>/status/', PipelineStatusView.as_view(), name='pipeline-status'),
    path('pipeline/<str:run_id>/abort/', PipelineAbortView.as_view(), name='pipeline-abort'),
]
