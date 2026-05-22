from __future__ import annotations

from django.db.models import F
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.response import Response
from rest_framework.views import APIView

from quiz.models import ResourceBookmark, ResourceProgress, TopicResource
from resources.serializers import (
    TopicResourceDetailSerializer,
    TopicResourceListSerializer,
)


# ─── 1. TopicResourceListView ──────────────────────────────────────────────────

class TopicResourceListView(generics.ListAPIView):
    """
    GET /api/resources/topic/<topic_slug>/

    Returns all *published* resources belonging to the roadmap topic
    identified by ``topic_slug``, ordered by ``order`` then ``created_at``.

    The request object is forwarded to the serializer context so that
    per-user fields (``is_completed``, ``is_bookmarked``) are resolved
    correctly for authenticated callers.  Anonymous callers receive
    ``False`` for both fields.
    """

    serializer_class = TopicResourceListSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        topic_slug: str = self.kwargs["topic_slug"]
        return (
            TopicResource.objects.filter(
                topic__slug=topic_slug,
                is_published=True,
            )
            .select_related("topic")
            .prefetch_related("tags")
            .order_by("order", "created_at")
        )

    def get_serializer_context(self):
        """Inject the request so serializer can resolve per-user state."""
        context = super().get_serializer_context()
        context["request"] = self.request
        return context


# ─── 2. TopicResourceDetailView ────────────────────────────────────────────────

class TopicResourceDetailView(generics.RetrieveAPIView):
    """
    GET /api/resources/<slug>/

    Returns the full detail of a single published resource.
    Atomically increments ``view_count`` via an ``F()`` expression on
    every GET so no read-back query is needed.
    """

    serializer_class = TopicResourceDetailSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    lookup_field = "slug"

    def get_queryset(self):
        return (
            TopicResource.objects.filter(is_published=True)
            .select_related("topic")
            .prefetch_related("tags")
        )

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["request"] = self.request
        return context

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()

        # Increment view_count atomically without a read-modify-write cycle.
        # We use update() on the queryset directly to avoid refetching the row.
        TopicResource.objects.filter(pk=instance.pk).update(
            view_count=F("view_count") + 1
        )

        serializer = self.get_serializer(instance)
        return Response(serializer.data)


# ─── 3. MarkResourceDoneView ───────────────────────────────────────────────────

class MarkResourceDoneView(APIView):
    """
    POST /api/resources/<slug>/mark-done/

    Toggles the ``is_completed`` flag on the caller's ``ResourceProgress``
    record for the given resource.  Creates the record on first call.

    Requires authentication.

    Response
    --------
    200 OK
    {
        "is_completed": true | false,
        "resource_slug": "<slug>"
    }
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, slug: str):
        resource = get_object_or_404(TopicResource, slug=slug, is_published=True)

        progress, created = ResourceProgress.objects.get_or_create(
            user=request.user,
            resource=resource,
            defaults={"is_completed": False},
        )

        if not created:
            # Toggle the flag
            progress.is_completed = not progress.is_completed
            progress.save(update_fields=["is_completed", "last_viewed_at"])

        return Response(
            {
                "is_completed": progress.is_completed,
                "resource_slug": resource.slug,
            },
            status=status.HTTP_200_OK,
        )


# ─── 4. BookmarkResourceView ───────────────────────────────────────────────────

class BookmarkResourceView(APIView):
    """
    POST /api/resources/<slug>/bookmark/

    Toggles the caller's ``ResourceBookmark`` for the given resource.
    Deletes the bookmark if it already exists, creates it otherwise.

    Requires authentication.

    Response
    --------
    200 OK
    {
        "is_bookmarked": true | false,
        "resource_slug": "<slug>"
    }
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, slug: str):
        resource = get_object_or_404(TopicResource, slug=slug, is_published=True)

        bookmark = ResourceBookmark.objects.filter(
            user=request.user,
            resource=resource,
        ).first()

        if bookmark:
            bookmark.delete()
            is_bookmarked = False
        else:
            ResourceBookmark.objects.create(user=request.user, resource=resource)
            is_bookmarked = True

        return Response(
            {
                "is_bookmarked": is_bookmarked,
                "resource_slug": resource.slug,
            },
            status=status.HTTP_200_OK,
        )
