import os
import time
import logging
from django.conf import settings
import vertexai
from vertexai.generative_models import GenerativeModel, Part
from google.cloud import storage
from google.api_core.exceptions import GoogleAPIError, ResourceExhausted

from quiz.ai.langfuse_client import observe, update_observation_metadata

logger = logging.getLogger('quiz.ai.gemini_client')

_vertex_initialized = False

class GeminiClient:
    def __init__(self):
        global _vertex_initialized
        self.project_id = os.environ.get("GCP_PROJECT_ID") or getattr(settings, 'GCP_PROJECT_ID', None)
        self.location = os.environ.get("GCP_LOCATION") or getattr(settings, 'GCP_LOCATION', "us-central1")
        
        if not self.project_id:
            logger.warning("GCP_PROJECT_ID is not set. Vertex AI might fail to initialize if not in a GCP environment.")
            
        # Initialize Vertex AI once
        if not _vertex_initialized and self.project_id:
            try:
                vertexai.init(project=self.project_id, location=self.location)
                _vertex_initialized = True
            except Exception as e:
                logger.warning(f"Failed to initialize Vertex AI: {e}")
        
        self.primary_model = getattr(settings, 'GEMINI_SUMMARY_MODEL', 'gemini-2.5-flash')
        # Handle 'models/' prefix from old configuration if present
        if self.primary_model.startswith("models/"):
            self.primary_model = self.primary_model.replace("models/", "")
            
        # Standard Vertex AI Fallback Models
        self.fallback_models = [
            'gemini-2.5-flash',
            'gemini-2.5-pro',
            'gemini-1.5-flash'
        ]
        
        self.bucket_name = os.environ.get("GCS_BUCKET_NAME") or getattr(settings, 'GCS_BUCKET_NAME', None)

    def upload_pdf(self, file_path):
        logger.info(f"Uploading PDF to Google Cloud Storage: {file_path}")
        if not self.bucket_name:
            raise ValueError("GCS_BUCKET_NAME must be set to upload PDFs to Vertex AI.")
            
        storage_client = storage.Client(project=self.project_id)
        bucket = storage_client.bucket(self.bucket_name)
        
        # Create a unique blob name using timestamp to prevent collisions
        blob_name = f"pdfs/{int(time.time())}_{os.path.basename(file_path)}"
        blob = bucket.blob(blob_name)
        blob.upload_from_filename(file_path)
        
        gcs_uri = f"gs://{self.bucket_name}/{blob_name}"
        
        # Return both the Part object and the blob name (for deletion)
        # Note: Previous API returned a single object, we return a dict to make it easier to delete
        return {
            'part': Part.from_uri(uri=gcs_uri, mime_type="application/pdf"),
            'blob_name': blob_name
        }

    def delete_pdf(self, blob_name):
        logger.info(f"Deleting GCS file: {blob_name}")
        if not self.bucket_name:
            return
            
        try:
            storage_client = storage.Client(project=self.project_id)
            bucket = storage_client.bucket(self.bucket_name)
            blob = bucket.blob(blob_name)
            if blob.exists():
                blob.delete()
        except Exception as e:
            logger.error(f"Failed to delete GCS file {blob_name}: {e}")

    @observe(as_type="generation")
    def generate_content(
        self, 
        prompt, 
        max_retries=3, 
        timeout=120, 
        model_name=None,
        generation_config=None,
        temperature=None,
        response_mime_type=None
    ):
        # Support for passing a list of parts (multimodal) or just a string
        if isinstance(prompt, str):
            contents = [prompt]
        else:
            contents = prompt

        # If a specific model_name is provided, use it as the primary
        if model_name:
            if model_name.startswith("models/"):
                model_name = model_name.replace("models/", "")
            models_to_try = [model_name]
        else:
            models_to_try = [self.primary_model]
            
        for fallback in self.fallback_models:
            if fallback not in models_to_try:
                models_to_try.append(fallback)

        # Build GenerationConfig dictionary if specified
        gen_config = dict(generation_config) if isinstance(generation_config, dict) else {}
        if temperature is not None:
            gen_config["temperature"] = temperature
        if response_mime_type is not None:
            gen_config["response_mime_type"] = response_mime_type
                
        last_error = None
        
        for current_model_name in models_to_try:
            retry_count = 0
            backoff = 2
            
            while retry_count <= max_retries:
                try:
                    logger.info(f"Generating content using model={current_model_name}, attempt={retry_count + 1}")
                    model = GenerativeModel(current_model_name)
                    
                    start_time = time.time()
                    
                    # Call generate_content with optional generation_config
                    if gen_config:
                        response = model.generate_content(contents, generation_config=gen_config)
                    else:
                        response = model.generate_content(contents)

                    generation_time = time.time() - start_time
                    
                    if not response or not response.text:
                        raise ValueError("Empty response received from Vertex AI.")
                        
                    # Extract usage metadata if present
                    prompt_tokens = 0
                    candidate_tokens = 0
                    total_tokens = 0
                    
                    if hasattr(response, 'usage_metadata') and response.usage_metadata:
                        prompt_tokens = getattr(response.usage_metadata, 'prompt_token_count', 0)
                        candidate_tokens = getattr(response.usage_metadata, 'candidates_token_count', 0)
                        total_tokens = getattr(response.usage_metadata, 'total_token_count', 0)
                        
                    update_observation_metadata(
                        model=current_model_name,
                        usage={
                            "input": prompt_tokens,
                            "output": candidate_tokens,
                            "total": total_tokens
                        }
                    )
                    logger.info(
                        f"Success: model={current_model_name}, time={generation_time:.2f}s, "
                        f"tokens={total_tokens} (prompt={prompt_tokens}, gen={candidate_tokens})"
                    )
                    
                    return {
                        'text': response.text,
                        'model_used': current_model_name,
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
                    logger.warning(f"Quota exceeded (429) for model={current_model_name}. Retrying in {sleep_time}s... Error: {e}")
                    time.sleep(sleep_time)
                except GoogleAPIError as e:
                    # Check for non-transient status codes (400, 404)
                    status_code = getattr(e, 'code', None)
                    err_msg = str(e).lower()
                    if status_code in (400, 404) or "not found" in err_msg or "not supported" in err_msg:
                        last_error = e
                        logger.warning(f"Non-transient error for model={current_model_name}: {e}. Skipping to next fallback model immediately.")
                        break
                    
                    last_error = e
                    retry_count += 1
                    sleep_time = backoff ** retry_count
                    logger.warning(f"Google API Error for model={current_model_name}. Retrying in {sleep_time}s... Error: {e}")
                    time.sleep(sleep_time)
                except Exception as e:
                    last_error = e
                    logger.error(f"Unexpected error with model={current_model_name}: {e}")
                    # For other unexpected errors, try next model candidate immediately
                    break
                    
            logger.warning(f"Model {current_model_name} failed. Trying next candidate model...")
            
        raise last_error or ValueError("Failed to generate content with any available model.")
