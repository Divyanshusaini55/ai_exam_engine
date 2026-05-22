from django.contrib import admin
from .models import Profile, Badge, UserBadge, ContributorActivity, Solution, Comment, Notification


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display  = ['user', 'xp', 'reputation_score', 'community_rank', 'percentile', 'streak', 'total_solutions', 'total_upvotes_received']
    list_filter   = ['streak']
    search_fields = ['user__username', 'user__email']
    readonly_fields = ['community_rank', 'percentile', 'reputation_score', 'total_solutions', 'total_comments', 'total_upvotes_received', 'total_views']
    fieldsets = (
        ('User', {'fields': ('user', 'avatar_char', 'full_name', 'bio', 'show_profile_pic')}),
        ('Gamification', {'fields': ('xp', 'streak', 'best_streak', 'last_activity')}),
        ('Counters (auto-updated)', {'fields': ('total_solutions', 'total_comments', 'total_upvotes_received', 'total_views', 'uploads_approved', 'suggestions_approved', 'ai_verified_count'), 'classes': ('collapse',)}),
        ('Rankings (auto-computed)', {'fields': ('reputation_score', 'community_rank', 'percentile'), 'classes': ('collapse',)}),
    )


@admin.register(Badge)
class BadgeAdmin(admin.ModelAdmin):
    list_display  = ['name', 'slug', 'criteria_type', 'criteria_value', 'is_active']
    list_filter   = ['criteria_type', 'is_active']
    search_fields = ['name', 'slug']
    prepopulated_fields = {'slug': ('name',)}


@admin.register(UserBadge)
class UserBadgeAdmin(admin.ModelAdmin):
    list_display  = ['user', 'badge', 'awarded_at']
    list_filter   = ['badge']
    search_fields = ['user__username', 'badge__name']
    raw_id_fields = ['user', 'badge']


@admin.register(ContributorActivity)
class ContributorActivityAdmin(admin.ModelAdmin):
    list_display  = ['user', 'activity_type', 'description', 'created_at']
    list_filter   = ['activity_type']
    search_fields = ['user__username', 'description']
    readonly_fields = ['user', 'activity_type', 'description', 'metadata', 'created_at']

    def has_add_permission(self, request):
        return False  # Activities are auto-generated

    def has_change_permission(self, request, obj=None):
        return False  # Read-only log


@admin.register(Solution)
class SolutionAdmin(admin.ModelAdmin):
    list_display  = ['user', 'question', 'upvotes', 'views', 'is_ai_generated', 'created_at']
    list_filter   = ['is_ai_generated']
    search_fields = ['user__username']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display  = ['user', 'question', 'upvotes', 'created_at']
    search_fields = ['user__username', 'text']


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display  = ['user', 'type', 'title', 'is_read', 'created_at']
    list_filter   = ['type', 'is_read']
    search_fields = ['user__username', 'title']
