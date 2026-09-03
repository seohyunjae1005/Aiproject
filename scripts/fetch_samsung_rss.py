"""삼성전자 Global Newsroom RSS를 가져오는 첫 번째 실행 프로그램."""

from __future__ import annotations

import json
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SRC = PROJECT_ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from trend_tracker.rss import fetch_rss, unique_by_url


RSS_URL = "https://news.samsung.com/global/feed/rss"
OUTPUT_PATH = PROJECT_ROOT / "data" / "raw" / "samsung.json"


def main() -> None:
    articles = unique_by_url(
        fetch_rss(
            RSS_URL,
            source_id="samsung",
            company="Samsung Electronics",
        )
    )
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps([article.to_dict() for article in articles], ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(f"수집 성공: {len(articles)}건")
    print(f"저장 위치: {OUTPUT_PATH}")
    for article in articles[:5]:
        print(f"- {article.published_at or '날짜 없음'} | {article.title}")


if __name__ == "__main__":
    main()

