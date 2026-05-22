
from __future__ import annotations

import subprocess
from typing import TYPE_CHECKING

import bleach

if TYPE_CHECKING:
    # Avoid a hard import at module level; the resource ORM model is only
    # needed for type-checking so that this module stays import-order-safe.
    from quiz.models import TopicResource  # adjust path if model lives elsewhere


# ─── Allowed HTML tags & attributes for bleach ────────────────────────────────

_ALLOWED_TAGS: list[str] = [
    # Text structure
    "p", "h1", "h2", "h3", "h4", "h5", "h6",
    "ul", "ol", "li",
    "strong", "em",
    "code", "pre",
    "blockquote",
    # Tables
    "table", "thead", "tbody", "tr", "th", "td",
    # Inline / misc
    "a", "img",
    "div", "span",
    "br", "hr",
    # MathML (rendered by MathJax)
    "math", "mrow", "mi", "mo", "mn",
    "msup", "msub", "mfrac", "msqrt",
]

_ALLOWED_ATTRIBUTES: dict[str, list[str]] = {
    "*":   ["class", "id"],
    "a":   ["href", "target"],
    "img": ["src", "alt"],
}


# ─── 1. latex_to_html ─────────────────────────────────────────────────────────

def latex_to_html(latex_content: str) -> str:
    """Convert a LaTeX string to an HTML fragment via Pandoc.

    Parameters
    ----------
    latex_content:
        Raw LaTeX source (may include math environments).

    Returns
    -------
    str
        HTML string produced by Pandoc with ``--mathjax`` enabled so that
        math environments are preserved for client-side rendering.

    Raises
    ------
    EnvironmentError
        If the ``pandoc`` binary is not found on the system PATH.
    ValueError
        If Pandoc exits with a non-zero status code (e.g. malformed LaTeX).
    """
    cmd = ["pandoc", "-f", "latex", "-t", "html", "--mathjax"]

    try:
        result = subprocess.run(
            cmd,
            input=latex_content,
            capture_output=True,
            text=True,
            timeout=10,
        )
    except FileNotFoundError:
        raise EnvironmentError(
            "pandoc is not installed or not on the system PATH. "
            "Install it with: brew install pandoc  (macOS) or "
            "apt-get install pandoc  (Debian/Ubuntu)."
        )
    except subprocess.TimeoutExpired:
        raise ValueError("pandoc timed out after 10 seconds while converting LaTeX.")

    if result.returncode != 0:
        raise ValueError(
            f"pandoc failed (exit {result.returncode}): {result.stderr.strip()}"
        )

    return result.stdout


# ─── 2. sanitize_html ─────────────────────────────────────────────────────────

def sanitize_html(html_content: str) -> str:
    """Strip unsafe HTML tags and attributes using *bleach*.

    Preserves the tags and attributes listed in ``_ALLOWED_TAGS`` /
    ``_ALLOWED_ATTRIBUTES`` while removing everything else that could
    introduce XSS vectors.

    Parameters
    ----------
    html_content:
        Raw HTML string (possibly from user-supplied or AI-generated content).

    Returns
    -------
    str
        Sanitised HTML string safe for embedding in a page.
    """
    return bleach.clean(
        html_content,
        tags=_ALLOWED_TAGS,
        attributes=_ALLOWED_ATTRIBUTES,
        strip=True,          # remove disallowed tags entirely (don't escape them)
        strip_comments=True,
    )


# ─── 3. get_renderable_content ────────────────────────────────────────────────

def get_renderable_content(resource) -> dict:
    """Return the renderable content and its format for a given resource.

    Dispatches on ``resource.content_format`` (or ``resource.resource_type``
    if ``content_format`` is absent) and applies the appropriate conversion
    pipeline.

    Parameters
    ----------
    resource:
        A Django model instance that exposes at least the following
        attributes (all optional – graceful fallbacks are used):

        * ``content_format``  – one of ``'latex'``, ``'html'``,
          ``'markdown'``, ``'url'``
        * ``markdown_content`` – raw Markdown text
        * ``html_content``     – raw HTML text
        * ``latex_content``    – raw LaTeX text  *(if applicable)*
        * ``external_url``     – external link for ``'url'`` resources

    Returns
    -------
    dict
        ``{"content": <str>, "content_format": <str>}``

        Possible ``content_format`` values in the returned dict:
        ``'html'``, ``'markdown'``, ``'url'``, ``'plaintext'``.
    """
    fmt: str = getattr(resource, "content_format", "") or ""
    fmt = fmt.lower().strip()

    # ── latex ──────────────────────────────────────────────────────────────────
    if fmt == "latex":
        raw_latex: str = getattr(resource, "latex_content", "") or ""
        html = latex_to_html(raw_latex)
        return {
            "content": sanitize_html(html),
            "content_format": "html",
        }

    # ── html ───────────────────────────────────────────────────────────────────
    if fmt == "html":
        raw_html: str = getattr(resource, "html_content", "") or ""
        return {
            "content": sanitize_html(raw_html),
            "content_format": "html",
        }

    # ── markdown ───────────────────────────────────────────────────────────────
    if fmt == "markdown":
        markdown: str = getattr(resource, "markdown_content", "") or ""
        return {
            "content": markdown,
            "content_format": "markdown",
        }

    # ── url ────────────────────────────────────────────────────────────────────
    if fmt == "url":
        url: str = getattr(resource, "external_url", "") or ""
        return {
            "content": url,
            "content_format": "url",
        }

    # ── fallback ───────────────────────────────────────────────────────────────
    fallback: str = (
        getattr(resource, "markdown_content", None)
        or getattr(resource, "html_content", None)
        or ""
    )
    return {
        "content": fallback,
        "content_format": "plaintext",
    }
