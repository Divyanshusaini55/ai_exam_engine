from django.urls import path

from health import views

urlpatterns = [
    path('', views.health_check, name='health-check'),
    path('worker/', views.worker_check, name='health-worker'),
    path('cache/', views.cache_check, name='health-cache'),
]
