from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import viewsets, views
from rest_framework.response import Response
from rest_framework.permissions import IsAdminUser
from rest_framework import serializers

from .models import BackgroundJob
from community.models import Solution

User = get_user_model()

class AdminBackgroundJobSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = BackgroundJob
        fields = '__all__'

class AdminBackgroundJobViewSet(viewsets.ModelViewSet):
    """
    Admin ViewSet for BackgroundJobs.
    Provides list, retrieve, and cancel (destroy maps to cancel maybe).
    """
    queryset = BackgroundJob.objects.all().select_related('user').order_by('-created_at')
    serializer_class = AdminBackgroundJobSerializer
    permission_classes = [IsAdminUser]

    # Typically we don't want to physically delete background jobs, just cancel them.
    # But DRF destroy will delete. We can override it to just mark as CANCELLED if RUNNING/QUEUED.
    def destroy(self, request, *args, **kwargs):
        job = self.get_object()
        if job.status in ['QUEUED', 'RUNNING']:
            job.status = 'CANCELLED'
            job.save(update_fields=['status'])
            return Response(status=204)
        return super().destroy(request, *args, **kwargs)

class DashboardStatsView(views.APIView):
    """
    Returns high-level statistics for the admin dashboard.
    """
    permission_classes = [IsAdminUser]

    def get(self, request, *args, **kwargs):
        active_users = User.objects.filter(is_active=True).count()
        pending_jobs = BackgroundJob.objects.filter(status__in=['QUEUED', 'RUNNING']).count()
        today = timezone.now().date()
        new_solutions = Solution.objects.filter(created_at__date=today).count()
        
        return Response({
            'active_users': active_users,
            'pending_jobs': pending_jobs,
            'new_solutions_today': new_solutions
        })
