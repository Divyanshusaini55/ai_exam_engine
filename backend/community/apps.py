from django.apps import AppConfig


class CommunityConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'community'

    def ready(self):
        import community.signals  # noqa: F401 — auto-creates profile on User save
        # Connect cross-app signals (quiz models → community XP)
        from community.signals import (
            connect_upload_signal,
            connect_suggestion_signal,
            connect_exam_result_signal,
            connect_topic_progress_signal,
        )
        connect_upload_signal()
        connect_suggestion_signal()
        connect_exam_result_signal()
        connect_topic_progress_signal()
