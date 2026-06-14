import json
import os
from django.core.management.base import BaseCommand
from quiz.utils.json_importer import ExamJSONImporter

class Command(BaseCommand):
    help = 'Imports an exam from a detailed JSON file'

    def add_arguments(self, parser):
        parser.add_argument('json_file', type=str, help='Path to the JSON file')

    def handle(self, *args, **kwargs):
        json_file = kwargs['json_file']
        
        if not os.path.exists(json_file):
            self.stderr.write(self.style.ERROR(f'File not found: {json_file}'))
            return
            
        with open(json_file, 'r', encoding='utf-8') as f:
            try:
                data = json.load(f)
            except json.JSONDecodeError as e:
                self.stderr.write(self.style.ERROR(f'Invalid JSON format: {e}'))
                return
                
        self.stdout.write(self.style.NOTICE(f'Importing exam from {json_file}...'))
        
        success, message = ExamJSONImporter.import_from_json(data)
        
        if success:
            self.stdout.write(self.style.SUCCESS(message))
        else:
            self.stderr.write(self.style.ERROR(message))
