from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.db.models import Count, Sum


class Command(BaseCommand):
    help = 'Recalculate all contributor stats from historical data and seed default badges'

    def handle(self, *args, **options):
        from community.models import Profile, Solution, Comment
        from community.services import (
            recalculate_reputation, recalculate_ranks,
            check_and_award_badges, seed_default_badges,
        )
        from quiz.models import QuestionPaperUpload, CorrectionSuggestion

        # 1. Seed default badges
        self.stdout.write('Seeding default badges...')
        seed_default_badges()
        self.stdout.write(self.style.SUCCESS('  ✓ Badges seeded'))

        users = User.objects.all()
        total = users.count()
        self.stdout.write(f'Processing {total} users...')

        for i, user in enumerate(users, 1):
            profile, _ = Profile.objects.get_or_create(user=user)

            # Denormalized counters
            profile.total_solutions = Solution.objects.filter(user=user).count()
            profile.total_comments  = Comment.objects.filter(user=user).count()
            profile.total_upvotes_received = (
                Solution.objects.filter(user=user).aggregate(t=Sum('upvotes'))['t'] or 0
            )
            profile.total_views = (
                Solution.objects.filter(user=user).aggregate(t=Sum('views'))['t'] or 0
            )
            profile.uploads_approved = QuestionPaperUpload.objects.filter(
                user=user, status='approved'
            ).count()
            profile.suggestions_approved = CorrectionSuggestion.objects.filter(
                user=user, status='approved'
            ).count()

            # Recompute XP from scratch based on contributions
            xp  = profile.total_solutions          * 10
            xp += profile.total_comments           * 5
            xp += profile.total_upvotes_received   * 3
            xp += profile.uploads_approved         * 50
            xp += profile.suggestions_approved     * 20
            # Exam results
            from quiz.models import ExamAttempt, UserTopicProgress
            xp += ExamAttempt.objects.filter(user=user, is_completed=True).count() * 2
            xp += UserTopicProgress.objects.filter(user=user, status='done').count() * 1
            profile.xp = xp

            profile.save()
            recalculate_reputation(user)

            if i % 10 == 0 or i == total:
                self.stdout.write(f'  {i}/{total} users processed')

        # Bulk rank update
        self.stdout.write('Recalculating global ranks...')
        recalculate_ranks()

        # Award badges
        self.stdout.write('Checking and awarding badges...')
        for user in users:
            check_and_award_badges(user)

        self.stdout.write(self.style.SUCCESS(
            f'\n✅ Done! Processed {total} users, ranks updated, badges awarded.'
        ))
