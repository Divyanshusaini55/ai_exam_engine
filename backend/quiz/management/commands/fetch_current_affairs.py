"""
Django management command: fetch_current_affairs

Replaces the original linear RSS-scraping + Gemini pipeline with the
CurrentAffairsFetcherGraph LangGraph agent.

Usage:
    python manage.py fetch_current_affairs
    python manage.py fetch_current_affairs --feeds https://example.com/rss1 https://example.com/rss2
"""

from django.core.management.base import BaseCommand
from quiz.ai.langgraph import CurrentAffairsFetcherGraph


class Command(BaseCommand):
    help = "Fetches and processes daily current affairs using an AI LangGraph agent"

    def add_arguments(self, parser):
        parser.add_argument(
            "--feeds",
            nargs="*",
            type=str,
            default=None,
            help="Optional list of RSS feed URLs to process (overrides defaults).",
        )

    def handle(self, *args, **options):
        feeds = options.get("feeds")

        self.stdout.write(self.style.NOTICE("Starting Current Affairs LangGraph agent…"))

        graph = CurrentAffairsFetcherGraph(feeds=feeds)
        saved_ids = graph.run()

        self.stdout.write(
            self.style.SUCCESS(
                f"Done. Saved {len(saved_ids)} relevant current-affairs article(s)."
            )
        )
