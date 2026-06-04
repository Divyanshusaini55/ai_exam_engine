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

class TopicResourceListView(generics.ListAPIView):

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
        context = super().get_serializer_context()
        context["request"] = self.request
        return context


class TopicResourceDetailView(generics.RetrieveAPIView):

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

        TopicResource.objects.filter(pk=instance.pk).update(
            view_count=F("view_count") + 1
        )

        serializer = self.get_serializer(instance)
        return Response(serializer.data)


class MarkResourceDoneView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, slug: str):
        resource = get_object_or_404(TopicResource, slug=slug, is_published=True)

        progress, created = ResourceProgress.objects.get_or_create(
            user=request.user,
            resource=resource,
            defaults={"is_completed": False},
        )

        if not created:
            progress.is_completed = not progress.is_completed
            progress.save(update_fields=["is_completed", "last_viewed_at"])

        return Response(
            {
                "is_completed": progress.is_completed,
                "resource_slug": resource.slug,
            },
            status=status.HTTP_200_OK,
        )

class BookmarkResourceView(APIView):
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
