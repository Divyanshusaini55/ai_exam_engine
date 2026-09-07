import os
import django
from dotenv import load_dotenv

load_dotenv()
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from quiz.ai.gemini_client import GeminiClient

project_id = os.getenv("GCP_PROJECT_ID")
location = os.getenv("GCP_LOCATION", "us-central1")

print(f"Checking Vertex AI configuration...")
print(f"  GCP_PROJECT_ID: {project_id or 'NOT SET'}")
print(f"  GCP_LOCATION:   {location}")

try:
    client = GeminiClient()
    print("Sending test generation prompt to Vertex AI...")
    response = client.generate_content("Hello! Are you working? Answer in 5 words.")
    print("SUCCESS: Vertex AI is active and working!")
    print(f"Response: {response.get('text', '')}")
    print(f"Model used: {response.get('model_used')}")
    print(f"Tokens: {response.get('tokens')}")
except Exception as e:
    print(f"FAILED: {e}")
