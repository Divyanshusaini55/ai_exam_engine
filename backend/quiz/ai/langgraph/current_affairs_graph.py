"""
LangGraph graph replacing the fetch_current_affairs management command internals.

Scrapes RSS feeds, classifies each article with Gemini, and persists
relevant current-affairs records to the database.

Nodes
-----
node_scrape_feeds    – fetch RSS + newspaper3k article bodies
node_classify_article – call Gemini to classify relevance & summarise
node_persist         – save CurrentAffair record
node_advance         – increment index, clear per-article fields

Routing after node_classify_article:
  relevant=True  → node_persist → node_advance
  relevant=False → node_advance

Routing after node_advance:
  current_index < len(articles) → node_classify_article
  otherwise                     → END
"""

from __future__ import annotations

import json
import time
import logging
import operator
from typing import Annotated, List, Optional, TypedDict

import feedparser
from newspaper import Article
from django.utils.text import slugify
from langgraph.graph import StateGraph, END

from quiz.models import CurrentAffair, Category
from quiz.ai.gemini_client import GeminiClient
from quiz.ai.langgraph.base import with_backoff

logger = logging.getLogger("quiz.ai.langgraph.current_affairs_graph")


# Default RSS feeds

DEFAULT_FEEDS = [
    "https://www.thehindu.com/news/national/feeder/default.rss",
    "https://indianexpress.com/section/india/feed/",
    "https://feeds.feedburner.com/ndtvnews-india-news",                          # NDTV India
    "https://timesofindia.indiatimes.com/rssfeeds/-2128936835.cms",              # TOI India
    "https://www.hindustantimes.com/feeds/rss/india-news/rssfeed.xml",           # HT India
    "https://www.livemint.com/rss/news",
    "https://www.business-standard.com/rss/economy-policy-102.rss",
    "https://economictimes.indiatimes.com/news/economy/policy/rssfeeds/1287732130.cms",
]

# State

class CurrentAffairsState(TypedDict):
    feeds: List[str]
    articles: List[dict]            # [{"url", "title", "body", "source_name", "image_url"}]
    current_index: int
    article: Optional[dict]            # current article being processed
    relevant: Optional[bool]
    formatted: Optional[dict]
    saved_ids: Annotated[List[int], operator.add]
    error: Optional[str]


# Nodes

def node_scrape_feeds(state: CurrentAffairsState) -> dict:
    """Scrape RSS feeds and download article bodies via newspaper3k."""
    articles: List[dict] = []
    feeds = state.get("feeds") or DEFAULT_FEEDS

    # Map feed URLs to human-readable names
    feed_names = {
        "thehindu.com": "The Hindu",
        "indianexpress.com": "Indian Express",
        "ndtvnews": "NDTV",
        "timesofindia.indiatimes.com": "Times of India",
        "hindustantimes.com": "Hindustan Times",
        "livemint.com": "LiveMint",
        "business-standard.com": "Business Standard",
        "economictimes.indiatimes.com": "Economic Times",
    }

    def _source_name(url: str) -> str:
        for domain, name in feed_names.items():
            if domain in url:
                return name
        return "Unknown"

    for feed_url in feeds:
        source = _source_name(feed_url)
        try:
            parsed = feedparser.parse(feed_url)
        except Exception as exc:
            logger.debug("Failed to parse feed %s: %s", feed_url, exc)
            continue

        for entry in parsed.entries[:10]:  # cap at 10 per feed
            url = getattr(entry, "link", "")
            title = getattr(entry, "title", "")

            # Skip already-processed articles
            if CurrentAffair.objects.filter(source_url=url).exists():
                logger.debug("Skipping already-processed: %s", title)
                continue

            try:
                art = Article(url, request_timeout=15)
                art.download()
                art.parse()
                body = (art.text or "")[:3000]  # truncate to 3k chars
                if len(body) < 500:
                    continue
                articles.append({
                    "url": url,
                    "title": title,
                    "body": body,
                    "source_name": source,
                    "image_url": art.top_image or "",
                })
            except Exception as exc:
                logger.debug("Skipping article %s: %s", title, exc)

    logger.info("Scraped %d articles from %d feeds.", len(articles), len(feeds))
    return {"articles": articles, "current_index": 0, "saved_ids": []}


@with_backoff
def node_classify_article(state: CurrentAffairsState) -> dict:
    """Classify the current article's exam relevance via Gemini."""
    idx = state["current_index"]
    article = state["articles"][idx]

    prompt = (
        "You are an expert tutor for Indian competitive exams (UPSC, SSC, Banking).\n"
        "Read the following news article and determine if it is highly relevant for "
        "exam preparation (e.g. Economy, Policy, Defense, Science, International Relations).\n"
        "If it's NOT relevant (like local crime, sports drama, generic politics), "
        'return {"relevant": false}.\n'
        "If it IS relevant, summarize it perfectly for a student.\n\n"
        "Respond strictly in valid JSON format:\n"
        "{\n"
        '    "relevant": true/false,\n'
        '    "title": "A clear, professional title for the news",\n'
        '    "summary": "A 2-sentence quick summary",\n'
        '    "content_markdown": "A detailed explanation in Markdown format, '
        "using bullet points for key facts, dates, and 'Why it matters' for exams.\"\n"
        "}\n\n"
        f"Article Title: {article['title']}\n"
        f"Article Text:\n{article['body']}\n"
    )

    client = GeminiClient()
    result = client.generate_content(prompt)
    raw = result.get("text", "").strip()

    # Strip markdown fences
    cleaned = raw
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    if cleaned.startswith("```"):
        cleaned = cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    cleaned = cleaned.strip()

    try:
        data = json.loads(cleaned)
        is_relevant = bool(data.get("relevant", False))
        if is_relevant:
            formatted = {
                "title": data.get("title", article["title"]),
                "summary": data.get("summary", ""),
                "content": data.get("content_markdown", ""),
            }
            return {"article": article, "relevant": True, "formatted": formatted, "error": None}
        return {"article": article, "relevant": False, "formatted": None, "error": None}
    except Exception as exc:
        logger.warning("Failed to parse classification JSON for '%s': %s", article["title"], exc)
        return {"article": article, "relevant": False, "formatted": None, "error": str(exc)}


def node_persist(state: CurrentAffairsState) -> dict:
    """Create a CurrentAffair record from the formatted data."""
    article = state["article"]
    formatted = state["formatted"]

    cat, _ = Category.objects.get_or_create(
        name="Current Affairs", defaults={"slug": "current-affairs"}
    )

    base_slug = slugify(formatted["title"])
    slug = base_slug
    counter = 1
    while CurrentAffair.objects.filter(slug=slug).exists():
        slug = f"{base_slug}-{counter}"
        counter += 1

    record = CurrentAffair.objects.create(
        title=formatted["title"],
        slug=slug,
        content=formatted["content"],
        summary=formatted["summary"],
        category=cat,
        image_url=article.get("image_url") or None,
        source_name=article.get("source_name", ""),
        source_url=article.get("url", ""),
    )

    logger.info("Saved CurrentAffair pk=%d: %s", record.pk, formatted["title"])

    # Rate-limit between saves
    time.sleep(1.5)

    return {"saved_ids": [record.pk]}


def node_advance(state: CurrentAffairsState) -> dict:
    """Increment index and clear per-article transient fields."""
    return {
        "current_index": state["current_index"] + 1,
        "article": None,
        "relevant": None,
        "formatted": None,
    }



# Routing

def _after_classify(state: CurrentAffairsState) -> str:
    if state.get("relevant"):
        return "node_persist"
    return "node_advance"


def _after_advance(state: CurrentAffairsState) -> str:
    if state["current_index"] < len(state["articles"]):
        return "node_classify_article"
    return END


# Graph compilation

def _build_graph() -> StateGraph:
    g = StateGraph(CurrentAffairsState)

    g.add_node("node_scrape_feeds", node_scrape_feeds)
    g.add_node("node_classify_article", node_classify_article)
    g.add_node("node_persist", node_persist)
    g.add_node("node_advance", node_advance)

    g.set_entry_point("node_scrape_feeds")

    # After scraping, jump into the classify loop (or end if no articles)
    g.add_conditional_edges(
        "node_scrape_feeds",
        lambda s: "node_classify_article" if s["articles"] else END,
        {"node_classify_article": "node_classify_article", END: END},
    )

    g.add_conditional_edges(
        "node_classify_article",
        _after_classify,
        {"node_persist": "node_persist", "node_advance": "node_advance"},
    )

    g.add_edge("node_persist", "node_advance")

    g.add_conditional_edges(
        "node_advance",
        _after_advance,
        {"node_classify_article": "node_classify_article", END: END},
    )

    return g



# Public API

class CurrentAffairsFetcherGraph:
    """Drop-in replacement for the fetch_current_affairs management command logic."""

    def __init__(self, feeds: Optional[List[str]] = None):
        self._feeds = feeds or DEFAULT_FEEDS
        self._app = _build_graph().compile()

    def run(self) -> List[int]:
        """Execute the graph and return list of saved CurrentAffair PKs."""
        initial_state: CurrentAffairsState = {
            "feeds": self._feeds,
            "articles": [],
            "current_index": 0,
            "article": None,
            "relevant": None,
            "formatted": None,
            "saved_ids": [],
            "error": None,
        }
        final = self._app.invoke(initial_state, config={"recursion_limit": 300})
        return final.get("saved_ids", [])
