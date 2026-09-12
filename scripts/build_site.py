"""통합 수집 결과를 GitHub Pages가 읽을 공개 데이터로 복사한다."""

from __future__ import annotations

import hashlib
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
TRANSLATION_CACHE_PATH = PROJECT_ROOT / "data" / "translations" / "ko.json"


def _translation_cache() -> dict:
    if not TRANSLATION_CACHE_PATH.exists():
        return {}
    try:
        payload = json.loads(TRANSLATION_CACHE_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        print("경고: 번역 캐시가 손상되어 원문만 게시합니다.")
        return {}
    return payload.get("translations") or {}


def _fingerprint(article: dict) -> str:
    title = str(article.get("title") or "").strip()
    summary = str(article.get("summary") or "").strip()
    return hashlib.sha256(f"{title}\n{summary}".encode("utf-8")).hexdigest()


def main() -> None:
    if not INPUT_PATH.exists():
        raise SystemExit("통합 데이터가 없습니다. 먼저 run_daily_collection.py를 실행하세요.")

    payload = json.loads(INPUT_PATH.read_text(encoding="utf-8"))
    translations = _translation_cache()
    published_articles: list[dict] = []
    translated_count = 0
    for article in payload.get("articles", []):
        enriched = enrich_article(article)
        translated = translations.get(str(article.get("url") or ""))
        if (
            translated
            and translated.get("source_fingerprint") == _fingerprint(article)
            and translated.get("title_ko")
        ):
            enriched["title_ko"] = translated["title_ko"]
            enriched["summary_ko"] = translated.get("summary_ko") or ""
            enriched["translation_provider"] = "DeepL"
            translated_count += 1
        published_articles.append(enriched)
    payload["articles"] = published_articles
    payload["article_count"] = len(payload["articles"])
    payload["filter_options"] = {
        "job_roles": list(JOB_ROLE_ORDER),
        "tech_domains": list(TECH_DOMAIN_ORDER),
        "signal_types": list(SIGNAL_TYPE_ORDER),
    }
    payload["translation"] = {
        "target_language": "ko",
        "provider": "DeepL",
        "translated_count": translated_count,
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
