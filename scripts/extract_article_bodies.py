"""우선순위 기업별 최신 핵심 기사 한 건의 본문을 시험 추출한다."""

from __future__ import annotations

import json
import sys
from http.client import RemoteDisconnected
from pathlib import Path
from urllib.error import HTTPError, URLError


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SRC = PROJECT_ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from trend_tracker.article_body import fetch_article_body


INPUT_PATH = PROJECT_ROOT / "docs" / "data" / "latest.json"
OUTPUT_PATH = PROJECT_ROOT / "runtime" / "article_bodies.json"
TARGET_COMPANIES = ("Samsung Electronics", "SK hynix", "ASML")


def priority_candidates(articles: list[dict]) -> dict[str, list[dict]]:
    selected: dict[str, list[dict]] = {}
    for company in TARGET_COMPANIES:
        selected[company] = [
            article
            for article in articles
            if article.get("company") == company
            and article.get("relevance") == "high"
        ][:2]
    return selected


def main() -> None:
    payload = json.loads(INPUT_PATH.read_text(encoding="utf-8"))
    candidates = priority_candidates(payload.get("articles", []))
    results: list[dict] = []

    print("=== 3주차 본문 추출 시험 ===")
    for company, company_candidates in candidates.items():
        for attempt, article in enumerate(company_candidates, start=1):
            try:
                extracted = fetch_article_body(article, timeout=15)
            except (
                HTTPError,
                URLError,
                TimeoutError,
                RemoteDisconnected,
                ValueError,
                RuntimeError,
            ) as error:
                print(f"[재시도 {attempt}] {company}: {type(error).__name__}")
                continue
            row = extracted.to_dict()
            results.append(row)
            preview = row["body"][:180].replace("\n", " ")
            print(
                f"[성공] {company}: {row['character_count']}자 / "
                f"{row['extraction_method']}"
            )
            print(f"  기사: {row['title']}")
            print(f"  미리보기: {preview}...")
            break
        else:
            print(f"[실패] {company}: 최신 핵심 기사 2건에서 본문을 얻지 못했습니다.")

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"저장: {OUTPUT_PATH}")
    print(f"성공: {len(results)}/{len(TARGET_COMPANIES)}개사")


if __name__ == "__main__":
    main()
