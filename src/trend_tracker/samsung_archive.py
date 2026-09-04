"""Samsung Global Newsroom 반도체 카테고리 수집기."""

from __future__ import annotations

import time
from datetime import datetime, timedelta, timezone
from html.parser import HTMLParser
from urllib.request import Request, urlopen

from .rss import Article, DEFAULT_USER_AGENT, unique_by_url


ARCHIVE_URL = "https://news.samsung.com/global/category/products/semiconductors/page/{page}"


class _SamsungCategoryParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.items: list[dict[str, str]] = []
        self.item: dict[str, str] | None = None
        self.capture: str | None = None
        self.parts: list[str] = []

    @staticmethod
    def _classes(attrs: list[tuple[str, str | None]]) -> set[str]:
        return set((dict(attrs).get("class") or "").split())

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        classes = self._classes(attrs)
        values = dict(attrs)
        if tag == "a" and "category_item" in classes:
            self.item = {"url": values.get("href") or "", "title": "", "date": ""}
        elif self.item and tag == "p" and "category_title" in classes:
            self.capture, self.parts = "title", []
        elif self.item and tag == "p" and "category_data" in classes:
            self.capture, self.parts = "date", []

    def handle_data(self, data: str) -> None:
        if self.item and self.capture:
            self.parts.append(data)

    def handle_endtag(self, tag: str) -> None:
        if not self.item:
            return
        if tag == "p" and self.capture:
            self.item[self.capture] = " ".join("".join(self.parts).split())
            self.capture = None
        elif tag == "a":
            if self.item["url"] and self.item["title"] and self.item["date"]:
                self.items.append(self.item)
            self.item = None
            self.capture = None


def parse_samsung_category(html_text: str) -> list[Article]:
    parser = _SamsungCategoryParser()
    parser.feed(html_text)
    collected_at = datetime.now(timezone.utc).isoformat()
    articles: list[Article] = []
    for item in parser.items:
        try:
            published = datetime.strptime(item["date"], "%B %d, %Y").replace(tzinfo=timezone.utc)
        except ValueError:
            continue
        articles.append(
            Article(
                source_id="samsung",
                company="Samsung Electronics",
                title=item["title"],
                url=item["url"],
                published_at=published.isoformat(),
                summary="Official category: Semiconductors",
                collected_at=collected_at,
            )
        )
    return articles


def fetch_samsung_semiconductors(
    days: int = 180,
    max_pages: int = 5,
    request_interval_seconds: float = 0.5,
) -> list[Article]:
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    collected: list[Article] = []
    for page in range(1, max_pages + 1):
        request = Request(
            ARCHIVE_URL.format(page=page),
            headers={"User-Agent": DEFAULT_USER_AGENT},
        )
        with urlopen(request, timeout=20) as response:
            articles = parse_samsung_category(response.read().decode("utf-8", errors="replace"))
        if not articles:
            break
        dated = [a for a in articles if datetime.fromisoformat(a.published_at or "") >= cutoff]
        collected.extend(dated)
        if len(dated) < len(articles):
            break
        if page < max_pages:
            time.sleep(request_interval_seconds)
    return unique_by_url(collected)
