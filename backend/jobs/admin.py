from django.contrib import admin
from django.utils.html import format_html

from .models import BackgroundJob, Status, Priority


def _status_badge(status):
    COLOURS = {
        Status.QUEUED:    ('#A16207', '#FEF9C3'),   # amber
        Status.RUNNING:   ('#1D4ED8', '#DBEAFE'),   # blue
        Status.COMPLETED: ('#15803D', '#DCFCE7'),   # green
        Status.FAILED:    ('#B91C1C', '#FEE2E2'),   # red
        Status.CANCELLED: ('#64748B', '#E2E8F0'),   # slate
    }
    fg, bg = COLOURS.get(status, ('#475569', '#F1F5F9'))
    return format_html(
        '<span style="display:inline-block;padding:3px 10px;border-radius:9999px;'
        'font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;'
        'background:{};color:{};">{}</span>',
        bg, fg, status,
    )


def _priority_badge(priority):
    COLOURS = {
        Priority.LOW:      ('#64748B', '#F1F5F9'),
        Priority.NORMAL:   ('#1D4ED8', '#DBEAFE'),
        Priority.HIGH:     ('#D97706', '#FEF3C7'),
        Priority.CRITICAL: ('#B91C1C', '#FEE2E2'),
    }
    fg, bg = COLOURS.get(priority, ('#475569', '#F1F5F9'))
    label = dict(Priority.choices).get(priority, str(priority))
    return format_html(
        '<span style="display:inline-block;padding:3px 10px;border-radius:9999px;'
        'font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;'
        'background:{};color:{};">{}</span>',
        bg, fg, label,
    )


def _progress_bar(progress):
    colour = '#15803D' if progress >= 100 else '#3B82F6'
    return format_html(
        '<div style="background:#E2E8F0;border-radius:6px;width:100px;height:14px;'
        'overflow:hidden;display:inline-block;vertical-align:middle;">'
        '<div style="background:{colour};height:100%;width:{pct}%;'
        'border-radius:6px;transition:width .3s;"></div></div>'
        ' <span style="font-size:11px;font-weight:700;color:#334155;">{pct}%</span>',
        colour=colour, pct=progress,
    )


@admin.register(BackgroundJob)
class BackgroundJobAdmin(admin.ModelAdmin):
    list_display = (
        'short_id',
        'type',
        'status_badge',
        'priority_badge',
        'user',
        'stage',
        'progress_bar',
        'retries',
        'created_at',
        'duration',
    )
    list_filter = ('status', 'type', 'priority')
    search_fields = ('id', 'type', 'user__username', 'stage')
    list_per_page = 50
    date_hierarchy = 'created_at'
    ordering = ('-created_at',)

    readonly_fields = (
        'id', 'payload', 'result', 'error',
        'created_at', 'started_at', 'completed_at',
        'retries',
    )

    fieldsets = (
        ('Identity', {
            'fields': ('id', 'type', 'priority', 'user'),
        }),
        ('Lifecycle', {
            'fields': ('status', 'stage', 'progress'),
        }),
        ('Data (read-only)', {
            'fields': ('payload', 'metadata', 'result', 'error'),
            'classes': ('collapse',),
        }),
        ('Timing', {
            'fields': ('retries', 'created_at', 'started_at', 'completed_at'),
            'classes': ('collapse',),
        }),
    )

    @admin.display(description='ID', ordering='id')
    def short_id(self, obj):
        return format_html(
            '<code style="font-size:12px;color:#475569;">{}</code>',
            str(obj.id)[:8],
        )

    @admin.display(description='Status', ordering='status')
    def status_badge(self, obj):
        return _status_badge(obj.status)

    @admin.display(description='Priority', ordering='priority')
    def priority_badge(self, obj):
        return _priority_badge(obj.priority)

    @admin.display(description='Progress', ordering='progress')
    def progress_bar(self, obj):
        return _progress_bar(obj.progress)

    @admin.display(description='Duration')
    def duration(self, obj):
        secs = obj.duration_seconds
        if secs is None:
            return format_html(
                '<span style="color:#94A3B8;font-size:12px;">—</span>'
            )
        if secs < 60:
            return f'{secs:.1f}s'
        return f'{secs / 60:.1f}m'
