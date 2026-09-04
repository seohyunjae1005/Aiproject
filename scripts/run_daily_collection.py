"""우선순위 기업의 최신 뉴스를 한 번에 수집하고 통합한다."""

from __future__ import annotations

import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
COLLECTORS = (
    PROJECT_ROOT / "scripts" / "fetch_samsung_rss.py",
    PROJECT_ROOT / "scripts" / "fetch_skhynix_rss.py",
    PROJECT_ROOT / "scripts" / "fetch_kioxia_news.py",
    PROJECT_ROOT / "scripts" / "fetch_micron_news.py",
)
INPUT_PATHS = (
    PROJECT_ROOT / "data" / "processed" / "samsung_semiconductor.json",
    PROJECT_ROOT / "data" / "processed" / "sk_hynix_semiconductor.json",
    PROJECT_ROOT / "data" / "processed" / "kioxia_semiconductor.json",
    PROJECT_ROOT / "data" / "processed" / "micron_semiconductor.json",
)
OUTPUT_PATH = PROJECT_ROOT / "data" / "processed" / "latest_semiconductor_news.json"


def _published_sort_value(article: dict) -> str:
    return article.get("published_at") or ""


def main() -> None:
    print("=== 우선순위 기업 최신 뉴스 수집 시작 ===")
    for collector in COLLECTORS:
        print(f"\n[{collector.stem}]")
        subprocess.run([sys.executable, str(collector)], cwd=PROJECT_ROOT, check=True)

    combined: list[dict] = []
    seen_urls: set[str] = set()
    seen_company_titles: set[tuple[str, str]] = set()
    company_counts: dict[str, int] = {}
    for path in INPUT_PATHS:
        rows = json.loads(path.read_text(encoding="utf-8"))
        for row in rows:
            url = row.get("url", "")
            company = row.get("company", "Unknown")
            normalized_title = " ".join(row.get("title", "").casefold().split())
            title_key = (company, normalized_title)
            if not url or url in seen_urls or title_key in seen_company_titles:
                continue
            seen_urls.add(url)
            seen_company_titles.add(title_key)
            combined.append(row)
            company_counts[company] = company_counts.get(company, 0) + 1

    combined.sort(key=_published_sort_value, reverse=True)
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "article_count": len(combined),
        "company_counts": company_counts,
        "articles": combined,
    }
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print("\n=== 통합 완료 ===")
    print(f"기업별 후보: {company_counts}")
    print(f"통합 기사: {len(combined)}건")
    print(f"저장 위치: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
