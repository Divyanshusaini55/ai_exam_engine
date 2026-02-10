
import os
import django
import sys
import google.generativeai as genai

# Setup Django environment
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from django.conf import settings

def test_gemini():
    api_key = settings.GEMINI_API_KEY
    print(f"🔑 Checking API Key: {'Found' if api_key else 'MISSING'}")
    
    if not api_key:
        print("❌ Error: GEMINI_API_KEY is not set.")
        return

    try:
        print("🚀 Initializing Gemini...")
        genai.configure(api_key=api_key)
        
        # Valid model from previous list
        model_name = "models/gemini-pro-latest" 
        print(f"\n📡 Attempting with '{model_name}'...")
        
        model = genai.GenerativeModel(model_name)
        response = model.generate_content("Explain 'Hello World' in 5 words.")
        
        print("\n✅ API Call Successful!")
        print(f"📝 Response: {response.text}")
        
    except Exception as e:
        print(f"\n❌ API Call Failed!")
        print(f"Error Details: {str(e)}")

if __name__ == "__main__":
    test_gemini()
