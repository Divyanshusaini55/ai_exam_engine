from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ProfileViewSet, SolutionViewSet, CommentViewSet, NotificationViewSet,
    CommunityOverviewView, MyStatsView, TopContributorsView,
    ActivityFeedView, CategoryLeaderboardView, BadgesListView, ContributorProfileView,
)
from .api_admin import (
    AdminProfileViewSet, AdminBadgeViewSet, AdminUserBadgeViewSet,
    AdminSolutionViewSet, AdminCommentViewSet,
    AdminContributorActivityViewSet, AdminNotificationViewSet
)

router = DefaultRouter()
router.register(r'profiles',      ProfileViewSet,      basename='profile')
router.register(r'solutions',     SolutionViewSet,     basename='solution')
router.register(r'comments',      CommentViewSet,      basename='comment')
router.register(r'notifications', NotificationViewSet, basename='notification')

admin_router = DefaultRouter()
admin_router.register(r'profiles', AdminProfileViewSet, basename='admin-profile')
admin_router.register(r'badges', AdminBadgeViewSet, basename='admin-badge')
admin_router.register(r'user-badges', AdminUserBadgeViewSet, basename='admin-user-badge')
admin_router.register(r'solutions', AdminSolutionViewSet, basename='admin-solution')
admin_router.register(r'comments', AdminCommentViewSet, basename='admin-comment')
admin_router.register(r'activities', AdminContributorActivityViewSet, basename='admin-activity')
admin_router.register(r'notifications', AdminNotificationViewSet, basename='admin-notification')

urlpatterns = [
    path('admin/', include(admin_router.urls)),
    path('', include(router.urls)),
    
    # Settings endpoints
    path('settings/', include([
        path('', __import__('community.views_settings', fromlist=['SettingsView']).SettingsView.as_view(), name='settings-main'),
        path('export/', __import__('community.views_settings', fromlist=['ExportDataView']).ExportDataView.as_view(), name='settings-export'),
        path('delete-account/', __import__('community.views_settings', fromlist=['DeleteAccountView']).DeleteAccountView.as_view(), name='settings-delete-account'),
    ])),
    # Contributor analytics endpoints
    path('contributors/',                          CommunityOverviewView.as_view(),      name='contributors-overview'),
    path('contributors/stats/me/',                 MyStatsView.as_view(),                name='contributors-my-stats'),
    path('contributors/top/',                      TopContributorsView.as_view(),         name='contributors-top'),
    path('contributors/activity/',                 ActivityFeedView.as_view(),            name='contributors-activity'),
    path('contributors/leaderboard/',              CategoryLeaderboardView.as_view(),     name='contributors-leaderboard'),
    path('contributors/badges/',                   BadgesListView.as_view(),              name='contributors-badges'),
    path('contributors/profile/<str:username>/',   ContributorProfileView.as_view(),      name='contributors-profile'),
]
