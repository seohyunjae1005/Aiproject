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


def main() -> None:
    if not BODY_PATH.exists():
        raise SystemExit("먼저 extract_article_bodies.py를 실행하세요.")

    bodies = json.loads(BODY_PATH.read_text(encoding="utf-8"))
    payload = json.loads(ARTICLE_PATH.read_text(encoding="utf-8"))
    articles_by_url = {
        str(article.get("url") or ""): article
        for article in payload.get("articles", [])
    }

    requests: list[dict] = []
    for body_row in bodies:
        url = str(body_row.get("url") or "")
        article = articles_by_url.get(url)
        body = str(body_row.get("body") or "").strip()
        if not article or len(body) < 300:
            continue
        extraction_method = str(body_row.get("extraction_method") or "unknown")
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
    print(f"저장: {OUTPUT_PATH}")
    print("아직 AI API를 호출하지 않았으므로 비용은 0원입니다.")


if __name__ == "__main__":
    main()
