"""Micron 공식 기술 블로그 공개 검색 API 수집기."""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from urllib.request import Request, urlopen

from .rss import Article, DEFAULT_USER_AGENT, unique_by_url


SEARCH_URL = (
    "https://www.micron.com/content/micron/us/en/about/blog/"
    "_jcr_content.search.json/search"
)
TECHNOLOGY_TAG = "micron:document type-categories-subcategories/blog/technology"


def _parse_date(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)


def fetch_micron_technology(days: int = 180, max_results: int = 100) -> list[Article]:
    """Micron Technology 분류의 최근 게시물을 반환한다."""

    payload = {
        "filters": {"contentType": [TECHNOLOGY_TAG]},
        "locale": "en_US",
        "searchText": "",
        "numOfResult": max_results,
        "startOffset": 0,
        "sortBy": "Date",
    }
    request = Request(
        SEARCH_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "User-Agent": DEFAULT_USER_AGENT,
            "Content-Type": "application/json",
        },
    )
    with urlopen(request, timeout=30) as response:
        data = json.load(response)

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    collected_at = datetime.now(timezone.utc).isoformat()
    articles: list[Article] = []
    for row in data.get("searchResults", {}).get("docs", []):
        date_value = row.get("modifieddate") or row.get("creationdate")
        title = row.get("title_en") or ""
        url = row.get("pageurl") or ""
        if not date_value or not title or not url:
            continue
        published = _parse_date(date_value)
        if published < cutoff:
            continue
        articles.append(
            Article(
                source_id="micron",
                company="Micron",
                title=title.strip(),
                url=url,
                published_at=published.isoformat(),
                summary=(row.get("description_en") or "").strip(),
                collected_at=collected_at,
            )
        )
    return unique_by_url(articles)
