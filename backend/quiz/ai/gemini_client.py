import os
import time
import logging
from django.conf import settings
import google.generativeai as genai
from google.api_core.exceptions import GoogleAPIError, ResourceExhausted

logger = logging.getLogger('quiz.ai.gemini_client')

class GeminiClient:
    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY is not set in settings.")
        genai.configure(api_key=self.api_key)
        
        self.primary_model = getattr(settings, 'GEMINI_SUMMARY_MODEL', 'models/gemini-2.5-flash')
        # Fallbacks
        self.fallback_models = [
            'models/gemini-2.5-flash',
            'models/gemini-2.5-pro'
        ]

    def generate_content(self, prompt, max_retries=3, timeout=120, model_name=None):
        # Build candidate list of models (primary first, then fallback models if different)
        # If a specific model_name is provided, use it as the primary
        if model_name:
            models_to_try = [model_name]
        else:
            models_to_try = [self.primary_model]
        for fallback in self.fallback_models:
            if fallback not in models_to_try:
                models_to_try.append(fallback)
                
        last_error = None
        
        for model_name in models_to_try:
            retry_count = 0
            backoff = 2
            
            while retry_count <= max_retries:
                try:
                    logger.info(f"Generating content using model={model_name}, attempt={retry_count + 1}")
                    model = genai.GenerativeModel(model_name)
                    
                    start_time = time.time()
                    response = model.generate_content(prompt)
                    generation_time = time.time() - start_time
                    
                    if not response or not response.text:
                        raise ValueError("Empty response received from Gemini.")
                        
                    # Extract usage metadata if present
                    prompt_tokens = 0
                    candidate_tokens = 0
                    total_tokens = 0
                    if hasattr(response, 'usage_metadata') and response.usage_metadata:
                        prompt_tokens = getattr(response.usage_metadata, 'prompt_token_count', 0)
                        candidate_tokens = getattr(response.usage_metadata, 'candidates_token_count', 0)
                        total_tokens = getattr(response.usage_metadata, 'total_token_count', 0)
                        
                    logger.info(
                        f"Success: model={model_name}, time={generation_time:.2f}s, "
                        f"tokens={total_tokens} (prompt={prompt_tokens}, gen={candidate_tokens})"
                    )
                    
                    return {
                        'text': response.text,
                        'model_used': model_name,
                        'generation_time': generation_time,
                        'tokens': {
                            'prompt': prompt_tokens,
                            'candidates': candidate_tokens,
                            'total': total_tokens
                        },
                        'retry_count': retry_count
                    }
                    
                except ResourceExhausted as e:
                    last_error = e
                    retry_count += 1
                    sleep_time = backoff ** retry_count
                    logger.warning(f"Quota exceeded (429) for model={model_name}. Retrying in {sleep_time}s... Error: {e}")
                    time.sleep(sleep_time)
                except GoogleAPIError as e:
                    # Check for non-transient status codes (400, 404)
                    status_code = getattr(e, 'code', None)
                    err_msg = str(e).lower()
                    if status_code in (400, 404) or "not found" in err_msg or "not supported" in err_msg:
                        last_error = e
                        logger.warning(f"Non-transient error for model={model_name}: {e}. Skipping to next fallback model immediately.")
                        break
                    
                    last_error = e
                    retry_count += 1
                    sleep_time = backoff ** retry_count
                    logger.warning(f"Google API Error for model={model_name}. Retrying in {sleep_time}s... Error: {e}")
                    time.sleep(sleep_time)
                except Exception as e:
                    last_error = e
                    logger.error(f"Unexpected error with model={model_name}: {e}")
                    # For other unexpected errors, try next model candidate immediately
                    break
                    
            logger.warning(f"Model {model_name} failed. Trying next candidate model...")
            
        raise last_error or ValueError("Failed to generate content with any available model.")
