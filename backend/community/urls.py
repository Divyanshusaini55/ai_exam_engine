from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ProfileViewSet, SolutionViewSet, CommentViewSet, NotificationViewSet,
    CommunityOverviewView, MyStatsView, TopContributorsView,
    ActivityFeedView, CategoryLeaderboardView, BadgesListView, ContributorProfileView,
)

router = DefaultRouter()
router.register(r'profiles',      ProfileViewSet,      basename='profile')
router.register(r'solutions',     SolutionViewSet,     basename='solution')
router.register(r'comments',      CommentViewSet,      basename='comment')
router.register(r'notifications', NotificationViewSet, basename='notification')

urlpatterns = [
    path('', include(router.urls)),

    # Contributor analytics endpoints
    path('contributors/',                          CommunityOverviewView.as_view(),      name='contributors-overview'),
    path('contributors/stats/me/',                 MyStatsView.as_view(),                name='contributors-my-stats'),
    path('contributors/top/',                      TopContributorsView.as_view(),         name='contributors-top'),
    path('contributors/activity/',                 ActivityFeedView.as_view(),            name='contributors-activity'),
    path('contributors/leaderboard/',              CategoryLeaderboardView.as_view(),     name='contributors-leaderboard'),
    path('contributors/badges/',                   BadgesListView.as_view(),              name='contributors-badges'),
    path('contributors/profile/<str:username>/',   ContributorProfileView.as_view(),      name='contributors-profile'),
]
