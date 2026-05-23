import os
import json
from django.core.management.base import BaseCommand
from quiz.models import SubCategory, ExamRoadmap, RoadmapPhase, RoadmapTopic
from quiz.ai.gemini_client import GeminiClient
from django.conf import settings

class Command(BaseCommand):
    help = 'Generates a full syllabus roadmap for a given exam subcategory using Grok AI'

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

        self.stdout.write(self.style.SUCCESS(f'Generating Roadmap for "{subcategory.name}" using Grok...'))

        client = GeminiClient()

        prompt = f"""
        You are an expert curriculum designer for Indian competitive exams.
        Create a detailed, step-by-step study roadmap for the "{subcategory.name}" exam.
        Divide the syllabus into logical phases (e.g., Phase 1: Foundation, Phase 2: Core Subjects, Phase 3: Advanced/Mocks).
        For each phase, list the specific topics a student must study.
        Estimate the time in minutes needed to study each topic.
        Crucially, provide 2-3 real, high-quality learning resources (YouTube video links, official documentation, or reliable articles) for every topic. Use realistic URLs (e.g., https://youtube.com/...).

        Respond STRICTLY in valid JSON format matching this structure:
        {{
            "title": "Complete Roadmap for {subcategory.name}",
            "description": "A brief encouraging description.",
            "phases": [
                {{
                    "title": "Phase 1: Foundation",
                    "description": "Building the basics",
                    "topics": [
                        {{
                            "title": "Number System", 
                            "description": "Basic arithmetic concepts", 
                            "estimated_minutes": 120,
                            "resources": [
                                {{"title": "Number System Full Course", "type": "video", "url": "https://www.youtube.com/watch?v=..."}},
                                {{"title": "Maths Basics Tutorial", "type": "article", "url": "https://example.com/..."}}
                            ]
                        }}
                    ]
                }}
            ]
        }}
        """

        try:
            response = client.chat.completions.create(
                model="grok-2",
                messages=[
                    {"role": "system", "content": "You are a precise JSON-generating assistant."},
                    {"role": "user", "content": prompt},
                ],
            )
            
            output = response.choices[0].message.content.replace('```json', '').replace('```', '').strip()
            data = json.loads(output)

            # Create Database Records
            roadmap = ExamRoadmap.objects.create(
                subcategory=subcategory,
                title=data['title'],
                description=data.get('description', '')
            )

            for p_idx, phase_data in enumerate(data.get('phases', [])):
                phase = RoadmapPhase.objects.create(
                    roadmap=roadmap,
                    title=phase_data['title'],
                    description=phase_data.get('description', ''),
                    order=p_idx
                )
                
                for t_idx, topic_data in enumerate(phase_data.get('topics', [])):
                    RoadmapTopic.objects.create(
                        phase=phase,
                        title=topic_data['title'],
                        description=topic_data.get('description', ''),
                        estimated_minutes=topic_data.get('estimated_minutes', 60),
                        resources=topic_data.get('resources', []),
                        order=t_idx
                    )

            self.stdout.write(self.style.SUCCESS(f'Successfully generated and saved Roadmap for "{subcategory.name}"!'))

        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error during AI generation: {str(e)}"))
