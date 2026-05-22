from __future__ import annotations

from rest_framework import serializers

from quiz.models import (
    ResourceBookmark,
    ResourceProgress,
    ResourceTag,
    TopicResource,
)
from resources.renderers import get_renderable_content


# ─── 1. ResourceTagSerializer ──────────────────────────────────────────────────

class ResourceTagSerializer(serializers.ModelSerializer):
    """Lightweight serializer for resource tags used in nested contexts."""

    class Meta:
        model = ResourceTag
        fields = ["id", "name", "slug", "color"]


# ─── 2. TopicResourceListSerializer ───────────────────────────────────────────

class TopicResourceListSerializer(serializers.ModelSerializer):
    """
    Serializer for resource list / card views.

    Per-user boolean fields (``is_completed``, ``is_bookmarked``) are derived
    from the request user so that unauthenticated callers always receive
    ``False`` without raising an error.

    Raw content fields (``markdown_content``, ``html_content``,
    ``latex_content``) are intentionally excluded.
    """

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

    # ── helpers ───────────────────────────────────────────────────────────────

    def _get_user(self):
        """Return the authenticated user from request context, or None."""
        request = self.context.get("request")
        if request and hasattr(request, "user") and request.user.is_authenticated:
            return request.user
        return None

    # ── SerializerMethodFields ────────────────────────────────────────────────

    def get_is_completed(self, obj: TopicResource) -> bool:
        """
        Return ``True`` if the current user has a completed ``ResourceProgress``
        record for this resource.  Returns ``False`` for anonymous users.
        """
        user = self._get_user()
        if user is None:
            return False
        return ResourceProgress.objects.filter(
            user=user,
            resource=obj,
            is_completed=True,
        ).exists()

    def get_is_bookmarked(self, obj: TopicResource) -> bool:
        """
        Return ``True`` if the current user has bookmarked this resource.
        Returns ``False`` for anonymous users.
        """
        user = self._get_user()
        if user is None:
            return False
        return ResourceBookmark.objects.filter(
            user=user,
            resource=obj,
        ).exists()


# ─── 3. TopicResourceDetailSerializer ─────────────────────────────────────────

class TopicResourceDetailSerializer(TopicResourceListSerializer):
    """
    Full serializer for the single-resource reader / detail view.

    Extends ``TopicResourceListSerializer`` and adds:
    - ``ai_summary``, ``is_published``, ``order``, ``created_at``,
      ``updated_at``
    - ``content``                – rendered, sanitised content string
    - ``rendered_content_format`` – the format of the rendered content
      (``'html'``, ``'markdown'``, ``'url'``, or ``'plaintext'``)

    Raw source fields (``markdown_content``, ``html_content``,
    ``latex_content``) are **never** exposed by this serializer.
    """

    content = serializers.SerializerMethodField()
    rendered_content_format = serializers.SerializerMethodField()

    class Meta(TopicResourceListSerializer.Meta):
        fields = TopicResourceListSerializer.Meta.fields + [
            "ai_summary",
            "is_published",
            "order",
            "created_at",
            "updated_at",
            # Rendered content – replaces the raw source fields
            "content",
            "rendered_content_format",
        ]

    # ── rendering helpers ─────────────────────────────────────────────────────

    def _render(self, obj: TopicResource) -> dict:
        """
        Call ``get_renderable_content()`` once and cache the result on the
        serializer instance so both ``get_content`` and
        ``get_rendered_content_format`` share a single invocation.
        """
        cache_attr = f"_rendered_{obj.pk}"
        if not hasattr(self, cache_attr):
            try:
                result = get_renderable_content(obj)
            except Exception:
                # Graceful degradation: surface a safe error message rather
                # than a 500 if e.g. pandoc is unavailable at runtime.
                result = {
                    "content": (
                        "⚠ Content could not be rendered. "
                        "Please try again later."
                    ),
                    "content_format": "plaintext",
                }
            setattr(self, cache_attr, result)
        return getattr(self, cache_attr)

    # ── SerializerMethodFields ────────────────────────────────────────────────

    def get_content(self, obj: TopicResource) -> str:
        """Return the rendered (and sanitised) content string."""
        return self._render(obj)["content"]

    def get_rendered_content_format(self, obj: TopicResource) -> str:
        """
        Return the effective format of ``content`` after rendering.

        Possible values: ``'html'``, ``'markdown'``, ``'url'``,
        ``'plaintext'``.
        """
        return self._render(obj)["content_format"]
