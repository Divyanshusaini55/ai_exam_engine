
from django.contrib import admin
from django.urls import path
from django.shortcuts import redirect
from django.utils.html import format_html
from django.db.models import TextField
from django.forms import Textarea
from .models import (
    Exam, Question, UserAnswer,
    Category, SubCategory,
    ContactMessage, QuestionPaperUpload, CorrectionSuggestion,
    CurrentAffair,
    ExamRoadmap, RoadmapPhase, RoadmapTopic, UserTopicProgress,
    ResourceTag, TopicResource, ResourceProgress, ResourceBookmark,
)
from .ai import parse_exam_paper_with_ai, generate_questions_from_pdf

def _status_badge(status):
    """Return a styled HTML pill badge for a given status string."""
    BADGE_MAP = {
        'published':  ('#15803D', '#DCFCE7'),
        'draft':      ('#475569', '#F1F5F9'),
        'archived':   ('#64748B', '#E2E8F0'),
        'pending':    ('#A16207', '#FEF9C3'),
        'approved':   ('#15803D', '#DCFCE7'),
        'rejected':   ('#B91C1C', '#FEE2E2'),
        'processed':  ('#7C3AED', '#EDE9FE'),
        'unread':     ('#D97706', '#FEF3C7'),
        'read':       ('#16A34A', '#F0FDF4'),
    }
    color, bg = BADGE_MAP.get(status, ('#475569', '#F1F5F9'))
    return format_html(
        '<span style="display:inline-block;padding:3px 10px;border-radius:9999px;'
        'font-size:11px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;'
        'background:{};color:{};">{}</span>',
        bg, color, status
    )


def _bool_badge(value, true_label='Active', false_label='Inactive'):
    if value:
        return format_html('<span style="color:#15803D;font-weight:700;font-size:12px;">✓ {}</span>', true_label)
    return format_html('<span style="color:#94A3B8;font-size:12px;">— {}</span>', false_label)


def _resource_type_badge(resource_type):
    """Coloured pill badge for resource type."""
    TYPE_COLORS = {
        'article':       ('#1D4ED8', '#DBEAFE'),
        'markdown_note': ('#6D28D9', '#EDE9FE'),
        'html_note':     ('#0F766E', '#CCFBF1'),
        'latex_note':    ('#B45309', '#FEF3C7'),
        'video':         ('#DC2626', '#FEE2E2'),
        'pdf':           ('#7C3AED', '#EDE9FE'),
        'external_link': ('#475569', '#F1F5F9'),
        'ai_note':       ('#0369A1', '#E0F2FE'),
        'formula_sheet': ('#15803D', '#DCFCE7'),
        'quiz':          ('#C2410C', '#FFEDD5'),
    }
    color, bg = TYPE_COLORS.get(resource_type, ('#475569', '#F1F5F9'))
    label = resource_type.replace('_', ' ').title()
    return format_html(
        '<span style="display:inline-block;padding:3px 8px;border-radius:6px;'
        'font-size:11px;font-weight:700;background:{};color:{};">{}</span>',
        bg, color, label
    )


@admin.action(description='Generate questions from PDF using AI')
def generate_questions(modeladmin, request, queryset):
    for exam in queryset:
        if exam.pdf_file:
            try:
                generate_questions_from_pdf(exam)
                modeladmin.message_user(request, f"Questions generated successfully for {exam.title}")
            except Exception as e:
                modeladmin.message_user(request, f"Error generating questions for {exam.title}: {str(e)}", level='ERROR')


@admin.action(description='🌐 Auto-Translate Missing Sections to Hindi (Bilingual)')
def auto_translate_to_hindi(modeladmin, request, queryset):
    from .ai import auto_translate_exam_to_hindi
    total_translated = 0
    for exam in queryset:
        try:
            count = auto_translate_exam_to_hindi(exam.id)
            total_translated += count
            modeladmin.message_user(request, f"Translated {count} questions to Hindi for '{exam.title}'.")
        except Exception as e:
            modeladmin.message_user(request, f"Error translating '{exam.title}': {e}", level='ERROR')


@admin.action(description='Publish selected resources')
def publish_resources(modeladmin, request, queryset):
    count = queryset.update(is_published=True)
    modeladmin.message_user(request, f"{count} resource(s) published successfully.")


@admin.action(description='⏸ Unpublish selected resources')
def unpublish_resources(modeladmin, request, queryset):
    count = queryset.update(is_published=False)
    modeladmin.message_user(request, f"{count} resource(s) unpublished.")


@admin.action(description='Mark selected as featured')
def feature_resources(modeladmin, request, queryset):
    count = queryset.update(is_featured=True)
    modeladmin.message_user(request, f"{count} resource(s) marked as featured.")


@admin.action(description='Generate AI Summary via Gemini')
def generate_ai_summary(modeladmin, request, queryset):
    import google.generativeai as genai
    import os

    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        modeladmin.message_user(request, "GEMINI_API_KEY not set in environment.", level='ERROR')
        return

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel('gemini-1.5-flash')

    for resource in queryset:
        content = resource.markdown_content or resource.html_content or resource.latex_content or resource.short_description
        if not content:
            continue
        try:
            prompt = (
                f"Summarize the following educational resource in 2-3 concise sentences suitable for "
                f"competitive exam preparation. Resource title: '{resource.title}'. "
                f"Content:\n\n{content[:3000]}"
            )
            response = model.generate_content(prompt)
            resource.ai_summary = response.text.strip()
            resource.is_ai_generated = True
            resource.save(update_fields=['ai_summary', 'is_ai_generated'])
        except Exception as e:
            modeladmin.message_user(request, f"Error for '{resource.title}': {e}", level='WARNING')

    modeladmin.message_user(request, "AI summaries generated for selected resources.")



class SubCategoryInline(admin.TabularInline):
    model = SubCategory
    extra = 1


class ExamInline(admin.TabularInline):
    model = Exam
    extra = 0
    fields = ('title', 'is_active', 'duration_minutes', 'total_questions')
    show_change_link = True


class RoadmapPhaseInline(admin.StackedInline):
    model = RoadmapPhase
    extra = 1


class RoadmapTopicInline(admin.TabularInline):
    model = RoadmapTopic
    extra = 3


class TopicResourceInline(admin.StackedInline):
    model = TopicResource
    extra = 1
    show_change_link = True

    formfield_overrides = {
        TextField: {
            'widget': Textarea(attrs={
                'rows': 10,
                'style': (
                    'font-family: "JetBrains Mono", "Fira Code", monospace;'
                    'font-size: 13px;'
                    'line-height: 1.6;'
                    'border: 1px solid #e2e8f0;'
                    'border-radius: 8px;'
                    'padding: 10px 12px;'
                    'background: #fafafa;'
                    'width: 100%;'
                    'resize: vertical;'
                )
            })
        }
    }

    fieldsets = (
        ('Identity', {
            'fields': ('title', 'short_description', 'tags'),
        }),
        ('Type & Format', {
            'fields': ('resource_type', 'content_format', 'external_url'),
        }),
        ('Content', {
            'description': 'Fill only the field that matches your Content Format above.',
            'fields': ('markdown_content', 'html_content', 'latex_content'),
            'classes': ('collapse',),
        }),
        ('Media & Metadata', {
            'fields': ('thumbnail', 'estimated_read_minutes', 'difficulty', 'order'),
            'classes': ('collapse',),
        }),
        ('AI & State', {
            'fields': ('is_published', 'is_featured', 'is_ai_generated', 'ai_summary'),
            'classes': ('collapse',),
        }),
    )

    readonly_fields = ('view_count',)


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'order', 'status_active', 'subcategory_count', 'exam_count', 'created_at')
    list_editable = ('order',)
    list_filter = ('is_active', 'created_at')
    search_fields = ('name', 'slug', 'description')
    prepopulated_fields = {'slug': ('name',)}
    readonly_fields = ('created_at', 'updated_at')

    fieldsets = (
        ('Basic Info', {'fields': ('name', 'slug', 'description')}),
        ('Display Settings', {'fields': ('icon', 'icon_color', 'bg_color', 'order')}),
        ('Status', {'fields': ('is_active',)}),
        ('Timestamps', {'fields': ('created_at', 'updated_at'), 'classes': ('collapse',)}),
    )
    inlines = [SubCategoryInline]

    def status_active(self, obj):
        return _bool_badge(obj.is_active)
    status_active.short_description = 'Active'

    def subcategory_count(self, obj):
        count = obj.subcategories.count()
        return format_html('<span style="font-weight:700;color:#111;">{}</span>', count)
    subcategory_count.short_description = 'Subcategories'

    def exam_count(self, obj):
        from .models import Exam
        count = Exam.objects.filter(subcategory__category=obj).count()
        return format_html('<span style="font-weight:700;color:#111;">{}</span>', count)
    exam_count.short_description = 'Exams'


@admin.action(description='Generate/Regenerate AI Roadmap (Celery)')
def trigger_roadmap_generation(modeladmin, request, queryset):
    from jobs.services import create_job
    from tasks.roadmap_tasks import generate_exam_roadmap
    from jobs.models import BackgroundJob
    
    triggered_count = 0
    for subcategory in queryset:
        active_job = BackgroundJob.objects.filter(
            type='ai.roadmap',
            payload__subcategory_id=subcategory.id,
            status__in=['QUEUED', 'RUNNING']
        ).exists()
        
        if not active_job:
            job = create_job(
                type='ai.roadmap',
                payload={'subcategory_id': subcategory.id},
                user=request.user if request.user.is_authenticated else None
            )
            generate_exam_roadmap.delay(str(job.id), subcategory.id)
            triggered_count += 1
            
    modeladmin.message_user(request, f"Queued AI roadmap generation task for {triggered_count} subcategories on the Celery worker.")


@admin.register(SubCategory)
class SubCategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'slug', 'order', 'status_active', 'exam_count', 'created_at')
    list_editable = ('order',)
    list_filter = ('is_active', 'category', 'created_at')
    search_fields = ('name', 'slug', 'description')
    prepopulated_fields = {'slug': ('name',)}
    readonly_fields = ('created_at', 'updated_at')

    fieldsets = (
        ('Basic Info', {'fields': ('category', 'name', 'slug', 'description', 'syllabus_pdf')}),
        ('Display Settings', {'fields': ('icon', 'order')}),
        ('Status', {'fields': ('is_active',)}),
        ('Timestamps', {'fields': ('created_at', 'updated_at'), 'classes': ('collapse',)}),
    )
    inlines = [ExamInline]
    actions = [trigger_roadmap_generation]

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        
        # Check if there is already an active job for this subcategory
        from jobs.models import BackgroundJob
        from jobs.services import create_job
        from tasks.roadmap_tasks import generate_exam_roadmap
        
        active_job = BackgroundJob.objects.filter(
            type='ai.roadmap',
            payload__subcategory_id=obj.id,
            status__in=['QUEUED', 'RUNNING']
        ).exists()
        
        if not active_job:
            job = create_job(
                type='ai.roadmap',
                payload={'subcategory_id': obj.id},
                user=request.user if request.user.is_authenticated else None
            )
            generate_exam_roadmap.delay(str(job.id), obj.id)
            self.message_user(request, f"Queued background AI task to generate syllabus roadmap for '{obj.name}' on the Celery worker.")

    def status_active(self, obj):
        return _bool_badge(obj.is_active)
    status_active.short_description = 'Active'

    def exam_count(self, obj):
        count = obj.exams.filter(is_active=True, status='published').count()
        return format_html('<span style="font-weight:700;color:#15803D;">{}</span>', count)
    exam_count.short_description = 'Published Exams'


@admin.register(Exam)
class ExamAdmin(admin.ModelAdmin):
    change_list_template = "admin/quiz_exam_changelist.html"
    
    list_display = ('title', 'subcategory', 'year', 'shift', 'status_badge', 'duration_minutes', 'total_questions', 'active_badge', 'created_at')
    list_editable = ()
    list_filter = ('status', 'is_active', 'subcategory__category', 'subcategory', 'year', 'created_at')
    search_fields = ('title', 'description')

    fieldsets = (
        ('Categorization', {'fields': ('subcategory', 'status')}),
        ('Exam Details', {'fields': ('title', 'description', 'year', 'shift')}),
        ('Configuration', {'fields': ('duration_minutes', 'total_questions', 'marks_per_question', 'negative_marks', 'total_marks', 'supported_languages', 'pdf_file')}),
        ('AI Summary', {'fields': ('ai_summary',), 'classes': ('collapse',)}),
        ('Status', {'fields': ('is_active',)}),
    )
    inlines = []
    actions = [generate_questions, auto_translate_to_hindi]

    def get_urls(self):
        from django.urls import path
        urls = super().get_urls()
        custom_urls = [
            path('import-json/', self.admin_site.admin_view(self.import_json_view), name='quiz_exam_import_json'),
        ]
        return custom_urls + urls

    def import_json_view(self, request):
        import json
        from django.shortcuts import render, redirect
        from django.contrib import messages
        from .utils.json_importer import ExamJSONImporter
        
        if request.method == 'POST':
            json_file = request.FILES.get('json_file')
            if not json_file:
                messages.error(request, 'Please select a file.')
                return redirect('..')
            
            try:
                data = json.load(json_file)
                success, msg = ExamJSONImporter.import_from_json(data)
                if success:
                    messages.success(request, msg)
                else:
                    messages.error(request, msg)
            except Exception as e:
                messages.error(request, f'Invalid JSON: {e}')
                
            return redirect('..')
            
        return render(request, 'admin/import_json.html', {'opts': self.model._meta})

    def status_badge(self, obj):
        return _status_badge(obj.status)
    status_badge.short_description = 'Status'

    def active_badge(self, obj):
        return _bool_badge(obj.is_active)
    active_badge.short_description = 'Live'

    def save_model(self, request, obj, form, change):
        import traceback
        import threading
        from .services import extract_questions_async

        try:
            super().save_model(request, obj, form, change)
            print(f"Exam '{obj.title}' saved via admin.")
            if obj.pdf_file and not change:
                print(f"Spawning background thread for Gemini extraction on Exam ID: {obj.id}")
                threading.Thread(
                    target=extract_questions_async,
                    args=(obj.id,),
                    daemon=True
                ).start()
        except Exception as e:
            print(f" ADMIN SAVE ERROR for Exam '{obj.title}':", str(e))
            traceback.print_exc()
            raise e


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ('id', 'question_stem_preview', 'language_badge', 'question_type', 'subject_name', 'verified', 'created_at')
    list_filter = ('question_type', 'origin', 'schema_version', 'verified', 'created_at')
    search_fields = ('id', 'topic')
    list_per_page = 50
    
    fieldsets = (
        ('Metadata', {'fields': ('id', 'question_type', 'origin', 'schema_version', 'verified', 'difficulty_score')}),
        ('Classification', {'fields': ('topic', 'tags')}),
        ('V2 Payload (JSONB)', {'fields': ('schema_payload',)}),
        ('Timestamps', {'fields': ('created_at', 'updated_at'), 'classes': ('collapse',)}),
    )
    readonly_fields = ('id', 'created_at', 'updated_at')

    def question_stem_preview(self, obj):
        payload = obj.schema_payload or {}
        text = payload.get('question_text') or (payload.get('content') or {}).get('text') or payload.get('question_text_hi') or ""
        if len(text) > 80:
            text = text[:80] + "..."
        return text or "—"
    question_stem_preview.short_description = "Question Stem"

    def language_badge(self, obj):
        payload = obj.schema_payload or {}
        has_hi = bool(payload.get('question_text_hi'))
        lang = (payload.get('metadata') or {}).get('language', 'en')
        if has_hi:
            return format_html('<span style="display:inline-block;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700;background:#E0E7FF;color:#3730A3;">EN + HI</span>')
        elif lang == 'hi':
            return format_html('<span style="display:inline-block;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700;background:#FEF3C7;color:#92400E;">HI</span>')
        return format_html('<span style="display:inline-block;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700;background:#F1F5F9;color:#475569;">EN</span>')
    language_badge.short_description = "Language"

    def subject_name(self, obj):
        payload = obj.schema_payload or {}
        return (payload.get('classification') or {}).get('subject') or payload.get('subject') or "General"
    subject_name.short_description = "Subject"



@admin.register(UserAnswer)
class UserAnswerAdmin(admin.ModelAdmin):
    list_display = ('session_id', 'question', 'is_correct', 'answered_at')
    list_filter = ('is_correct', 'answered_at', 'exam')
    search_fields = ('session_id', 'question__id')
    readonly_fields = ('answered_at',)


@admin.register(ContactMessage)
class ContactMessageAdmin(admin.ModelAdmin):
    list_display = ['name', 'email', 'status_badge', 'created_at']
    list_filter = ['status', 'created_at']
    search_fields = ['name', 'email', 'message']
    readonly_fields = ['created_at']
    list_per_page = 50
    fieldsets = (
        ('Message Information', {'fields': ('name', 'email', 'message')}),
        ('Status', {'fields': ('status', 'created_at')}),
    )

    def status_badge(self, obj):
        return _status_badge(obj.status)
    status_badge.short_description = 'Status'


@admin.register(QuestionPaperUpload)
class QuestionPaperUploadAdmin(admin.ModelAdmin):
    list_display = ('category', 'subject', 'exam_date', 'user', 'status_badge', 'created_at')
    list_filter = ('status', 'exam_date', 'created_at', 'category')
    search_fields = ('subject', 'category__name', 'user__username')
    readonly_fields = ('created_at', 'updated_at')

    fieldsets = (
        ('Submission Info', {'fields': ('user', 'category', 'subject', 'exam_date', 'file')}),
        ('Status & Review', {'fields': ('status', 'created_at', 'updated_at')}),
    )

    def status_badge(self, obj):
        return _status_badge(obj.status)
    status_badge.short_description = 'Status'


@admin.register(CorrectionSuggestion)
class CorrectionSuggestionAdmin(admin.ModelAdmin):
    list_display = ('question', 'type', 'user', 'status_badge', 'upvotes', 'created_at')
    list_filter = ('status', 'type', 'created_at')
    search_fields = ('question__id', 'user__username', 'note')
    readonly_fields = ('created_at',)

    fieldsets = (
        ('Reference', {'fields': ('user', 'question')}),
        ('Suggestion Details', {'fields': ('type', 'suggestion_data', 'note')}),
        ('Moderation', {'fields': ('status', 'upvotes', 'created_at')}),
    )
    actions = ['approve_suggestions', 'reject_suggestions']

    def status_badge(self, obj):
        return _status_badge(obj.status)
    status_badge.short_description = 'Status'

    def approve_suggestions(self, request, queryset):
        queryset.update(status='approved')
        self.message_user(request, "Selected suggestions marked as Approved.")
    approve_suggestions.short_description = "✓ Mark selected as Approved"

    def reject_suggestions(self, request, queryset):
        queryset.update(status='rejected')
        self.message_user(request, "Selected suggestions marked as Rejected.")
    reject_suggestions.short_description = "✗ Mark selected as Rejected"


@admin.register(CurrentAffair)
class CurrentAffairAdmin(admin.ModelAdmin):
    list_display = ('title', 'category', 'published_date', 'source_name')
    list_filter = ('category', 'published_date')
    search_fields = ('title', 'content', 'summary')
    readonly_fields = ('created_at', 'updated_at')
    prepopulated_fields = {'slug': ('title',)}


@admin.register(ExamRoadmap)
class ExamRoadmapAdmin(admin.ModelAdmin):
    list_display = ('title', 'subcategory', 'created_at')   
    search_fields = ('title', 'subcategory__name')
    inlines = [RoadmapPhaseInline]


@admin.register(RoadmapPhase)
class RoadmapPhaseAdmin(admin.ModelAdmin):
    list_display = ('title', 'roadmap', 'order')
    list_filter = ('roadmap',)
    search_fields = ('title',)
    inlines = [RoadmapTopicInline]


@admin.register(RoadmapTopic)
class RoadmapTopicAdmin(admin.ModelAdmin):
    list_display = ('title', 'phase', 'estimated_minutes', 'resource_count', 'order')
    list_filter = ('phase__roadmap', 'phase')
    search_fields = ('title',)
    inlines = [TopicResourceInline]

    filter_horizontal = ('prerequisites',)

    fieldsets = (
        ('Topic Info', {
            'fields': ('phase', 'title', 'description', 'estimated_minutes', 'order', 'prerequisites'),
        }),
        ('Legacy JSON Resources (deprecated — use inline editor below)', {
            'fields': ('resources',),
            'classes': ('collapse',),
            'description': (
                'This is the old raw JSON resource field. '
                'Use the Topic Resources inline editor below instead. '
                'This field is kept only for backward compatibility.'
            ),
        }),
    )

    def resource_count(self, obj):
        count = obj.topic_resources.filter(is_published=True).count()
        total = obj.topic_resources.count()
        if total == 0:
            return format_html('<span style="color:#94A3B8;font-size:12px;">— No resources</span>')
        return format_html(
            '<span style="font-weight:700;color:#15803D;">{}</span>'
            '<span style="color:#94A3B8;font-size:12px;"> / {} total</span>',
            count, total
        )
    resource_count.short_description = 'Published Resources'


@admin.register(UserTopicProgress)
class UserTopicProgressAdmin(admin.ModelAdmin):
    list_display = ('user', 'topic', 'status', 'completed_at')
    list_filter = ('status', 'topic__phase__roadmap')
    search_fields = ('user__username', 'topic__title')


@admin.register(ResourceTag)
class ResourceTagAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'color', 'resource_count')
    search_fields = ('name',)
    prepopulated_fields = {'slug': ('name',)}

    def resource_count(self, obj):
        count = obj.resources.count()
        return format_html('<span style="font-weight:700;">{}</span>', count)
    resource_count.short_description = 'Resources'


@admin.register(TopicResource)
class TopicResourceAdmin(admin.ModelAdmin):
    list_display = (
        'title_with_type', 'topic', 'difficulty_badge',
        'published_badge', 'featured_badge', 'ai_badge',
        'view_count', 'estimated_read_minutes', 'updated_at',
    )
    list_filter = (
        'resource_type', 'content_format', 'difficulty',
        'is_published', 'is_featured', 'is_ai_generated',
        'topic__phase__roadmap',
    )
    search_fields = ('title', 'short_description', 'markdown_content', 'ai_summary')
    readonly_fields = ('slug', 'view_count', 'created_at', 'updated_at')
    prepopulated_fields = {}  # slug is auto-generated in model.save()
    filter_horizontal = ('tags',)
    actions = [publish_resources, unpublish_resources, feature_resources, generate_ai_summary]
    list_per_page = 30

    formfield_overrides = {
        TextField: {
            'widget': Textarea(attrs={
                'rows': 14,
                'style': (
                    'font-family: "JetBrains Mono", "Fira Code", "Cascadia Code", monospace;'
                    'font-size: 13px;'
                    'line-height: 1.7;'
                    'border: 1px solid #e2e8f0;'
                    'border-radius: 8px;'
                    'padding: 12px 14px;'
                    'background: #fafafa;'
                    'width: 100%;'
                    'resize: vertical;'
                )
            })
        }
    }

    fieldsets = (
        ('Identity', {
            'fields': ('topic', 'title', 'slug', 'short_description', 'tags'),
        }),
        ('Type & Format', {
            'fields': ('resource_type', 'content_format', 'external_url'),
        }),
        ('Markdown Content', {
            'description': (
                'Write in Markdown. Supports <strong>GFM tables</strong>, '
                '<code>```python</code> fenced code blocks, '
                '<code>$$...$$</code> block equations (KaTeX), '
                '<code>$...$</code> inline equations, and <code>&gt; [!NOTE]</code> callouts.'
            ),
            'fields': ('markdown_content',),
        }),
        ('HTML Content', {
            'description': 'Raw HTML. Sanitized via DOMPurify on the frontend before rendering.',
            'fields': ('html_content',),
            'classes': ('collapse',),
        }),
        ('LaTeX Content', {
            'description': 'Pure LaTeX source for formula sheets. Rendered with KaTeX on the frontend.',
            'fields': ('latex_content',),
            'classes': ('collapse',),
        }),
        ('Media', {
            'fields': ('thumbnail',),
            'classes': ('collapse',),
        }),
        ('Metadata', {
            'fields': ('estimated_read_minutes', 'difficulty', 'order', 'created_by'),
        }),
        ('AI & State', {
            'fields': (
                'is_published', 'is_featured', 'is_ai_generated',
                'ai_summary',
            ),
        }),
        ('Analytics & Timestamps', {
            'fields': ('view_count', 'created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )

    def title_with_type(self, obj):
        return format_html(
            '{} <span style="margin-left:8px;">{}</span>',
            obj.title[:60] + ('…' if len(obj.title) > 60 else ''),
            _resource_type_badge(obj.resource_type),
        )
    title_with_type.short_description = 'Title'

    def difficulty_badge(self, obj):
        colors = {
            'beginner':     ('#15803D', '#DCFCE7'),
            'intermediate': ('#A16207', '#FEF9C3'),
            'advanced':     ('#B91C1C', '#FEE2E2'),
        }
        color, bg = colors.get(obj.difficulty, ('#475569', '#F1F5F9'))
        return format_html(
            '<span style="display:inline-block;padding:2px 8px;border-radius:6px;'
            'font-size:11px;font-weight:700;background:{};color:{};">{}</span>',
            bg, color, obj.get_difficulty_display()
        )
    difficulty_badge.short_description = 'Level'

    def published_badge(self, obj):
        return _bool_badge(obj.is_published, 'Published', 'Draft')
    published_badge.short_description = 'Published'

    def featured_badge(self, obj):
        if obj.is_featured:
            return format_html('<span style="color:#F59E0B;font-size:16px;" title="Featured">★</span>')
        return format_html('<span style="color:#E2E8F0;font-size:16px;">☆</span>')
    featured_badge.short_description = 'Featured'

    def ai_badge(self, obj):
        if obj.is_ai_generated:
            return format_html('<span style="color:#0369A1;font-weight:700;font-size:12px;">AI</span>')
        return format_html('<span style="color:#CBD5E1;font-size:12px;">—</span>')
    ai_badge.short_description = 'AI'

    def save_model(self, request, obj, form, change):
        if not obj.created_by_id:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(ResourceProgress)
class ResourceProgressAdmin(admin.ModelAdmin):
    list_display = ('user', 'resource', 'is_completed', 'last_viewed_at')
    list_filter = ('is_completed', 'last_viewed_at')
    search_fields = ('user__username', 'resource__title')
    readonly_fields = ('last_viewed_at',)


@admin.register(ResourceBookmark)
class ResourceBookmarkAdmin(admin.ModelAdmin):
    list_display = ('user', 'resource', 'bookmarked_at')
    list_filter = ('bookmarked_at',)
    search_fields = ('user__username', 'resource__title')
    readonly_fields = ('bookmarked_at',)
