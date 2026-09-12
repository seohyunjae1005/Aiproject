"""Lam Research 공식 보도자료 수집기."""

from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from html import unescape
from urllib.request import Request, urlopen

from .rss import Article, unique_by_url


NEWS_URL = "https://newsroom.lamresearch.com/press-releases?l=100"
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"
)
TECH_KEYWORDS = (
    "semiconductor",
    "wafer",
    "fab",
    "fabrication",
    "etch",
    "deposition",
    "cleaning",
    "dry resist",
    "photoresist",
    "euv",
    "high na",
    "logic",
    "sub-1nm",
    "gate-all-around",
    "gaa",
    "nand",
    "dram",
    "hbm",
    "advanced packaging",
    "panel-level",
    "chiplet",
    "metrology",
    "process",
    "materials",
    "yield",
)


def _clean_html(value: str) -> str:
    return " ".join(unescape(re.sub(r"<[^>]+>", " ", value)).split())


def _request(timeout: int = 30) -> str:
    request = Request(
        NEWS_URL,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml",
            "Accept-Language": "en-US,en;q=0.9",
        },
    )
    with urlopen(request, timeout=timeout) as response:
        return response.read().decode("utf-8", errors="replace")


def _parse_news(html: str) -> list[tuple[str, str, str, str]]:
    rows: list[tuple[str, str, str, str]] = []
    blocks = re.findall(
        r'<li\s+class="wd_item"[^>]*>(.*?)</li>', html, flags=re.I | re.S
    )
    for block in blocks:
        title_match = re.search(
            r'<div\s+class="wd_title"[^>]*>\s*<a\s+href="([^"]+)"[^>]*>'
            r"(.*?)</a>",
            block,
            flags=re.I | re.S,
        )
        date_match = re.search(
            r'<div\s+class="wd_date"[^>]*>(.*?)</div>', block, flags=re.I | re.S
        )
        summary_match = re.search(
            r'<div\s+class="wd_summary"[^>]*>(.*?)</div>',
            block,
            flags=re.I | re.S,
        )
        if not title_match or not date_match:
            continue
        rows.append(
            (
                _clean_html(date_match.group(1)),
                _clean_html(title_match.group(2)),
                unescape(title_match.group(1)),
                _clean_html(summary_match.group(1)) if summary_match else "",
            )
        )
    return rows


def _keyword_matches(article: Article) -> list[str]:
    text = f"{article.title} {article.summary}".casefold()
    return [keyword for keyword in TECH_KEYWORDS if keyword in text]


def fetch_lam_research_news(
    days: int = 180,
) -> list[tuple[Article, list[str], str]]:
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    collected_at = datetime.now(timezone.utc).isoformat()
    collected: list[tuple[Article, list[str], str]] = []
    for date_text, title, url, summary in _parse_news(_request()):
        try:
            published = datetime.strptime(date_text, "%b %d, %Y").replace(
                tzinfo=timezone.utc
            )
        except ValueError:
            continue
        if published < cutoff:
            continue
        article = Article(
            source_id="lam_research",
            company="Lam Research",
            title=title,
            url=url,
            published_at=published.isoformat(),
            summary=summary or "Official Lam Research press release",
            collected_at=collected_at,
        )
        matches = _keyword_matches(article)
        collected.append((article, matches, "high" if matches else "context"))

    unique = unique_by_url(article for article, *_ in collected)
    metadata = {
        article.url: (matches, relevance)
        for article, matches, relevance in collected
    }
    return [
        (article, *metadata[article.url])
        for article in sorted(
            unique, key=lambda value: value.published_at or "", reverse=True
        )
    ]
