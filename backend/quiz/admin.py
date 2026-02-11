# from django.contrib import admin
# from .models import Exam, Question, Answer, UserAnswer
# from .ai import generate_questions_from_pdf


# @admin.action(description='Generate questions from PDF using AI')
# def generate_questions(modeladmin, request, queryset):
#     for exam in queryset:
#         if exam.pdf_file:
#             try:
#                 generate_questions_from_pdf(exam)
#                 modeladmin.message_user(request, f"Questions generated successfully for {exam.title}")
#             except Exception as e:
#                 modeladmin.message_user(request, f"Error generating questions for {exam.title}: {str(e)}", level='ERROR')


# class AnswerInline(admin.TabularInline):
#     model = Answer
#     extra = 1
#     fields = ('answer_text', 'is_correct', 'order')


# class QuestionInline(admin.StackedInline):
#     model = Question
#     extra = 0
#     fields = (
#         'question_text',
#         'image',           # 🔥 ADD
#         'is_image_based',  # 🔥 ADD
#         'question_type',
#         'order',
#         'points',
#     )
#     show_change_link = True



# @admin.register(Exam)
# class ExamAdmin(admin.ModelAdmin):
#     list_display = ('title', 'duration_minutes', 'total_questions', 'created_at', 'is_active')
#     list_filter = ('is_active', 'created_at')
#     search_fields = ('title', 'description')
#     fields = ('title', 'description', 'pdf_file', 'duration_minutes', 'total_questions', 'is_active')
#     inlines = [QuestionInline]
#     actions = [generate_questions]

#     def save_model(self, request, obj, form, change):
#         super().save_model(request, obj, form, change)
#         # Auto-generate questions if PDF is uploaded and no questions exist
#         if obj.pdf_file and not change:
#             try:
#                 generate_questions_from_pdf(obj)
#             except Exception as e:
#                 self.message_user(request, f"Error generating questions: {str(e)}", level='WARNING')


# @admin.register(Question)
# class QuestionAdmin(admin.ModelAdmin):
#     list_display = ('__str__', 'question_type', 'points', 'order')
#     list_filter = ('question_type', 'exam')
#     search_fields = ('question_text', 'exam__title')
#     ordering = ('exam', 'order')

#     fields = (
#         'exam',
#         'question_text',
#         'image',           # 🔥 ADD
#         'is_image_based',  # 🔥 ADD
#         'question_type',
#         'order',
#         'points',
#     )

#     inlines = [AnswerInline]



# @admin.register(Answer)
# class AnswerAdmin(admin.ModelAdmin):
#     list_display = ('__str__', 'question', 'is_correct', 'order')
#     list_filter = ('is_correct', 'question__exam')
#     search_fields = ('answer_text', 'question__question_text')


# @admin.register(UserAnswer)
# class UserAnswerAdmin(admin.ModelAdmin):
#     list_display = ('session_id', 'question', 'is_correct', 'answered_at')
#     list_filter = ('is_correct', 'answered_at', 'exam')
#     search_fields = ('session_id', 'question__question_text')
#     readonly_fields = ('answered_at',)


from django.contrib import admin
from .models import Exam, Question, Answer, UserAnswer, Category, SubCategory, ContactMessage
from .ai import generate_questions_from_pdf


@admin.action(description='Generate questions from PDF using AI')
def generate_questions(modeladmin, request, queryset):
    for exam in queryset:
        if exam.pdf_file:
            try:
                generate_questions_from_pdf(exam)
                modeladmin.message_user(request, f"Questions generated successfully for {exam.title}")
            except Exception as e:
                modeladmin.message_user(request, f"Error generating questions for {exam.title}: {str(e)}", level='ERROR')


class AnswerInline(admin.TabularInline):
    model = Answer
    extra = 1
    fields = ('answer_text', 'is_correct', 'order')


class QuestionInline(admin.StackedInline):
    model = Question
    extra = 0
    fields = (
        'question_text',
        'image',
        'is_image_based',
        'question_type',
        'order',
        'points',
    )
    show_change_link = True




# --- INLINES ---

class SubCategoryInline(admin.TabularInline):
    model = SubCategory
    extra = 1

class ExamInline(admin.TabularInline):
    model = Exam
    extra = 0
    fields = ('title', 'is_active', 'duration_minutes', 'total_questions')
    show_change_link = True 


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'order', 'is_active', 'subcategory_count', 'exam_count', 'created_at')
    list_editable = ('order', 'is_active')
    list_filter = ('is_active', 'created_at')
    search_fields = ('name', 'slug', 'description')
    prepopulated_fields = {'slug': ('name',)}
    readonly_fields = ('created_at', 'updated_at')
    
    fieldsets = (
        ('Basic Info', {
            'fields': ('name', 'slug', 'description')
        }),
        ('Display Settings', {
            'fields': ('icon', 'icon_color', 'bg_color', 'order')
        }),
        ('Status', {
            'fields': ('is_active',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    inlines = [SubCategoryInline]
    
    def subcategory_count(self, obj):
        return obj.subcategories.count()
    subcategory_count.short_description = 'Subcategories'
    
    def exam_count(self, obj):
        from .models import Exam
        return Exam.objects.filter(subcategory__category=obj).count()
    exam_count.short_description = 'Total Exams'

@admin.register(SubCategory)
class SubCategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'slug', 'order', 'is_active', 'exam_count', 'created_at')
    list_editable = ('order', 'is_active')
    list_filter = ('is_active', 'category', 'created_at')
    search_fields = ('name', 'slug', 'description')
    prepopulated_fields = {'slug': ('name',)}
    readonly_fields = ('created_at', 'updated_at')
    
    fieldsets = (
        ('Basic Info', {
            'fields': ('category', 'name', 'slug', 'description')
        }),
        ('Display Settings', {
            'fields': ('icon', 'order')
        }),
        ('Status', {
            'fields': ('is_active',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    inlines = [ExamInline]
    
    def exam_count(self, obj):
        return obj.exams.filter(is_active=True, status='published').count()
    exam_count.short_description = 'Published Exams'




@admin.register(Exam)
class ExamAdmin(admin.ModelAdmin):
    list_display = ('title', 'subcategory', 'year', 'shift', 'status', 'duration_minutes', 'total_questions', 'is_active', 'created_at')
    list_editable = ('status', 'is_active')
    list_filter = ('status', 'is_active', 'subcategory__category', 'subcategory', 'year', 'created_at')
    search_fields = ('title', 'description')
    
    fieldsets = (
        ('Categorization', {
            'fields': ('subcategory', 'status')
        }),
        ('Exam Details', {
            'fields': ('title', 'description', 'year', 'shift')
        }),
        ('Configuration', {
            'fields': ('duration_minutes', 'total_questions', 'marks_per_question', 'total_marks', 'pdf_file')
        }),
        ('Status', {
            'fields': ('is_active',)
        }),
    )
    
    inlines = [QuestionInline]
    actions = [generate_questions]

    def save_model(self, request, obj, form, change):
        import traceback
        import threading
        from .services import extract_questions_async

        try:
            super().save_model(request, obj, form, change)
            print(f"✅ Exam '{obj.title}' saved via admin.")
            
            # Auto-generate questions if PDF is uploaded and no questions exist (ASYNC)
            if obj.pdf_file and not change:
                print(f"🧵 Spawning background thread for Gemini extraction on Exam ID: {obj.id}")
                threading.Thread(
                    target=extract_questions_async,
                    args=(obj.id,),
                    daemon=True
                ).start()
                
        except Exception as e:
            print(f"❌ ADMIN SAVE ERROR for Exam '{obj.title}':", str(e))
            traceback.print_exc()
            raise e


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ('__str__', 'question_type', 'points', 'order')
    list_filter = ('question_type', 'exam')
    search_fields = ('question_text', 'exam__title')
    ordering = ('exam', 'order')

    fields = (
        'exam',
        'question_text',
        'image',
        'is_image_based',
        'question_type',
        'order',
        'points',
    )

    inlines = [AnswerInline]


@admin.register(Answer)
class AnswerAdmin(admin.ModelAdmin):
    list_display = ('__str__', 'question', 'is_correct', 'order')
    list_filter = ('is_correct', 'question__exam')
    search_fields = ('answer_text', 'question__question_text')


@admin.register(UserAnswer)
class UserAnswerAdmin(admin.ModelAdmin):
    list_display = ('session_id', 'question', 'is_correct', 'answered_at')
    list_filter = ('is_correct', 'answered_at', 'exam')
    search_fields = ('session_id', 'question__question_text')
    readonly_fields = ('answered_at',)


@admin.register(ContactMessage)
class ContactMessageAdmin(admin.ModelAdmin):
    """Admin interface for viewing and managing contact support messages"""
    list_display = ['name', 'email', 'status', 'created_at']
    list_filter = ['status', 'created_at']
    search_fields = ['name', 'email', 'message']
    readonly_fields = ['created_at']
    list_per_page = 50
    
    fieldsets = (
        ('Message Information', {
            'fields': ('name', 'email', 'message')
        }),
        ('Status', {
            'fields': ('status', 'created_at')
        }),
    )