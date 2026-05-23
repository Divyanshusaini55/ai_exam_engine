from django.core.management.base import BaseCommand, CommandError
from quiz.models import Exam
from quiz.ai.summary_service import ExamSummaryService

class Command(BaseCommand):
    help = 'Generates or updates AI summaries for exams using the Exam Intelligence Engine'

    def add_arguments(self, parser):
        parser.add_argument(
            'exam_id', 
            type=int, 
            nargs='?', 
            help='The ID of the Exam to generate a summary for'
        )
        parser.add_argument(
            '--force', 
            action='store_true', 
            help='Force overwrite/regenerate the summary for the specified exam_id'
        )
        parser.add_argument(
            '--all', 
            action='store_true', 
            help='Generate summaries for all published active exams'
        )
        parser.add_argument(
            '--pending', 
            action='store_true', 
            help='Generate summaries only for published active exams without any summary'
        )
        parser.add_argument(
            '--regenerate', 
            action='store_true', 
            help='Regenerate summaries for all published active exams (overwriting existing)'
        )

    def handle(self, *args, **options):
        exam_id = options['exam_id']
        force = options['force']
        process_all = options['all']
        process_pending = options['pending']
        regenerate_all = options['regenerate']

        # Determine target queryset
        exams = Exam.objects.filter(is_active=True, status='published')

        if exam_id is not None:
            # Single exam requested
            exams = exams.filter(id=exam_id)
            if not exams.exists():
                self.stdout.write(self.style.WARNING(f'No active, published exam with ID {exam_id} was found.'))
                # Fallback to check if it exists at all
                if not Exam.objects.filter(id=exam_id).exists():
                    raise CommandError(f'Exam with ID "{exam_id}" does not exist.')
                self.stdout.write(self.style.WARNING(f'Exam with ID {exam_id} exists but is not active or published.'))
                # Still allow single target if force is used or explicitly requested
                exams = Exam.objects.filter(id=exam_id)
            
            # For a single exam, overwrite is true if --force is provided
            overwrite = force
        else:
            # Multi-exam execution based on flags
            if process_all:
                overwrite = False
                self.stdout.write(self.style.SUCCESS('Processing all published active exams...'))
            elif process_pending:
                overwrite = False
                # Filter to only exams with blank/null ai_summary
                exams = exams.filter(ai_summary__isnull=True) | exams.filter(ai_summary='')
                self.stdout.write(self.style.SUCCESS('Processing pending published active exams...'))
            elif regenerate_all:
                overwrite = True
                self.stdout.write(self.style.SUCCESS('Regenerating summaries for all published active exams...'))
            else:
                self.print_help('manage.py', 'generate_exam_summary')
                raise CommandError('Please specify an exam_id, --all, --pending, or --regenerate.')

        count = exams.count()
        if count == 0:
            self.stdout.write(self.style.SUCCESS('No exams match the selection criteria. Done.'))
            return

        self.stdout.write(self.style.SUCCESS(f'Found {count} exam(s) to process.'))
        service = ExamSummaryService()

        success_count = 0
        failure_count = 0

        for idx, exam in enumerate(exams):
            self.stdout.write(f"[{idx + 1}/{count}] Processing: {exam.title} (ID: {exam.id})...")
            try:
                # Call modular service
                service.generate_summary(exam, force=overwrite)
                self.stdout.write(self.style.SUCCESS(f"Successfully processed summary for exam {exam.id}"))
                success_count += 1
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"Failed to process summary for exam {exam.id}: {str(e)}"))
                failure_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"\nExecution finished! Success: {success_count}, Failures: {failure_count}"
            )
        )
