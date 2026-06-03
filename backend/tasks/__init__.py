"""
tasks — Async task package for AI Exam Engine.

Auto-discovered by Celery via ``app.autodiscover_tasks(['tasks'])``.

Modules:
    tasks/
    ├── __init__.py            ← You are here
    ├── base.py                ← BaseTask + dedup lock helpers
    ├── summary_tasks.py       ← Exam summary generation
    ├── roadmap_tasks.py       ← Roadmap generation from PDF
    ├── pdf_tasks.py           ← PDF parsing and question extraction
    ├── analytics_tasks.py     ← Rank recalculation, leaderboard refresh
    └── notification_tasks.py  ← Email / push notifications

Convention:
    • All tasks are decorated with ``@shared_task(base=BaseTask, bind=True)``
    • First argument is always ``job_id`` (UUID str from BackgroundJob)
    • Tasks call ``start_job → update_progress → complete_job / fail_job``
    • Tasks must NOT contain business logic — they delegate to service layers
"""
