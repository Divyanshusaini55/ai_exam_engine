from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .api_admin import AdminBackgroundJobViewSet, DashboardStatsView

admin_router = DefaultRouter()
admin_router.register(r'jobs', AdminBackgroundJobViewSet, basename='admin-jobs')

urlpatterns = [
    path('admin/', include(admin_router.urls)),
    path('admin/stats/', DashboardStatsView.as_view(), name='admin-dashboard-stats'),
]
