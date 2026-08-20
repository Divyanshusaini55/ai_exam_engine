import re

with open('quiz/admin.py', 'r') as f:
    content = f.read()

# 1. Imports removal
content = re.sub(r'from \.models_translations import QuestionTranslation, AnswerTranslation\n', '', content)
content = re.sub(r'Exam, Question, Answer, UserAnswer,', 'Exam, Question, UserAnswer,', content)

# 2. Inlines removal (AnswerInlineForm, AnswerInline, QuestionTranslationInline, QuestionInline)
content = re.sub(r'class AnswerInlineForm\(.*?show_change_link = True\n\n', '', content, flags=re.DOTALL)
content = re.sub(r'from django import forms\n', '', content) # optional

# 3. Admin removal (QuestionAdmin, AnswerAdmin)
question_admin_replacement = """@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ('id', 'question_type', 'origin', 'schema_version', 'verified')
    list_filter = ('question_type', 'origin', 'schema_version', 'verified')
    search_fields = ('id',)
    
    fieldsets = (
        ('Metadata', {'fields': ('id', 'question_type', 'origin', 'schema_version', 'verified', 'difficulty_score')}),
        ('Relationships', {'fields': ('topic', 'tags')}),
        ('Payload', {'fields': ('schema_payload',)}),
    )
    readonly_fields = ('id', 'created_at', 'updated_at')

"""

# Regex for QuestionAdmin and its functions up to @admin.register(Answer)
content = re.sub(r'@admin\.register\(Question\)\nclass QuestionAdmin.*?formset\.save_m2m\(\)\n', question_admin_replacement, content, flags=re.DOTALL)

# Remove AnswerAdmin
content = re.sub(r'@admin\.register\(Answer\)\nclass AnswerAdmin\(.*?search_fields = \(\'answer_text\', \'question__question_text\'\)\n\n\n', '', content, flags=re.DOTALL)

# Fix UserAnswerAdmin
content = re.sub(r'search_fields = \(\'session_id\', \'question__question_text\'\)', "search_fields = ('session_id', 'question__id')", content)

# Fix CorrectionSuggestionAdmin search field
content = re.sub(r'search_fields = \(\'question__question_text\', \'user__username\', \'note\'\)', "search_fields = ('question__id', 'user__username', 'note')", content)

with open('quiz/admin.py', 'w') as f:
    f.write(content)
