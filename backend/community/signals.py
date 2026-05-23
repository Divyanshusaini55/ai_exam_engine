from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth.models import User
from .models import Profile, Solution, Comment, ContributorActivity


# ─── Auto-create Profile ──────────────────────────────────────────────────────
@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        avatar_char = instance.username[0].upper() if instance.username else 'U'
        Profile.objects.create(user=instance, avatar_char=avatar_char)


@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    if hasattr(instance, 'profile'):
        instance.profile.save()


# ─── Solution ─────────────────────────────────────────────────────────────────
@receiver(post_save, sender=Solution)
def on_solution_saved(sender, instance, created, **kwargs):
    if not created:
        return
    from .services import award_xp, update_streak

    profile, _ = Profile.objects.get_or_create(user=instance.user)
    profile.total_solutions = Solution.objects.filter(user=instance.user).count()
    profile.save(update_fields=['total_solutions'])

    award_xp(instance.user, 10, 'Solution posted')
    update_streak(instance.user)

    try:
        exam_title = instance.question.exam.title
        q_id = instance.question.id
    except Exception:
        exam_title, q_id = 'Unknown Exam', None

    ContributorActivity.objects.create(
        user=instance.user,
        activity_type='SOLUTION',
        description=f'{instance.user.username} posted a solution for Q{q_id} in {exam_title}',
        metadata={'question_id': q_id, 'exam_title': exam_title},
    )


# ─── Comment ──────────────────────────────────────────────────────────────────
@receiver(post_save, sender=Comment)
def on_comment_saved(sender, instance, created, **kwargs):
    if not created:
        return
    from .services import award_xp, update_streak

    profile, _ = Profile.objects.get_or_create(user=instance.user)
    profile.total_comments = Comment.objects.filter(user=instance.user).count()
    profile.save(update_fields=['total_comments'])

    award_xp(instance.user, 5, 'Comment posted')
    update_streak(instance.user)

    ContributorActivity.objects.create(
        user=instance.user,
        activity_type='COMMENT',
        description=f'{instance.user.username} joined a discussion',
        metadata={'comment_id': instance.id},
    )


# ─── QuestionPaperUpload ──────────────────────────────────────────────────────
def connect_upload_signal():
    from quiz.models import QuestionPaperUpload

    @receiver(post_save, sender=QuestionPaperUpload, weak=False)
    def on_upload_saved(sender, instance, created, **kwargs):
        if instance.status != 'approved' or not instance.user:
            return
        from .services import award_xp, update_streak

        profile, _ = Profile.objects.get_or_create(user=instance.user)
        # Recount to avoid double-counting
        from quiz.models import QuestionPaperUpload as QPU
        profile.uploads_approved = QPU.objects.filter(
            user=instance.user, status='approved'
        ).count()
        profile.save(update_fields=['uploads_approved'])

        award_xp(instance.user, 50, 'Question paper approved')
        update_streak(instance.user)

        ContributorActivity.objects.create(
            user=instance.user,
            activity_type='UPLOAD',
            description=f'{instance.user.username} had a question paper approved for {instance.exam.title}',
            metadata={'exam_id': instance.exam_id, 'upload_id': instance.id},
        )


# ─── CorrectionSuggestion ─────────────────────────────────────────────────────
def connect_suggestion_signal():
    from quiz.models import CorrectionSuggestion

    @receiver(post_save, sender=CorrectionSuggestion, weak=False)
    def on_suggestion_saved(sender, instance, created, **kwargs):
        if instance.status != 'approved':
            return
        from .services import award_xp, update_streak
        from quiz.models import CorrectionSuggestion as CS

        profile, _ = Profile.objects.get_or_create(user=instance.user)
        profile.suggestions_approved = CS.objects.filter(
            user=instance.user, status='approved'
        ).count()
        profile.save(update_fields=['suggestions_approved'])

        award_xp(instance.user, 20, 'Correction suggestion approved')
        update_streak(instance.user)

        ContributorActivity.objects.create(
            user=instance.user,
            activity_type='SUGGESTION',
            description=f'{instance.user.username} had a correction approved for Q{instance.question_id}',
            metadata={'question_id': instance.question_id, 'suggestion_id': instance.id},
        )


# ─── ExamAttempt ──────────────────────────────────────────────────────────────
def connect_exam_result_signal():
    from quiz.models import ExamAttempt

    @receiver(post_save, sender=ExamAttempt, weak=False)
    def on_exam_result_saved(sender, instance, created, **kwargs):
        if not instance.is_completed or not instance.user:
            return
            
        # Avoid duplicate runs by checking for existing activity matching this attempt
        from .models import ContributorActivity
        if ContributorActivity.objects.filter(
            user=instance.user,
            activity_type='EXAM',
            metadata__attempt_id=instance.id
        ).exists():
            return
            
        from .services import award_xp, update_streak

        award_xp(instance.user, 2, 'Mock test completed')
        update_streak(instance.user)

        ContributorActivity.objects.create(
            user=instance.user,
            activity_type='EXAM',
            description=f'{instance.user.username} completed {instance.exam.title} with {round(instance.percentage, 1)}%',
            metadata={
                'exam_id': instance.exam_id,
                'exam_title': instance.exam.title,
                'percentage': instance.percentage,
                'attempt_id': instance.id,
            },
        )


# ─── UserTopicProgress ────────────────────────────────────────────────────────
def connect_topic_progress_signal():
    from quiz.models import UserTopicProgress

    @receiver(post_save, sender=UserTopicProgress, weak=False)
    def on_topic_progress_saved(sender, instance, **kwargs):
        if instance.status != 'done':
            return
        from .services import award_xp, update_streak

        award_xp(instance.user, 1, f'Completed roadmap topic: {instance.topic.title}')
        update_streak(instance.user)

        ContributorActivity.objects.create(
            user=instance.user,
            activity_type='ROADMAP',
            description=f'{instance.user.username} completed roadmap topic "{instance.topic.title}"',
            metadata={'topic_id': instance.topic_id, 'topic_title': instance.topic.title},
        )
