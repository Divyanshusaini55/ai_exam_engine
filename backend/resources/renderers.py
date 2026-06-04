
from __future__ import annotations

import subprocess
from typing import TYPE_CHECKING

import bleach

if TYPE_CHECKING:
    from quiz.models import TopicResource  


_ALLOWED_TAGS: list[str] = [
    "p", "h1", "h2", "h3", "h4", "h5", "h6",
    "ul", "ol", "li",
    "strong", "em",
    "code", "pre",
    "blockquote",
    "table", "thead", "tbody", "tr", "th", "td",
    "a", "img",
    "div", "span",
    "br", "hr",
    "math", "mrow", "mi", "mo", "mn",
    "msup", "msub", "mfrac", "msqrt",
]

_ALLOWED_ATTRIBUTES: dict[str, list[str]] = {
    "*":   ["class", "id"],
    "a":   ["href", "target"],
    "img": ["src", "alt"],
}


def latex_to_html(latex_content: str) -> str:
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



def sanitize_html(html_content: str) -> str:
    return bleach.clean(
        html_content,
        tags=_ALLOWED_TAGS,
        attributes=_ALLOWED_ATTRIBUTES,
        strip=True,    
        strip_comments=True,
    )

def get_renderable_content(resource) -> dict:
    fmt: str = getattr(resource, "content_format", "") or ""
    fmt = fmt.lower().strip()

    if fmt == "latex":
        raw_latex: str = getattr(resource, "latex_content", "") or ""
        html = latex_to_html(raw_latex)
        return {
            "content": sanitize_html(html),
            "content_format": "html",
        }

    if fmt == "html":
        raw_html: str = getattr(resource, "html_content", "") or ""
        return {
            "content": sanitize_html(raw_html),
            "content_format": "html",
        }

    if fmt == "markdown":
        markdown: str = getattr(resource, "markdown_content", "") or ""
        return {
            "content": markdown,
            "content_format": "markdown",
        }

    if fmt == "url":
        url: str = getattr(resource, "external_url", "") or ""
        return {
            "content": url,
            "content_format": "url",
        }

    fallback: str = (
        getattr(resource, "markdown_content", None)
        or getattr(resource, "html_content", None)
        or ""
    )
    return {
        "content": fallback,
        "content_format": "plaintext",
    }
