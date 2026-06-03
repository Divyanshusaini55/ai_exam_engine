import random
import json
import time
import logging
from django.db import transaction
from quiz.models import Exam, Question
from quiz.ai.gemini_client import GeminiClient
from quiz.ai.prompt_builder import PromptBuilder
from quiz.ai.question_analyzer import QuestionAnalyzer
from quiz.ai.aggregation_engine import AggregationEngine
from quiz.ai.markdown_formatter import MarkdownFormatter
from quiz.ai.validators import QualityValidator

logger = logging.getLogger('quiz.ai.summary_service')

class ExamSummaryService:
    def __init__(self):
        self.client = GeminiClient()
        self.analyzer = QuestionAnalyzer(self.client)

    def generate_summary(self, exam: Exam, force: bool = False) -> str:
        """
        Orchestrates the Generic AI Exam Intelligence Pipeline:
        1. Ingest & Validate questions
        2. Analyze questions in batches (inferring subjects, concepts, subtopics, cognitive levels, skills, formulas)
        3. Aggregate analyzed data into statistics and patterns JSON
        4. Generate final Markdown summary using ONLY the aggregated JSON data
        5. Quality validate and atomically persist summary in database
        """
        if exam.ai_summary and not force:
            logger.info(f"Summary already exists for exam {exam.id} ({exam.title}). Skipping.")
            return exam.ai_summary

        start_time = time.time()
        logger.info(f"Starting generic summary pipeline for exam={exam.id}, title='{exam.title}'")

        # 1. Fetch questions optimally (load only required fields)
        questions_qs = Question.objects.filter(exam=exam).only(
            'id', 'question_text', 'subject', 'topic', 'difficulty', 'points'
        )
        total_questions = questions_qs.count()
        if total_questions == 0:
            raise ValueError(f"Exam {exam.id} has no questions. Cannot generate summary.")

        # Convert queryset to dictionary list
        raw_questions = []
        for q in questions_qs.values('id', 'question_text', 'subject', 'topic', 'difficulty', 'points'):
            raw_questions.append(q)

        # Step 1: Question Ingestion & Validation
        validated_questions = self.analyzer.ingest_and_validate(raw_questions)

        # Step 1.5: Sample questions to prevent API timeouts for large exams
        max_sample = 30
        if len(validated_questions) > max_sample:
            logger.info(f"Exam is large ({len(validated_questions)} questions). Sampling {max_sample} questions for summary generation to prevent timeout.")
            random.seed(exam.id)  # Fixed seed for consistent summary generation
            sampled_questions = random.sample(validated_questions, max_sample)
        else:
            sampled_questions = validated_questions

        # Step 2: Question Intelligence Engine (Batch processing: 30 questions per batch)
        analyzed_questions = self.analyzer.analyze_questions(sampled_questions, batch_size=30)
        logger.info(f"Successfully analyzed {len(analyzed_questions)} questions.")

        # Map validated questions by ID back to analyzed_questions for question references
        validated_by_id = {q['id']: q for q in validated_questions}
        for aq in analyzed_questions:
            q_id = aq.get('id')
            if q_id in validated_by_id:
                aq['question_text'] = validated_by_id[q_id]['question_text']
            else:
                aq['question_text'] = ""

        # Step 3: Exam Aggregator
        aggregated_data = AggregationEngine.aggregate(analyzed_questions)
        
        # Remove raw questions to prevent bloated AI summary and token limit bloat
        if 'exam_questions' in aggregated_data:
            del aggregated_data['exam_questions']
            
        aggregated_json_str = json.dumps(aggregated_data, indent=2)
        logger.info("Exam stats aggregated successfully.")

        # Step 4: Summary Generator (passes ONLY aggregated JSON to LLM)
        max_attempts = 2
        summary_text = ""
        model_used = ""
        total_tokens = 0
        gen_time = 0.0
        retry_count = 0
        cleaned_summary = ""

        for attempt in range(max_attempts):
            prompt = PromptBuilder.build_summary_prompt(exam.title, aggregated_json_str)
            logger.info(f"Generating summary attempt {attempt + 1}...")
            
            try:
                result = self.client.generate_content(prompt)
                
                raw_summary = result.get('text', '').strip()
                model_used = result.get('model_used', '')
                total_tokens += result.get('tokens', {}).get('total', 0)
                gen_time += result.get('generation_time', 0.0)
                retry_count += result.get('retry_count', 0)

                # Clean output
                cleaned_summary = MarkdownFormatter.clean(raw_summary)

                # Quality Validation
                if QualityValidator.validate_summary(cleaned_summary):
                    summary_text = cleaned_summary
                    break
                else:
                    logger.warning(f"Validation failed for attempt {attempt + 1}. Retrying...")
                    if attempt < max_attempts - 1:
                        retry_count += 1
            except Exception as ex:
                logger.error(f"Error on summary generation attempt {attempt + 1}: {ex}")
                if attempt == max_attempts - 1 and not cleaned_summary:
                    raise ex

        if not summary_text:
            if cleaned_summary:
                logger.error("Failed to generate a summary passing validation. Saving fallback cleaned summary.")
                summary_text = cleaned_summary
            else:
                raise ValueError("Summary generation completely failed to produce clean text.")

        # Save output atomically
        with transaction.atomic():
            exam.ai_summary = summary_text
            exam.save(update_fields=['ai_summary'])

        pipeline_duration = time.time() - start_time
        
        # Log Metrics
        logger.info(
            f"SUMMARY_METRICS: exam_id={exam.id}, question_count={total_questions}, "
            f"token_count={total_tokens}, generation_time={pipeline_duration:.2f}s, "
            f"model_used='{model_used}', summary_length={len(summary_text)}, "
            f"retry_count={retry_count}"
        )

        return summary_text
