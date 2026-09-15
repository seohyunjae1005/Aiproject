"""본문 3건을 AI에 전달하기 전 검토 가능한 요청 파일로 만든다."""

from __future__ import annotations

import json
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SRC = PROJECT_ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from trend_tracker.analysis_schema import ANALYSIS_VERSION, build_analysis_prompt


BODY_PATH = PROJECT_ROOT / "runtime" / "article_bodies.json"
ARTICLE_PATH = PROJECT_ROOT / "docs" / "data" / "latest.json"
OUTPUT_PATH = PROJECT_ROOT / "runtime" / "analysis_requests.json"
CACHE_PATH = PROJECT_ROOT / "data" / "analysis" / "validated_cache.json"
SOURCE_QUALITY = {
    "official_feed_summary": 1,
    "filtered_html_blocks": 2,
    "json_ld_article_body": 2,
}


def load_validated_cache() -> dict:
    if not CACHE_PATH.exists():
        return {}
    try:
        payload = json.loads(CACHE_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}
    return payload.get("companies") if isinstance(payload.get("companies"), dict) else {}


def can_reuse_cached_analysis(cached: dict | None, url: str, method: str) -> bool:
    """같은 기사·분석 버전에서 현재 근거보다 같거나 좋은 결과면 재호출하지 않는다."""
    if not isinstance(cached, dict):
        return False
    if cached.get("validation_status") != "PASS":
        return False
    if cached.get("url") != url or cached.get("analysis_version") != ANALYSIS_VERSION:
        return False
    cached_quality = SOURCE_QUALITY.get(str(cached.get("extraction_method")), 0)
    current_quality = SOURCE_QUALITY.get(method, 0)
    return cached_quality >= current_quality


def main() -> None:
    if not BODY_PATH.exists():
        raise SystemExit("먼저 extract_article_bodies.py를 실행하세요.")

    bodies = json.loads(BODY_PATH.read_text(encoding="utf-8"))
    payload = json.loads(ARTICLE_PATH.read_text(encoding="utf-8"))
    articles_by_url = {
        str(article.get("url") or ""): article
        for article in payload.get("articles", [])
    }
    cached_by_company = load_validated_cache()

    requests: list[dict] = []
    reused: list[str] = []
    for body_row in bodies:
        url = str(body_row.get("url") or "")
        article = articles_by_url.get(url)
        body = str(body_row.get("body") or "").strip()
        if not article or len(body) < 300:
            continue
        extraction_method = str(body_row.get("extraction_method") or "unknown")
        company = str(article.get("company") or "")
        if can_reuse_cached_analysis(
            cached_by_company.get(company), url, extraction_method
        ):
            reused.append(company)
            continue
        article_context = dict(article)
        article_context["analysis_input_scope"] = extraction_method
        prompt = build_analysis_prompt(article_context, body)
        requests.append(
            {
                "analysis_version": ANALYSIS_VERSION,
                "company": article.get("company"),
                "title": article.get("title"),
                "url": url,
                "extraction_method": extraction_method,
                "body_character_count": len(body),
                "prompt_character_count": len(prompt),
                "prompt": prompt,
            }
        )

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(requests, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print("=== AI 분석 요청 준비 완료 ===")
    for row in requests:
        print(
            f"- {row['company']}: 본문 {row['body_character_count']}자 / "
            f"전체 요청 {row['prompt_character_count']}자"
        )
    if reused:
        print(f"- 기존 검증 결과 재사용: {', '.join(reused)}")
    print(f"- 신규 API 요청: {len(requests)}건")
    print(f"저장: {OUTPUT_PATH}")
    print("이 단계에서는 AI API를 호출하지 않았으므로 비용은 0원입니다.")


if __name__ == "__main__":
    main()
