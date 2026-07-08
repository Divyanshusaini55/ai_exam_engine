"""
LangGraph graph replacing the fetch_current_affairs management command internals.

Scrapes RSS feeds, deduplicates across sources, classifies each article
with Gemini, and persists relevant current-affairs records to the database.

Nodes
-----
node_scrape_feeds      – fetch RSS + newspaper3k article bodies
node_deduplicate       – batch Gemini call to remove cross-source duplicates
node_classify_article  – call Gemini to classify relevance & summarise
node_persist           – save CurrentAffair record
node_advance           – increment index, clear per-article fields

Flow
----
node_scrape_feeds → node_deduplicate → node_classify_article (loop)
  → relevant  → node_persist → node_advance
  → not relevant → node_advance
node_advance → next article or END
"""

from __future__ import annotations

import json
import time
import logging
import operator
from typing import Annotated, List, Optional, TypedDict

import feedparser
from newspaper import Article
from django.conf import settings
from django.utils.text import slugify
from langgraph.graph import StateGraph, END

from quiz.models import CurrentAffair, Category
from quiz.ai.gemini_client import GeminiClient
from quiz.ai.langgraph.base import with_backoff

logger = logging.getLogger("quiz.ai.langgraph.current_affairs_graph")


# ── Models ──────────────────────────────────────────────────────────────────

CLASSIFY_MODEL = getattr(settings, "GEMINI_CLASSIFY_MODEL", "models/gemini-2.0-flash")
SUMMARY_MODEL = getattr(settings, "GEMINI_SUMMARY_MODEL", "models/gemini-2.5-flash")


# ── Default RSS feeds (LiveMint dropped — low quality / noisy) ──────────────

DEFAULT_FEEDS = [
    "https://www.thehindu.com/news/national/feeder/default.rss",
    "https://indianexpress.com/section/india/feed/",
    "https://feeds.feedburner.com/ndtvnews-india-news",                          # NDTV India
    "https://timesofindia.indiatimes.com/rssfeeds/-2128936835.cms",              # TOI India
    "https://www.hindustantimes.com/feeds/rss/india-news/rssfeed.xml",           # HT India
    "https://www.business-standard.com/rss/economy-policy-102.rss",
    "https://economictimes.indiatimes.com/news/economy/policy/rssfeeds/1287732130.cms",
]

ENTRIES_PER_FEED = 7          # 7 feeds × 7 = 49 max before dedup
MIN_BODY_LENGTH = 800         # filter stub / breaking-news articles


# ── Category tag → DB Category mapping ──────────────────────────────────────

CATEGORY_TAG_MAP = {
    "economy":         "Economy & Finance",
    "polity":          "Polity & Governance",
    "science":         "Science & Technology",
    "ir":              "International Relations",
    "environment":     "Environment & Ecology",
    "defence":         "Defence & Security",
    "society":         "Society & Social Justice",
    "geography":       "Geography & Disasters",
    "history_culture": "History & Culture",
}

CATEGORY_SLUG_MAP = {
    "Economy & Finance":        "economy-finance",
    "Polity & Governance":      "polity-governance",
    "Science & Technology":     "science-technology",
    "International Relations":  "international-relations",
    "Environment & Ecology":    "environment-ecology",
    "Defence & Security":       "defence-security",
    "Society & Social Justice": "society-social-justice",
    "Geography & Disasters":    "geography-disasters",
    "History & Culture":        "history-culture",
}


# ── State ───────────────────────────────────────────────────────────────────

class CurrentAffairsState(TypedDict):
    feeds: List[str]
    articles: List[dict]            # [{"url", "title", "body", "source_name", "image_url"}]
    current_index: int
    article: Optional[dict]         # current article being processed
    relevant: Optional[bool]
    formatted: Optional[dict]
    saved_ids: Annotated[List[int], operator.add]
    error: Optional[str]


# ── Helper: strip markdown fences from Gemini response ──────────────────────

def _strip_json_fences(raw: str) -> str:
    """Remove ```json ... ``` wrapping from Gemini output."""
    cleaned = raw.strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    if cleaned.startswith("```"):
        cleaned = cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    return cleaned.strip()


# ── Nodes ───────────────────────────────────────────────────────────────────

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

        for entry in parsed.entries[:ENTRIES_PER_FEED]:
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
                if len(body) < MIN_BODY_LENGTH:
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
def node_deduplicate(state: CurrentAffairsState) -> dict:
    """Batch Gemini call to group duplicate articles covering the same event.

    Sends all titles + body snippets in one call, asks the model to cluster
    duplicates and pick the best source per topic. Returns the filtered list.
    Uses the cheaper gemini-2.0-flash model.
    """
    articles = state["articles"]
    if len(articles) <= 1:
        return {"articles": articles}

    # Build a concise listing for the model
    listing_lines = []
    for i, a in enumerate(articles):
        snippet = a["body"][:200].replace("\n", " ")
        listing_lines.append(f'{i}. [{a["source_name"]}] {a["title"]} — {snippet}')

    listing = "\n".join(listing_lines)

    prompt = (
        "You are a news deduplication engine. Below is a numbered list of news articles "
        "scraped from multiple Indian newspapers. Many articles cover THE SAME underlying "
        "event or topic from different sources.\n\n"
        "Your task:\n"
        "1. Group articles that cover the same event/topic.\n"
        "2. For each group, pick the SINGLE best article (most detailed, factual, longest body).\n"
        "3. Return ONLY the indices of the best article per group.\n\n"
        "Respond strictly in valid JSON format:\n"
        '{"keep_indices": [0, 3, 5, 7, ...]}\n\n'
        f"Articles:\n{listing}\n"
    )

    client = GeminiClient()
    result = client.generate_content(prompt, model_name=CLASSIFY_MODEL)
    raw = _strip_json_fences(result.get("text", ""))

    try:
        data = json.loads(raw)
        keep = data.get("keep_indices", [])
        if not isinstance(keep, list) or not keep:
            logger.warning("Dedup returned empty keep list, keeping all articles.")
            return {"articles": articles}

        filtered = [articles[i] for i in keep if 0 <= i < len(articles)]
        logger.info(
            "Dedup: %d articles → %d unique topics.",
            len(articles), len(filtered),
        )
        return {"articles": filtered, "current_index": 0}
    except Exception as exc:
        logger.warning("Failed to parse dedup JSON: %s. Keeping all articles.", exc)
        return {"articles": articles}


@with_backoff
def node_classify_article(state: CurrentAffairsState) -> dict:
    """Classify the current article's exam relevance via Gemini.

    Uses gemini-2.0-flash (cheap) for classification. Only articles scoring
    relevance_score >= 7 are accepted.
    """
    idx = state["current_index"]
    article = state["articles"][idx]

    prompt = (
        "You are a strict editorial filter for Indian competitive exam preparation "
        "(UPSC CSE, SSC CGL/CHSL, Banking PO/Clerk, State PSC).\n\n"

        "ACCEPT the article ONLY if it directly maps to one of these exam domains:\n"
        "  • GS1: Major historical events, Indian art & culture, geography (physical/human), "
        "society & social issues\n"
        "  • GS2: Polity & governance (Acts, Bills, SC/HC judgments, constitutional amendments), "
        "international relations (treaties, summits, bilateral ties), social justice & welfare schemes\n"
        "  • GS3: Economy (GDP, RBI policy, fiscal policy, trade), science & technology "
        "(ISRO, DRDO, biotech, AI policy), environment & ecology (climate, biodiversity, "
        "international accords), internal security, disaster management\n"
        "  • GS4: Ethics case studies — ONLY landmark cases with national significance\n"
        "  • Banking/SSC: RBI circulars, monetary policy, government schemes, major appointments\n\n"

        "REJECT firmly — return relevant=false for:\n"
        "  - Crime reports, FIRs, accidents (unless landmark SC/HC ruling)\n"
        "  - Celebrity, entertainment, sports news\n"
        "  - \"This day in history\" / \"Born on this day\" listicles\n"
        "  - Opinion/editorial without policy substance\n"
        "  - Routine weather updates (unless major disaster with NDRF/SDRF deployment)\n"
        "  - Political party statements, rallies, campaign speeches without policy content\n"
        "  - Tribute/obituary articles unless the person has direct exam-syllabus relevance\n"
        "  - Film/book/media controversies\n"
        "  - Local/state incidents with no national policy implication\n"
        "  - Duplicate-feeling roundup articles (\"Key Updates: X, Y, Z\")\n\n"

        "Rate the article's relevance_score from 1 to 10:\n"
        "  1-3 = Not relevant  |  4-6 = Borderline  |  7-10 = Highly relevant\n"
        "Only articles scoring >= 7 will be kept.\n\n"

        "Respond strictly in valid JSON:\n"
        "{\n"
        '  "relevant": true/false,\n'
        '  "relevance_score": 1-10,\n'
        '  "category_tag": "economy|polity|science|ir|environment|defence|society|geography|history_culture",\n'
        '  "title": "A clear, exam-oriented title",\n'
        '  "summary": "A concise 2-sentence summary for quick revision",\n'
        '  "content_markdown": "Detailed explanation in Markdown with bullet points for key facts, '
        "dates, figures, and a '## Why It Matters for Exams' section at the end. DO NOT include the article title as a heading.\"\n"
        "}\n\n"
        "If not relevant, return only: {\"relevant\": false, \"relevance_score\": <score>}\n\n"

        f"Article Title: {article['title']}\n"
        f"Source: {article['source_name']}\n"
        f"Article Text:\n{article['body']}\n"
    )

    client = GeminiClient()
    result = client.generate_content(prompt, model_name=CLASSIFY_MODEL)
    raw = _strip_json_fences(result.get("text", ""))

    try:
        data = json.loads(raw)
        score = int(data.get("relevance_score", 0))
        is_relevant = bool(data.get("relevant", False)) and score >= 7

        if is_relevant:
            formatted = {
                "title": data.get("title", article["title"]),
                "summary": data.get("summary", ""),
                "content": data.get("content_markdown", ""),
                "category_tag": data.get("category_tag", ""),
            }
            logger.info(
                "ACCEPT (score=%d, tag=%s): %s",
                score, formatted["category_tag"], formatted["title"],
            )
            return {"article": article, "relevant": True, "formatted": formatted, "error": None}

        logger.info("REJECT (score=%d): %s", score, article["title"])
        return {"article": article, "relevant": False, "formatted": None, "error": None}
    except Exception as exc:
        logger.warning("Failed to parse classification JSON for '%s': %s", article["title"], exc)
        return {"article": article, "relevant": False, "formatted": None, "error": str(exc)}


def node_persist(state: CurrentAffairsState) -> dict:
    """Create a CurrentAffair record from the formatted data.

    Maps the category_tag from classification to a specific sub-category
    (e.g. Economy & Finance, Polity & Governance) instead of the generic
    'Current Affairs' bucket.
    """
    article = state["article"]
    formatted = state["formatted"]

    # Resolve category from tag
    tag = (formatted.get("category_tag") or "").strip().lower()
    cat_name = CATEGORY_TAG_MAP.get(tag)
    if cat_name:
        cat_slug = CATEGORY_SLUG_MAP.get(cat_name, slugify(cat_name))
        cat, _ = Category.objects.get_or_create(
            name=cat_name, defaults={"slug": cat_slug}
        )
    else:
        # Fallback to generic Current Affairs
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

    logger.info("Saved CurrentAffair pk=%d [%s]: %s", record.pk, cat.name, formatted["title"])

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



# ── Routing ─────────────────────────────────────────────────────────────────

def _after_scrape(state: CurrentAffairsState) -> str:
    if state["articles"]:
        return "node_deduplicate"
    return END


def _after_dedup(state: CurrentAffairsState) -> str:
    if state["articles"]:
        return "node_classify_article"
    return END


def _after_classify(state: CurrentAffairsState) -> str:
    if state.get("relevant"):
        return "node_persist"
    return "node_advance"


def _after_advance(state: CurrentAffairsState) -> str:
    if state["current_index"] < len(state["articles"]):
        return "node_classify_article"
    return END


# ── Graph compilation ───────────────────────────────────────────────────────

def _build_graph() -> StateGraph:
    g = StateGraph(CurrentAffairsState)

    g.add_node("node_scrape_feeds", node_scrape_feeds)
    g.add_node("node_deduplicate", node_deduplicate)
    g.add_node("node_classify_article", node_classify_article)
    g.add_node("node_persist", node_persist)
    g.add_node("node_advance", node_advance)

    g.set_entry_point("node_scrape_feeds")

    # scrape → dedup (or END if no articles)
    g.add_conditional_edges(
        "node_scrape_feeds",
        _after_scrape,
        {"node_deduplicate": "node_deduplicate", END: END},
    )

    # dedup → classify loop (or END if dedup filtered everything)
    g.add_conditional_edges(
        "node_deduplicate",
        _after_dedup,
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



# ── Public API ──────────────────────────────────────────────────────────────

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
