from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .api import (
    ExamViewSet, CategoryViewSet, SubCategoryViewSet,
    QuestionPaperUploadViewSet, CorrectionSuggestionViewSet,
    CurrentAffairViewSet, ExamRoadmapViewSet, TopicResourceViewSet,
    submit_contact_message, list_contact_messages,
    update_contact_message_status, delete_contact_message,
)
from .views_auth import RegisterAPI, CustomLoginAPI, UserProfileAPI, PasswordResetRequestAPI, PasswordResetConfirmAPI
from rest_framework_simplejwt.views import TokenRefreshView

from .api_admin import (
    AdminDashboardStatsView, AdminCategoryViewSet, AdminSubCategoryViewSet,
    AdminExamViewSet, AdminQuestionViewSet, AdminCurrentAffairViewSet,
    AdminUserViewSet, AdminPdfUploadViewSet, AdminMessageViewSet, AdminSuggestionViewSet,
    AdminTopicResourceViewSet, AdminResourceTagViewSet, AdminExamRoadmapViewSet,
    AdminRoadmapPhaseViewSet, AdminRoadmapTopicViewSet, AdminTopicViewSet
)

router = DefaultRouter()
router.register(r'categories', CategoryViewSet, basename='category')
router.register(r'subcategories', SubCategoryViewSet, basename='subcategory')
router.register(r'exams', ExamViewSet, basename='exam')
router.register(r'uploads', QuestionPaperUploadViewSet, basename='upload')
router.register(r'suggestions', CorrectionSuggestionViewSet, basename='suggestion')
router.register(r'current-affairs', CurrentAffairViewSet, basename='current-affair')
router.register(r'roadmaps', ExamRoadmapViewSet, basename='roadmap')
router.register(r'resources', TopicResourceViewSet, basename='resource')

# Dedicated Admin API Router
admin_router = DefaultRouter()
admin_router.register(r'categories', AdminCategoryViewSet, basename='admin-category')
admin_router.register(r'subcategories', AdminSubCategoryViewSet, basename='admin-subcategory')
admin_router.register(r'topics', AdminTopicViewSet, basename='admin-topic')
admin_router.register(r'exams', AdminExamViewSet, basename='admin-exam')
admin_router.register(r'questions', AdminQuestionViewSet, basename='admin-question')
admin_router.register(r'current-affairs', AdminCurrentAffairViewSet, basename='admin-current-affair')
admin_router.register(r'users', AdminUserViewSet, basename='admin-user')
admin_router.register(r'uploads', AdminPdfUploadViewSet, basename='admin-upload')
admin_router.register(r'messages', AdminMessageViewSet, basename='admin-message')
admin_router.register(r'suggestions', AdminSuggestionViewSet, basename='admin-suggestion')
admin_router.register(r'resources', AdminTopicResourceViewSet, basename='admin-resource')
admin_router.register(r'tags', AdminResourceTagViewSet, basename='admin-tag')
admin_router.register(r'roadmaps', AdminExamRoadmapViewSet, basename='admin-roadmap')
admin_router.register(r'roadmap-phases', AdminRoadmapPhaseViewSet, basename='admin-roadmap-phase')
admin_router.register(r'roadmap-topics', AdminRoadmapTopicViewSet, basename='admin-roadmap-topic')

urlpatterns = [
    path('', include(router.urls)),
    path('admin/stats/', AdminDashboardStatsView.as_view(), name='admin_stats'),
    path('admin/', include(admin_router.urls)),

    path('auth/register/', RegisterAPI.as_view(), name='register'),
    path('auth/login/', CustomLoginAPI.as_view(), name='login'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/user/', UserProfileAPI.as_view(), name='user_profile'),
    path('auth/password-reset/', PasswordResetRequestAPI.as_view(), name='password_reset_request'),
    path('auth/password-reset/confirm/', PasswordResetConfirmAPI.as_view(), name='password_reset_confirm'),

    # Contact Support Endpoints
    path('contact/submit/', submit_contact_message, name='submit_contact'),
    path('admin/contact-messages/', list_contact_messages, name='list_contact_messages'),
    path('admin/contact-messages/<int:message_id>/status/', update_contact_message_status, name='update_message_status'),
    path('admin/contact-messages/<int:message_id>/', delete_contact_message, name='delete_message'),
]
