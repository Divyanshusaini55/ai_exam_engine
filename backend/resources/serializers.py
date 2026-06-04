from __future__ import annotations

from rest_framework import serializers

from quiz.models import (
    ResourceBookmark,
    ResourceProgress,
    ResourceTag,
    TopicResource,
)
from resources.renderers import get_renderable_content

class ResourceTagSerializer(serializers.ModelSerializer):
    """Lightweight serializer for resource tags used in nested contexts."""

    class Meta:
        model = ResourceTag
        fields = ["id", "name", "slug", "color"]


class TopicResourceListSerializer(serializers.ModelSerializer):
    tags = ResourceTagSerializer(many=True, read_only=True)
    is_completed = serializers.SerializerMethodField()
    is_bookmarked = serializers.SerializerMethodField()

    class Meta:
        model = TopicResource
        fields = [
            "id",
            "title",
            "slug",
            "short_description",
            "resource_type",
            "content_format",
            "difficulty",
            "estimated_read_minutes",
            "view_count",
            "is_featured",
            "is_ai_generated",
            "tags",
            "thumbnail",
            # Per-user computed fields
            "is_completed",
            "is_bookmarked",
        ]

    def _get_user(self):
        request = self.context.get("request")
        if request and hasattr(request, "user") and request.user.is_authenticated:
            return request.user
        return None

    def get_is_completed(self, obj: TopicResource) -> bool:
        user = self._get_user()
        if user is None:
            return False
        return ResourceProgress.objects.filter(
            user=user,
            resource=obj,
            is_completed=True,
        ).exists()

    def get_is_bookmarked(self, obj: TopicResource) -> bool:
        user = self._get_user()
        if user is None:
            return False
        return ResourceBookmark.objects.filter(
            user=user,
            resource=obj,
        ).exists()

class TopicResourceDetailSerializer(TopicResourceListSerializer):

    content = serializers.SerializerMethodField()
    rendered_content_format = serializers.SerializerMethodField()

    class Meta(TopicResourceListSerializer.Meta):
        fields = TopicResourceListSerializer.Meta.fields + [
            "ai_summary",
            "is_published",
            "order",
            "created_at",
            "updated_at",
            "content",
            "rendered_content_format",
        ]

    def _render(self, obj: TopicResource) -> dict:
        cache_attr = f"_rendered_{obj.pk}"
        if not hasattr(self, cache_attr):
            try:
                result = get_renderable_content(obj)
            except Exception:
                result = {
                    "content": (
                        "⚠ Content could not be rendered. "
                        "Please try again later."
                    ),
                    "content_format": "plaintext",
                }
            setattr(self, cache_attr, result)
        return getattr(self, cache_attr)

    def get_content(self, obj: TopicResource) -> str:
        return self._render(obj)["content"]

    def get_rendered_content_format(self, obj: TopicResource) -> str:
        return self._render(obj)["content_format"]
