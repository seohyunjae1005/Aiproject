"""우선순위 기업의 최신 뉴스를 한 번에 수집하고 통합한다."""

from __future__ import annotations

import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
COLLECTORS = (
    PROJECT_ROOT / "scripts" / "fetch_samsung_news.py",
    PROJECT_ROOT / "scripts" / "fetch_skhynix_news.py",
    PROJECT_ROOT / "scripts" / "fetch_kioxia_news.py",
    PROJECT_ROOT / "scripts" / "fetch_micron_news.py",
    PROJECT_ROOT / "scripts" / "fetch_tsmc_news.py",
    PROJECT_ROOT / "scripts" / "fetch_intel_news.py",
    PROJECT_ROOT / "scripts" / "fetch_asml_news.py",
    PROJECT_ROOT / "scripts" / "fetch_applied_materials_news.py",
    PROJECT_ROOT / "scripts" / "fetch_lam_research_news.py",
    PROJECT_ROOT / "scripts" / "fetch_tokyo_electron_news.py",
    PROJECT_ROOT / "scripts" / "fetch_kla_news.py",
)
INPUT_PATHS = (
    PROJECT_ROOT / "data" / "processed" / "samsung_semiconductor.json",
    PROJECT_ROOT / "data" / "processed" / "sk_hynix_semiconductor.json",
    PROJECT_ROOT / "data" / "processed" / "kioxia_semiconductor.json",
    PROJECT_ROOT / "data" / "processed" / "micron_semiconductor.json",
    PROJECT_ROOT / "data" / "processed" / "tsmc_semiconductor.json",
    PROJECT_ROOT / "data" / "processed" / "intel_semiconductor.json",
    PROJECT_ROOT / "data" / "processed" / "asml_semiconductor.json",
    PROJECT_ROOT / "data" / "processed" / "applied_materials_semiconductor.json",
    PROJECT_ROOT / "data" / "processed" / "lam_research_semiconductor.json",
    PROJECT_ROOT / "data" / "processed" / "tokyo_electron_semiconductor.json",
    PROJECT_ROOT / "data" / "processed" / "kla_semiconductor.json",
)
COMPANIES = (
    "Samsung Electronics",
    "SK hynix",
    "Kioxia",
    "Micron",
    "TSMC",
    "Intel",
    "ASML",
    "Applied Materials",
    "Lam Research",
    "Tokyo Electron",
    "KLA",
)
OUTPUT_PATH = PROJECT_ROOT / "data" / "processed" / "latest_semiconductor_news.json"
PUBLISHED_PATH = PROJECT_ROOT / "docs" / "data" / "latest.json"


def _published_sort_value(article: dict) -> str:
    return article.get("published_at") or ""


def main() -> None:
    print("=== 우선순위 기업 최신 뉴스 수집 시작 ===")
    published_by_company: dict[str, list[dict]] = {}
    if PUBLISHED_PATH.exists():
        try:
            previous_payload = json.loads(PUBLISHED_PATH.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            previous_payload = {}
            print("경고: 직전 공개자료가 완전한 JSON이 아니어서 캐시로 사용하지 않습니다.")
        for row in previous_payload.get("articles", []):
            company = row.get("company", "Unknown")
            published_by_company.setdefault(company, []).append(row)

    collection_status: dict[str, str] = {}
    for collector, output_path, company in zip(COLLECTORS, INPUT_PATHS, COMPANIES):
        print(f"\n[{collector.stem}]")
        result = subprocess.run(
            [sys.executable, str(collector)], cwd=PROJECT_ROOT, check=False
        )
        if result.returncode == 0:
            collection_status[collector.stem] = "updated"
        elif output_path.exists():
            collection_status[collector.stem] = "cached_after_error"
            print(
                f"경고: 새 수집에 실패해 기존 저장자료를 사용합니다: {output_path.name}"
            )
        elif published_by_company.get(company):
            fallback_rows = published_by_company[company]
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output_path.write_text(
                json.dumps(fallback_rows, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            collection_status[collector.stem] = "published_cache_after_error"
            print(
                f"경고: 새 수집에 실패해 직전 공개자료 {len(fallback_rows)}건을 사용합니다."
            )
        else:
            collection_status[collector.stem] = "unavailable"
            print("경고: 새 수집에 실패했고 기존 저장자료도 없어 이번 통합에서 제외합니다.")

    combined: list[dict] = []
    seen_urls: set[str] = set()
    seen_company_titles: set[tuple[str, str]] = set()
    company_counts: dict[str, int] = {}
    for path in INPUT_PATHS:
        if not path.exists():
            continue
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
        "collection_status": collection_status,
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
    print(f"수집 상태: {collection_status}")
    print(f"저장 위치: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
