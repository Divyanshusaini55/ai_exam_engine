import os
import time
import feedparser
from newspaper import Article
from django.core.management.base import BaseCommand
from django.utils.text import slugify
from quiz.models import CurrentAffair, Category
from quiz.ai.gemini_client import GeminiClient
import json

class Command(BaseCommand):
    help = 'Fetches and processes daily current affairs using AI'

    def handle(self, *args, **options):
        client = GeminiClient()

        RSS_FEEDS = [
            {"name": "The Hindu", "url": "https://www.thehindu.com/news/national/feeder/default.rss"},
            {"name": "Indian Express", "url": "https://indianexpress.com/section/india/feed/"},
            {"name": "PIB - English", "url": "https://pib.gov.in/rss/English_All_News.xml"},
            {"name": "LiveMint", "url": "https://www.livemint.com/rss/news"},
            {"name": "Business Standard", "url": "https://www.business-standard.com/rss/economy-policy-102.rss"},
            {"name": "Economic Times", "url": "https://economictimes.indiatimes.com/news/economy/policy/rssfeeds/1287732130.cms"}
        ]
        
        self.stdout.write(self.style.SUCCESS('Starting Current Affairs Fetch...'))
        
        # Ensure a "Current Affairs" category exists or grab first
        cat, _ = Category.objects.get_or_create(name='Current Affairs', defaults={'slug': 'current-affairs'})

        for feed in RSS_FEEDS:
            self.stdout.write(f"Fetching from {feed['name']}...")
            parsed = feedparser.parse(feed['url'])
            
            # Process top 5 entries for demo
            for entry in parsed.entries[:5]:
                title = entry.title
                link = entry.link
                
                # Check if already processed
                if CurrentAffair.objects.filter(source_url=link).exists():
                    self.stdout.write(f"Skipping already processed: {title}")
                    continue

                self.stdout.write(f"Processing: {title}")
                
                try:
                    # 1. Download article text with a 15s timeout to prevent hangs
                    article = Article(link, request_timeout=15)
                    article.download()
                    article.parse()
                    text = article.text
                    
                    if len(text) < 500:
                        self.stdout.write("Text too short, skipping.")
                        continue

                    # 2. Use Gemini Client to Analyze & Summarize
                    prompt = f"""
                    You are an expert tutor for Indian competitive exams (UPSC, SSC, Banking).
                    Read the following news article text and determine if it is highly relevant for exam preparation (e.g. Economy, Policy, Defense, Science, International Relations).
                    If it's NOT relevant (like local crime, sports drama, generic politics), return {{"relevant": false}}.
                    If it IS relevant, summarize it perfectly for a student.
                    
                    Respond strictly in valid JSON format:
                    {{
                        "relevant": true/false,
                        "title": "A clear, professional title for the news",
                        "summary": "A 2-sentence quick summary",
                        "content": "A detailed explanation in Markdown format, using bullet points for key facts, dates, and 'Why it matters' for exams."
                    }}
                    
                    Article Text:
                    {text[:4000]} # Limit to 4k chars to save tokens
                    """

                    res = client.generate_content(prompt)
                    output = res['text'].strip()
                    
                    # Clean json block
                    if output.startswith("```json"):
                        output = output[7:]
                    if output.startswith("```"):
                        output = output[3:]
                    if output.endswith("```"):
                        output = output[:-3]
                    output = output.strip()
                    
                    data = json.loads(output)

                    if data.get('relevant'):
                        base_slug = slugify(data['title'])
                        slug = base_slug
                        counter = 1
                        while CurrentAffair.objects.filter(slug=slug).exists():
                            slug = f"{base_slug}-{counter}"
                            counter += 1

                        CurrentAffair.objects.create(
                            title=data['title'],
                            slug=slug,
                            content=data['content'],
                            summary=data['summary'],
                            category=cat,
                            image_url=article.top_image if article.top_image else None,
                            source_name=feed['name'],
                            source_url=link
                        )
                        self.stdout.write(self.style.SUCCESS(f"Saved: {data['title']}"))
                    else:
                        self.stdout.write(self.style.WARNING(f"Irrelevant: {title}"))

                except Exception as e:
                    self.stdout.write(self.style.ERROR(f"Error processing {title}: {str(e)}"))
                
                time.sleep(2) # rate limit prevention

        self.stdout.write(self.style.SUCCESS('Done fetching current affairs.'))
