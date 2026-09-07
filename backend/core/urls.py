from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse 
from drf_spectacular.views import SpectacularAPIView, SpectacularRedocView, SpectacularSwaggerView

def home(request):
    return JsonResponse({"message": "Welcome to Exam Engine API! Go to localhost:4005 to use the app."})

urlpatterns = [
    path('health/', include('health.urls')),
    path('admin/', admin.site.urls),
    path('api/', include('quiz.urls')),
    path('api/community/', include('community.urls')),
    path('api/jobs/', include('jobs.urls')),
    path('api/resource-hub/', include('resources.urls')),
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
    path('', home),
]

from django.urls import re_path
from django.views.static import serve

if settings.DEBUG:
    urlpatterns += [
        re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),
    ]