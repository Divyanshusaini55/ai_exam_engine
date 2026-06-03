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

router = DefaultRouter()
router.register(r'categories', CategoryViewSet, basename='category')
router.register(r'subcategories', SubCategoryViewSet, basename='subcategory')
router.register(r'exams', ExamViewSet, basename='exam')
router.register(r'uploads', QuestionPaperUploadViewSet, basename='upload')
router.register(r'suggestions', CorrectionSuggestionViewSet, basename='suggestion')
router.register(r'current-affairs', CurrentAffairViewSet, basename='current-affair')
router.register(r'roadmaps', ExamRoadmapViewSet, basename='roadmap')
router.register(r'resources', TopicResourceViewSet, basename='resource')

urlpatterns = [
    path('', include(router.urls)),
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
