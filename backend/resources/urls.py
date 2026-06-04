
from django.urls import path

from resources.views import (
    BookmarkResourceView,
    MarkResourceDoneView,
    TopicResourceDetailView,
    TopicResourceListView,
)

app_name = "resources"

urlpatterns = [
    path(
        "topic/<slug:topic_slug>/",
        TopicResourceListView.as_view(),
        name="resource-list",
    ),
    path(
        "<slug:slug>/",
        TopicResourceDetailView.as_view(),
        name="resource-detail",
    ),
    path(
        "<slug:slug>/mark-done/",
        MarkResourceDoneView.as_view(),
        name="resource-mark-done",
    ),
    path(
        "<slug:slug>/bookmark/",
        BookmarkResourceView.as_view(),
        name="resource-bookmark",
    ),
]
