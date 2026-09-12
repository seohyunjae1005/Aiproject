"""KLA 공식 보도자료와 KLA Advance 기술 콘텐츠 수집기."""

from __future__ import annotations

import re
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from html import unescape
from html.parser import HTMLParser
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from xml.etree import ElementTree

from .rss import Article, unique_by_url


IR_URL = "https://ir.kla.com/news-events/press-releases"
POST_SITEMAP_URL = "https://www.kla.com/post-sitemap.xml"
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"
)
TECH_KEYWORDS = (
    "semiconductor",
    "process control",
    "inspection",
    "metrology",
    "defect",
    "yield",
    "wafer",
    "reticle",
    "mask",
    "euv",
    "lithography",
    "overlay",
    "patterning",
    "film",
    "critical dimension",
    "advanced packaging",
    "ic substrate",
    "interposer",
    "plasma dicing",
    "fab",
    "fabrication",
    "logic",
    "dram",
    "nand",
)


class _MetaParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.title = ""
        self.description = ""
        self.published = ""

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag != "meta":
            return
        values = {key: value or "" for key, value in attrs}
        name = (values.get("property") or values.get("name") or "").casefold()
        content = values.get("content", "")
        if name == "og:title" and not self.title:
            self.title = content
        elif name in {"og:description", "description"} and not self.description:
            self.description = content
        elif name == "article:published_time" and not self.published:
            self.published = content


def _request(url: str, timeout: int = 30) -> bytes:
    request = Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        },
    )
    with urlopen(request, timeout=timeout) as response:
        return response.read()


def _clean_html(value: str) -> str:
    return " ".join(unescape(re.sub(r"<[^>]+>", " ", value)).split())


def _ir_articles(cutoff: datetime, collected_at: str) -> list[tuple[Article, str]]:
    html = _request(IR_URL).decode("utf-8", errors="replace")
    pattern = re.compile(
        r'<article\s+class="media"[^>]*>.*?'
        r'<time\s+datetime="([^"]+)"[^>]*>.*?</time>.*?'
        r'<h2\s+class="media-heading"[^>]*>\s*'
        r'<a\s+href="([^"]+)"[^>]*>(.*?)</a>',
        flags=re.I | re.S,
    )
    rows: list[tuple[Article, str]] = []
    for date_text, url, raw_title in pattern.findall(html):
        try:
            published = datetime.fromisoformat(date_text.replace("Z", "+00:00"))
        except ValueError:
            continue
        if published.tzinfo is None:
            published = published.replace(tzinfo=timezone.utc)
        published = published.astimezone(timezone.utc)
        if published < cutoff:
            continue
        rows.append(
            (
                Article(
                    source_id="kla",
                    company="KLA",
                    title=_clean_html(raw_title),
                    url=unescape(url),
                    published_at=published.isoformat(),
                    summary="Official KLA press release",
                    collected_at=collected_at,
                ),
                "Press release",
            )
        )
    return rows


def _advance_urls(cutoff: datetime) -> list[str]:
    namespaces = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    root = ElementTree.fromstring(_request(POST_SITEMAP_URL))
    urls: list[str] = []
    for item in root.findall("sm:url", namespaces):
        url = item.findtext("sm:loc", default="", namespaces=namespaces)
        modified_text = item.findtext("sm:lastmod", default="", namespaces=namespaces)
        if not url.startswith("https://www.kla.com/advance/"):
            continue
        try:
            modified = datetime.fromisoformat(modified_text.replace("Z", "+00:00"))
        except ValueError:
            continue
        if modified.tzinfo is None:
            modified = modified.replace(tzinfo=timezone.utc)
        if modified.astimezone(timezone.utc) >= cutoff:
            urls.append(url)
    return list(dict.fromkeys(urls))


def _advance_page(url: str) -> tuple[str, str, datetime | None]:
    try:
        html = _request(url, timeout=20).decode("utf-8", errors="replace")
    except (HTTPError, URLError, TimeoutError):
        return "", "", None
    parser = _MetaParser()
    parser.feed(html)
    try:
        published = datetime.fromisoformat(parser.published.replace("Z", "+00:00"))
    except ValueError:
        published = None
    if published is not None and published.tzinfo is None:
        published = published.replace(tzinfo=timezone.utc)
    return (
        unescape(parser.title).removesuffix(" - KLA").strip(),
        unescape(parser.description).strip(),
        published.astimezone(timezone.utc) if published else None,
    )


def _advance_articles(cutoff: datetime, collected_at: str) -> list[tuple[Article, str]]:
    urls = _advance_urls(cutoff)
    with ThreadPoolExecutor(max_workers=8) as executor:
        page_rows = list(executor.map(_advance_page, urls))
    rows: list[tuple[Article, str]] = []
    for url, (title, description, published) in zip(urls, page_rows):
        if not title or published is None or published < cutoff:
            continue
        category = "Innovation" if "/advance/innovation/" in url else "KLA Advance"
        rows.append(
            (
                Article(
                    source_id="kla",
                    company="KLA",
                    title=title,
                    url=url,
                    published_at=published.isoformat(),
                    summary=description or f"Official KLA {category} article",
                    collected_at=collected_at,
                ),
                category,
            )
        )
    return rows


def _keyword_matches(article: Article) -> list[str]:
    text = f"{article.title} {article.summary}".casefold()
    return [keyword for keyword in TECH_KEYWORDS if keyword in text]


def fetch_kla_news(
    days: int = 180,
) -> list[tuple[Article, list[str], str, str]]:
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    collected_at = datetime.now(timezone.utc).isoformat()
    collected = [
        *_ir_articles(cutoff, collected_at),
        *_advance_articles(cutoff, collected_at),
    ]
    enriched: list[tuple[Article, list[str], str, str]] = []
    for article, source_category in collected:
        matches = _keyword_matches(article)
        relevance = "high" if source_category == "Innovation" or matches else "context"
        enriched.append((article, matches, source_category, relevance))

    unique = unique_by_url(article for article, *_ in enriched)
    metadata = {
        article.url: (matches, source_category, relevance)
        for article, matches, source_category, relevance in enriched
    }
    return [
        (article, *metadata[article.url])
        for article in sorted(
            unique, key=lambda value: value.published_at or "", reverse=True
        )
    ]
