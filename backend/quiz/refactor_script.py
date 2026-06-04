import re

with open('/Users/divyanshu/Desktop/ai_exam_engine/backend/quiz/api.py', 'r') as f:
    content = f.read()

# Replace throttles
content = re.sub(
    r"class AIHeavyThrottle\(UserRateThrottle\):\n    scope = 'ai_heavy'\n\nclass AILightThrottle\(UserRateThrottle\):\n    scope = 'ai_light'",
    "from .api_throttles import AIHeavyThrottle, AILightThrottle\nfrom .api_session import SessionMixin\nfrom .api_summary import SummaryMixin\nfrom .api_dashboard import DashboardMixin\nfrom .api_leaderboard import LeaderboardMixin\nfrom .api_upload import UploadMixin",
    content
)

# Replace class definition
content = content.replace(
    "class ExamViewSet(viewsets.ReadOnlyModelViewSet):",
    "class ExamViewSet(SessionMixin, SummaryMixin, DashboardMixin, LeaderboardMixin, UploadMixin, viewsets.ReadOnlyModelViewSet):"
)

# Function to remove a method block
def remove_method(content, method_name):
    pattern = r"(?: {4}@action[^\n]*\n)* {4}def " + method_name + r"\(.*?(?=\n {4}@|\n {4}def |\n\S|$)"
    return re.sub(pattern, "", content, flags=re.DOTALL)

methods_to_remove = [
    "parse_pdf",
    "progress",
    "summary",
    "update_session",
    "pause",
    "reset",
    "results",
    "dashboard_stats",
    "explain_question",
    "leaderboard"
]

for method in methods_to_remove:
    content = remove_method(content, method)

with open('/Users/divyanshu/Desktop/ai_exam_engine/backend/quiz/api.py', 'w') as f:
    f.write(content)
