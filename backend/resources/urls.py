"""
resources/urls.py
─────────────────
URL patterns for the Resource CMS app.
Mounted at /api/resources/ in core/urls.py.
"""

from django.urls import path

from resources.views import (
    BookmarkResourceView,
    MarkResourceDoneView,
    TopicResourceDetailView,
    TopicResourceListView,
)

app_name = "resources"

urlpatterns = [
    # List all published resources for a roadmap topic
    path(
        "topic/<slug:topic_slug>/",
        TopicResourceListView.as_view(),
        name="resource-list",
    ),
    # Full detail of a single resource (must come AFTER topic/ to avoid ambiguity)
    path(
        "<slug:slug>/",
        TopicResourceDetailView.as_view(),
        name="resource-detail",
    ),
    # Toggle completed state for the authenticated user
    path(
        "<slug:slug>/mark-done/",
        MarkResourceDoneView.as_view(),
        name="resource-mark-done",
    ),
    # Toggle bookmark for the authenticated user
    path(
        "<slug:slug>/bookmark/",
        BookmarkResourceView.as_view(),
        name="resource-bookmark",
    ),
]
