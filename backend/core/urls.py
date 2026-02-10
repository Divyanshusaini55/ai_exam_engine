from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse # <--- Import this

# Simple Welcome View
def home(request):
    return JsonResponse({"message": "Welcome to Exam Engine API! Go to localhost:3000 to use the app."})

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('quiz.urls')),
    path('', home), # <--- Add this line for the root URL
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)