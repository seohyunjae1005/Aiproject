"""SK hynix TECH&AI 기사를 최근 6개월 범위로 최초 적재한다."""

from __future__ import annotations

import json
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SRC = PROJECT_ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from trend_tracker.skhynix_archive import fetch_tech_archive


OUTPUT_PATH = PROJECT_ROOT / "data" / "raw" / "sk_hynix_history.json"


def main() -> None:
    articles = fetch_tech_archive(days=180)
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps([article.to_dict() for article in articles], ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print("수집 범위: 최근 180일 (TECH&AI 공식 목록)")
    print(f"과거 기사 수집: {len(articles)}건")
    print(f"저장 위치: {OUTPUT_PATH}")
    if articles:
        print(f"최신 기사: {articles[0].published_at} | {articles[0].title}")
        print(f"가장 오래된 기사: {articles[-1].published_at} | {articles[-1].title}")


if __name__ == "__main__":
    main()
