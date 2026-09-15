"""검증 통과한 AI 분석만 회사별 캐시에 안전하게 병합한다.

기사 본문과 프롬프트는 저장하지 않으며, 실패한 새 실행이 기존 성공 결과를
지우지 않게 한다. 이 캐시는 기계 검증 단계이며 홈페이지 공개 승인을 뜻하지 않는다.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
RESULT_PATH = PROJECT_ROOT / "runtime" / "analysis_results.json"
CACHE_PATH = PROJECT_ROOT / "data" / "analysis" / "validated_cache.json"
REPORT_PATH = PROJECT_ROOT / "runtime" / "analysis_cache_update.md"
CACHE_VERSION = "validated_analysis_cache_v1"
SOURCE_QUALITY = {
    "official_index_metadata": 0,
    "official_feed_summary": 1,
    "filtered_html_blocks": 2,
    "json_ld_article_body": 2,
}


def empty_cache() -> dict:
    return {
        "schema_version": CACHE_VERSION,
        "updated_at": None,
        "review_notice": (
            "Machine-validated draft cache. Human approval is required before publication."
        ),
        "companies": {},
    }


def load_cache(path: Path = CACHE_PATH) -> dict:
    if not path.exists():
        return empty_cache()
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return empty_cache()
    if not isinstance(payload, dict) or not isinstance(payload.get("companies"), dict):
        return empty_cache()
    payload["schema_version"] = CACHE_VERSION
    payload.setdefault(
        "review_notice",
        "Machine-validated draft cache. Human approval is required before publication.",
    )
    return payload


def safe_entry(row: dict) -> dict | None:
    """본문·프롬프트 없이 공개 기사 분석 결과에 필요한 필드만 선택한다."""

    if row.get("validation_status") != "PASS" or not isinstance(row.get("analysis"), dict):
        return None
    company = str(row.get("company") or "").strip()
    url = str(row.get("url") or "").strip()
    if not company or not url:
        return None
    method = str(row.get("extraction_method") or "unknown")
    return {
        "company": company,
        "title": str(row.get("title") or ""),
        "url": url,
        "model": str(row.get("model") or ""),
        "generated_at": row.get("generated_at"),
        "analysis_version": row["analysis"].get("analysis_version"),
        "extraction_method": method,
        "source_scope": {
            "official_index_metadata": "official_index_metadata",
            "official_feed_summary": "official_summary",
        }.get(method, "official_article_body"),
        "validation_status": "PASS",
        "review_status": "machine_validated",
        "publish_ready": False,
        "normalization_notes": list(row.get("normalization_notes") or []),
        "analysis": row["analysis"],
    }


def should_replace(current: dict | None, candidate: dict) -> bool:
    if not current:
        return True
    if current.get("url") != candidate.get("url"):
        return True
    if current.get("analysis_version") != candidate.get("analysis_version"):
        return True
    old_quality = SOURCE_QUALITY.get(str(current.get("extraction_method")), 0)
    new_quality = SOURCE_QUALITY.get(str(candidate.get("extraction_method")), 0)
    return new_quality > old_quality


def merge_results(cache: dict, results: list[dict], now: str) -> tuple[dict, list[str], list[str]]:
    companies = cache.setdefault("companies", {})
    updated: list[str] = []
    retained: list[str] = []

    for row in results:
        company = str(row.get("company") or "Unknown")
        candidate = safe_entry(row)
        if candidate is None:
            if company in companies:
                retained.append(company)
            continue
        current = companies.get(company)
        if should_replace(current, candidate):
            companies[company] = candidate
            updated.append(company)
        else:
            retained.append(company)

    if updated:
        cache["updated_at"] = now
    cache["company_count"] = len(companies)
    return cache, sorted(set(updated)), sorted(set(retained))


def write_report(updated: list[str], retained: list[str], cache: dict) -> None:
    lines = [
        "# AI 분석 캐시 갱신 결과",
        "",
        f"- 보관 회사: {cache.get('company_count', 0)}개",
        f"- 신규·교체: {', '.join(updated) if updated else '없음'}",
        f"- 기존 결과 유지: {', '.join(retained) if retained else '없음'}",
        "- 공개 상태: 사람 검토 전 비공개",
        "",
        "> 실패한 분석은 기존 PASS 결과를 삭제하거나 덮어쓰지 않습니다.",
    ]
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    if not RESULT_PATH.exists():
        raise SystemExit("runtime/analysis_results.json이 없습니다.")
    results = json.loads(RESULT_PATH.read_text(encoding="utf-8"))
    if not isinstance(results, list):
        raise SystemExit("분석 결과 형식이 목록이 아닙니다.")

    now = datetime.now(timezone.utc).isoformat()
    cache, updated, retained = merge_results(load_cache(), results, now)
    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    CACHE_PATH.write_text(
        json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    write_report(updated, retained, cache)
    print("=== AI 분석 캐시 갱신 완료 ===")
    print(f"보관 회사: {cache.get('company_count', 0)}개")
    print(f"신규·교체: {', '.join(updated) if updated else '없음'}")
    print(f"기존 유지: {', '.join(retained) if retained else '없음'}")
    print(f"저장: {CACHE_PATH}")


if __name__ == "__main__":
    main()
