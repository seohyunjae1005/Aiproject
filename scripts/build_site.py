"""통합 수집 결과를 GitHub Pages가 읽을 공개 데이터로 복사한다."""

from __future__ import annotations

import json
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SRC = PROJECT_ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from trend_tracker.classification import (
    JOB_ROLE_ORDER,
    SIGNAL_TYPE_ORDER,
    TECH_DOMAIN_ORDER,
    enrich_article,
)

INPUT_PATH = PROJECT_ROOT / "data" / "processed" / "latest_semiconductor_news.json"
OUTPUT_PATH = PROJECT_ROOT / "docs" / "data" / "latest.json"


def main() -> None:
    if not INPUT_PATH.exists():
        raise SystemExit("통합 데이터가 없습니다. 먼저 run_daily_collection.py를 실행하세요.")

    payload = json.loads(INPUT_PATH.read_text(encoding="utf-8"))
    payload["articles"] = [
        enrich_article(article) for article in payload.get("articles", [])
    ]
    payload["article_count"] = len(payload["articles"])
    payload["filter_options"] = {
        "job_roles": list(JOB_ROLE_ORDER),
        "tech_domains": list(TECH_DOMAIN_ORDER),
        "signal_types": list(SIGNAL_TYPE_ORDER),
    }
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"웹 데이터 생성: {payload.get('article_count', 0)}건")
    print(f"저장 위치: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
