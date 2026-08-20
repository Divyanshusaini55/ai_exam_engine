import os
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    print("Error: GEMINI_API_KEY is not set in .env")
    exit(1)

genai.configure(api_key=api_key)

try:
    print(f"Checking API with key starting with {api_key[:5]}...")
    model = genai.GenerativeModel("gemini-2.5-flash")
    response = model.generate_content("Hello! Are you working?")
    print("SUCCESS: API is active and working!")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"FAILED: {e}")
