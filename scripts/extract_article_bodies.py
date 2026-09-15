"""주요 기업별 최근 핵심 기술 기사 한 건의 본문을 시험 추출한다."""

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
TARGET_COMPANIES = (
    "Samsung Electronics",
    "SK hynix",
    "Micron",
    "Kioxia",
    "TSMC",
    "Intel",
    "ASML",
    "Applied Materials",
    "Lam Research",
    "Tokyo Electron",
    "KLA",
)

TECHNICAL_TITLE_TERMS = (
    "process",
    "technology",
    "manufacturing",
    "production",
    "fab",
    "foundry",
    "wafer",
    "yield",
    "memory",
    "dram",
    "nand",
    "hbm",
    "packaging",
    "bonding",
    "lithography",
    "euv",
    "etch",
    "deposition",
    "metrology",
    "inspection",
    "transistor",
    "node",
    "equipment",
)

LOW_PRIORITY_TITLE_TERMS = (
    "dividend",
    "quarterly results",
    "financial results",
    "appoints",
    "appointment",
    "award",
    "conference participation",
)

MAX_CANDIDATES_PER_COMPANY = 5
DEFAULT_TIMEOUT_SECONDS = 25
COMPANY_TIMEOUT_SECONDS = {
    # 아래 사이트들은 GitHub Actions 환경에서 응답이 느리거나 일시적으로
    # 접근을 거부하는 경우가 있어 다른 회사보다 조금 더 기다린다.
    "TSMC": 35,
    "Intel": 35,
    "Applied Materials": 45,
}


def technical_priority(article: dict) -> int:
    """최근 기사 안에서 취업·현업에 유용한 기술 발표를 먼저 고른다."""

    title = str(article.get("title") or "").casefold()
    score = sum(4 for term in TECHNICAL_TITLE_TERMS if term in title)
    score -= sum(8 for term in LOW_PRIORITY_TITLE_TERMS if term in title)
    score += min(len(article.get("matched_keywords") or []), 6) * 2
    score += min(len(article.get("tech_domains") or []), 4)
    score += min(len(article.get("job_roles") or []), 4)
    return score


def priority_candidates(articles: list[dict]) -> dict[str, list[dict]]:
    selected: dict[str, list[dict]] = {}
    for company in TARGET_COMPANIES:
        recent_high = [
            article
            for article in articles
            if article.get("company") == company
            and article.get("relevance") == "high"
        ][:10]
        selected[company] = sorted(
            recent_high,
            key=technical_priority,
            reverse=True,
        )[:MAX_CANDIDATES_PER_COMPANY]
    return selected


def console_safe(value: str) -> str:
    """Windows 기본 콘솔에서 표시할 수 없는 문자만 안전하게 바꾼다."""

    encoding = sys.stdout.encoding or "utf-8"
    return value.encode(encoding, errors="replace").decode(encoding)


def main() -> None:
    payload = json.loads(INPUT_PATH.read_text(encoding="utf-8"))
    candidates = priority_candidates(payload.get("articles", []))
    results: list[dict] = []

    print("=== 3주차 본문 추출 시험 ===")
    for company, company_candidates in candidates.items():
        timeout = COMPANY_TIMEOUT_SECONDS.get(company, DEFAULT_TIMEOUT_SECONDS)
        for attempt, article in enumerate(company_candidates, start=1):
            try:
                extracted = fetch_article_body(article, timeout=timeout)
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
            print(f"  기사: {console_safe(row['title'])}")
            print(f"  미리보기: {console_safe(preview)}...")
            break
        else:
            print(
                f"[실패] {company}: 기술 우선 후보 "
                f"{len(company_candidates)}건에서 본문을 얻지 못했습니다."
            )

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"저장: {OUTPUT_PATH}")
    print(f"성공: {len(results)}/{len(TARGET_COMPANIES)}개사")


if __name__ == "__main__":
    main()
