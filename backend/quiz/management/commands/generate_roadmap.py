import os
import json
from django.core.management.base import BaseCommand
from django.db import transaction
from quiz.models import SubCategory, ExamRoadmap, RoadmapPhase, RoadmapTopic
from quiz.ai.roadmap_engine import RoadmapEngine

class Command(BaseCommand):
    help = 'Generates a full syllabus roadmap for a given exam subcategory from a PDF syllabus or fallback AI'

    def add_arguments(self, parser):
        parser.add_argument('subcategory_slug', type=str, help='The slug of the SubCategory to generate for')

    def handle(self, *args, **options):
        slug = options['subcategory_slug']
        try:
            subcategory = SubCategory.objects.get(slug=slug)
        except SubCategory.DoesNotExist:
            self.stdout.write(self.style.ERROR(f'SubCategory with slug "{slug}" does not exist.'))
            return

        # Check if roadmap already exists
        if hasattr(subcategory, 'roadmap'):
            self.stdout.write(self.style.WARNING(f'Roadmap already exists for "{subcategory.name}". Delete it first if you want to regenerate.'))
            return

        engine = RoadmapEngine()
        syllabus_text = None

        # Stage 1 & 2: PDF Extraction and Cleaning (if syllabus_pdf is present)
        if subcategory.syllabus_pdf:
            self.stdout.write(self.style.SUCCESS(f'Extracting syllabus PDF for "{subcategory.name}"...'))
            try:
                pdf_path = subcategory.syllabus_pdf.path
                syllabus_text = engine.extract_and_clean_pdf(pdf_path)
                self.stdout.write(self.style.SUCCESS(f'Successfully extracted and cleaned {len(syllabus_text)} characters.'))
            except Exception as e:
                self.stdout.write(self.style.ERROR(f'PDF extraction failed: {e}. Falling back to general AI roadmap.'))
                syllabus_text = None

        if syllabus_text:
            self.stdout.write(self.style.SUCCESS(f'Running AI Syllabus Parser & Knowledge Graph Builder for "{subcategory.name}" from PDF...'))
        else:
            self.stdout.write(self.style.WARNING(f'No syllabus PDF uploaded for "{subcategory.name}". Running fallback roadmap generator...'))

        # Stage 3, 4, & 5: AI Syllabus parsing, dependency mapping, and enrichment
        try:
            data = engine.parse_syllabus(subcategory.name, syllabus_text)

            # Stage 6: Database Storage (with transactional integrity)
            with transaction.atomic():
                roadmap = ExamRoadmap.objects.create(
                    subcategory=subcategory,
                    title=data.get('title', f"Complete Roadmap for {subcategory.name}"),
                    description=data.get('description', '')
                )

                # Keep track of created topic instances to map prerequisites
                topic_instances = {}

                for p_idx, phase_data in enumerate(data.get('phases', [])):
                    phase = RoadmapPhase.objects.create(
                        roadmap=roadmap,
                        title=phase_data['title'],
                        description=phase_data.get('description', ''),
                        order=p_idx
                    )

                    for t_idx, topic_data in enumerate(phase_data.get('topics', [])):
                        topic_title = topic_data['title']
                        # Generate real search links instead of dead hallucinated URLs
                        generated_resources = [
                            {
                                "title": f"Search YouTube Tutorials for {topic_title}",
                                "type": "video",
                                "url": f"https://www.youtube.com/results?search_query={subcategory.name.replace(' ', '+')}+{topic_title.replace(' ', '+')}"
                            },
                            {
                                "title": f"Search Google Study Guides for {topic_title}",
                                "type": "article",
                                "url": f"https://www.google.com/search?q={subcategory.name.replace(' ', '+')}+{topic_title.replace(' ', '+')}"
                            }
                        ]

                        topic_obj = RoadmapTopic.objects.create(
                            phase=phase,
                            title=topic_title,
                            description=topic_data.get('description', ''),
                            estimated_minutes=topic_data.get('estimated_minutes', 60),
                            resources=generated_resources,
                            order=t_idx
                        )
                        # Normalize title key to lowercase for robust lookup
                        title_key = topic_data['title'].strip().lower()
                        topic_instances[title_key] = (topic_obj, topic_data.get('prerequisites', []))

                # Map Knowledge Graph Dependencies (prerequisites ManyToMany relation)
                prereq_count = 0
                for title_key, (topic_obj, prereq_titles) in topic_instances.items():
                    for prereq_title in prereq_titles:
                        prereq_key = prereq_title.strip().lower()
                        if prereq_key in topic_instances:
                            prereq_obj = topic_instances[prereq_key][0]
                            topic_obj.prerequisites.add(prereq_obj)
                            prereq_count += 1

                self.stdout.write(
                    self.style.SUCCESS(
                        f'Successfully generated and saved Roadmap for "{subcategory.name}"!\n'
                        f'Created {RoadmapPhase.objects.filter(roadmap=roadmap).count()} phases, '
                        f'{len(topic_instances)} topics, and mapped {prereq_count} knowledge graph dependencies.'
                    )
                )

        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Roadmap generation failed: {str(e)}"))
