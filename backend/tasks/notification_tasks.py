import logging
import traceback

from celery import shared_task
from celery.exceptions import SoftTimeLimitExceeded

from jobs.services import (
    start_job, update_progress, complete_job, fail_job,
)
from tasks.base import BaseTask, acquire_job_lock, release_job_lock

from django.contrib.auth.models import User
from django.core.mail import send_mail, send_mass_mail
from django.conf import settings
from django.template.loader import render_to_string

logger = logging.getLogger('tasks')


@shared_task(
    base=BaseTask,
    bind=True,
    name='tasks.notification_tasks.send_email_notification',
    max_retries=3,
    default_retry_delay=30,
    time_limit=60,            # Emails should be fast
    soft_time_limit=45,
    acks_late=True,
    reject_on_worker_lost=True,
)
def send_email_notification(self, job_id, user_id, template_key,
                            context=None, dedup_key=None):
    dedup_key = dedup_key or f'{user_id}:{template_key}'
    lock_key = None

    try:
        lock_key = acquire_job_lock(self.name, dedup_key, job_id, ttl=120)
        start_job(job_id)
        update_progress(job_id, stage='preparing', progress=20,
                        message='Loading user profile and email template')

        user = User.objects.get(pk=user_id)
        update_progress(job_id, stage='sending', progress=60,
                        message='Sending email via configured backend')

        send_mail(
            subject=f"Notification: {template_key}",
            message=f"Hello {user.username},\n\nThis is a notification for {template_key}.\n\n{context}",
            from_email=settings.DEFAULT_FROM_EMAIL if hasattr(settings, 'DEFAULT_FROM_EMAIL') else 'noreply@aspirantai.com',
            recipient_list=[user.email],
            fail_silently=False,
        )
        update_progress(job_id, stage='confirming', progress=90,
                        message='Confirming delivery')

        complete_job(job_id, result={
            'user_id': user_id,
            'template_key': template_key,
            'sent_to': user.email,
            'status': 'sent',
        })

    except SoftTimeLimitExceeded:
        fail_job(job_id, error=f'Task timed out after {self.soft_time_limit}s')

    except self.MaxRetriesExceededError:
        fail_job(job_id, error='Max retries exhausted for email notification')

    except Exception as exc:
        logger.exception('send_email_notification failed for user %s', user_id)
        if self.request.retries < self.max_retries:
            fail_job(job_id, error=traceback.format_exc())
            raise self.retry(exc=exc, countdown=30 * (2 ** self.request.retries))
        else:
            fail_job(job_id, error=traceback.format_exc())

    finally:
        release_job_lock(lock_key)


@shared_task(
    base=BaseTask,
    bind=True,
    name='tasks.notification_tasks.send_bulk_notification',
    max_retries=2,
    default_retry_delay=60,
    time_limit=300,
    soft_time_limit=270,
    acks_late=True,
    reject_on_worker_lost=True,
)
def send_bulk_notification(self, job_id, user_ids, template_key,
                           context=None, dedup_key=None):
    dedup_key = dedup_key or f'{template_key}:batch'
    lock_key = None

    try:
        lock_key = acquire_job_lock(self.name, dedup_key, job_id, ttl=360)
        start_job(job_id)
        update_progress(job_id, stage='preparing_batch', progress=10,
                        message=f'Preparing batch for {len(user_ids)} users')

        users = User.objects.filter(pk__in=user_ids)
        messages = []
        for user in users:
            messages.append((
                f"Notification: {template_key}",
                f"Hello {user.username},\n\nThis is a bulk notification for {template_key}.\n\n{context}",
                settings.DEFAULT_FROM_EMAIL if hasattr(settings, 'DEFAULT_FROM_EMAIL') else 'noreply@aspirantai.com',
                [user.email],
            ))

        update_progress(job_id, stage='sending', progress=50,
                        message='Sending notifications')

        sent_count = send_mass_mail(messages, fail_silently=True)
        update_progress(job_id, stage='reporting', progress=95,
                        message='Compiling delivery report')

        failed = len(user_ids) - sent_count

        complete_job(job_id, result={
            'template_key': template_key,
            'sent': sent_count,
            'failed': failed,
            'status': 'batch_sent',
        })

    except SoftTimeLimitExceeded:
        fail_job(job_id, error=f'Task timed out after {self.soft_time_limit}s')

    except self.MaxRetriesExceededError:
        fail_job(job_id, error='Max retries exhausted for bulk notification')

    except Exception as exc:
        logger.exception('send_bulk_notification failed for template %s', template_key)
        if self.request.retries < self.max_retries:
            fail_job(job_id, error=traceback.format_exc())
            raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))
        else:
            fail_job(job_id, error=traceback.format_exc())

    finally:
        release_job_lock(lock_key)
