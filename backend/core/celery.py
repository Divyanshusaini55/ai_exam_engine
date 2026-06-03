import os

from celery import Celery
from celery.schedules import crontab
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

app = Celery('core')

# Namespace='CELERY' means all Celery-related settings in settings.py
# must be prefixed with 'CELERY_' (e.g. CELERY_BROKER_URL).
app.config_from_object('django.conf:settings', namespace='CELERY')

# ──────────────────────────────────────────────────────────────────────
# 2. Auto-discover tasks in every installed app and in the top-level
#    `tasks` package.  Celery will look for a `tasks.py` (or `tasks/`
#    package) in each app listed in INSTALLED_APPS.
# ──────────────────────────────────────────────────────────────────────
app.autodiscover_tasks()

# Also explicitly register the top-level tasks/ package so Celery
# finds tasks defined there even though it is not an INSTALLED_APP.
# app.autodiscover_tasks(['tasks'])
app.autodiscover_tasks([
    'tasks.summary_tasks',
    'tasks.roadmap_tasks',
    'tasks.pdf_tasks',
    'tasks.analytics_tasks',
    'tasks.notification_tasks',
])
# ──────────────────────────────────────────────────────────────────────
# 3. Celery Beat — periodic task schedule
#    Add periodic tasks here.  Workers are NOT implemented yet;
#    these entries serve as the schedule skeleton.
# ──────────────────────────────────────────────────────────────────────
app.conf.beat_schedule = {
    'fetch-current-affairs-daily': {
        'task': 'tasks.analytics_tasks.fetch_current_affairs',
        'schedule': crontab(hour=6, minute=0),
        'options': {'queue': 'maintenance'}
    },
    'cleanup-stale-jobs-hourly': {
        'task': 'tasks.analytics_tasks.cleanup_stale_jobs',
        'schedule': crontab(minute=0),
        'options': {'queue': 'maintenance'}
    },
    'refresh-leaderboard-cache': {
        'task': 'tasks.analytics_tasks.refresh_leaderboard_cache',
        'schedule': crontab(minute='*/10'),
        'options': {'queue': 'low'}
    },
}

@app.task(bind=True, ignore_result=False, name='core.debug_task')
def debug_task(self):
    """Lightweight task used only for health-check probes."""
    return {
        'status': 'ok',
        'worker': self.request.hostname,
    }
