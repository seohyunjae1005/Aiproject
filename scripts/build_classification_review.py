"""사람이 빠르게 확인할 수 있는 직무 분류 검토표를 만든다."""

from __future__ import annotations

import argparse
import csv
import json
import sys
from collections import defaultdict, deque
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SRC = PROJECT_ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from trend_tracker.classification import enrich_article


DEFAULT_INPUT = PROJECT_ROOT / "docs" / "data" / "latest.json"
DEFAULT_OUTPUT = PROJECT_ROOT / "review_outputs" / "classification_review.csv"
PROCESS_ROLE = "공정기술·양산기술"

FIELDNAMES = (
    "검토번호",
    "검토 필요 이유",
    "기업",
    "게시일",
    "한국어 제목",
    "영문 제목",
    "원문 링크",
    "중요도",
    "자동 공정 판정",
    "자동 기술 분야",
    "자동 관련 직무",
    "사람 공정 관련성",
    "사람 기술 분야 평가",
    "사람 관련 직무 평가",
    "한국어 제목 번역 품질",
    "오류 유형",
    "검토 메모",
)


def load_articles(path: Path) -> list[dict]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    articles = payload.get("articles")
    if not isinstance(articles, list):
        raise ValueError("입력 파일에서 articles 목록을 찾을 수 없습니다.")
    return [article for article in articles if isinstance(article, dict)]


def _published_key(article: dict) -> str:
    return str(article.get("published_at") or "")


def _round_robin_by_company(articles: list[dict], limit: int) -> list[dict]:
    """한 회사 기사만 몰리지 않도록 회사별로 한 건씩 번갈아 고른다."""
    groups: dict[str, deque[dict]] = defaultdict(deque)
    for article in sorted(articles, key=_published_key, reverse=True):
        groups[str(article.get("company") or "미상")].append(article)

    company_order = sorted(
        groups,
        key=lambda company: _published_key(groups[company][0]),
        reverse=True,
    )
    selected: list[dict] = []
    while company_order and len(selected) < limit:
        next_order: list[str] = []
        for company in company_order:
            if len(selected) >= limit:
                break
            selected.append(groups[company].popleft())
            if groups[company]:
                next_order.append(company)
        company_order = next_order
    return selected


def choose_review_sample(articles: list[dict], count: int) -> list[tuple[dict, str]]:
    enriched = [enrich_article(article) for article in articles]
    process = [row for row in enriched if PROCESS_ROLE in row.get("job_roles", [])]
    high_non_process = [
        row
        for row in enriched
        if PROCESS_ROLE not in row.get("job_roles", []) and row.get("relevance") == "high"
    ]
    context_non_process = [
        row
        for row in enriched
        if PROCESS_ROLE not in row.get("job_roles", []) and row.get("relevance") != "high"
    ]

    process_target = (count + 1) // 2
    selected: list[tuple[dict, str]] = [
        (row, "자동 공정 분류가 맞는지 확인")
        for row in _round_robin_by_company(process, process_target)
    ]
    remaining = count - len(selected)
    selected.extend(
        (row, "핵심 기사인데 공정 분류가 누락됐는지 확인")
        for row in _round_robin_by_company(high_non_process, remaining)
    )
    remaining = count - len(selected)
    if remaining:
        selected.extend(
            (row, "참고 동향이 공정 기사로 오인되지 않는지 확인")
            for row in _round_robin_by_company(context_non_process, remaining)
        )
    return selected[:count]


def review_row(number: int, article: dict, reason: str) -> dict[str, str]:
    roles = article.get("job_roles") or []
    return {
        "검토번호": str(number),
        "검토 필요 이유": reason,
        "기업": str(article.get("company") or ""),
        "게시일": str(article.get("published_at") or "")[:10],
        "한국어 제목": str(article.get("title_ko") or ""),
        "영문 제목": str(article.get("title") or ""),
        "원문 링크": str(article.get("url") or ""),
        "중요도": str(article.get("relevance") or ""),
        "자동 공정 판정": "공정" if PROCESS_ROLE in roles else "비공정",
        "자동 기술 분야": ", ".join(article.get("tech_domains") or []),
        "자동 관련 직무": ", ".join(roles),
        "사람 공정 관련성": "",
        "사람 기술 분야 평가": "",
        "사람 관련 직무 평가": "",
        "한국어 제목 번역 품질": "",
        "오류 유형": "",
        "검토 메모": "",
    }


def write_review(path: Path, sample: list[tuple[dict, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDNAMES)
        writer.writeheader()
        for number, (article, reason) in enumerate(sample, start=1):
            writer.writerow(review_row(number, article, reason))


def main() -> None:
    parser = argparse.ArgumentParser(description="직무 분류 수동 검토용 CSV 생성")
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--count", type=int, default=10)
    args = parser.parse_args()

    if args.count < 1:
        raise SystemExit("--count는 1 이상이어야 합니다.")
    articles = load_articles(args.input)
    sample = choose_review_sample(articles, args.count)
    write_review(args.output, sample)

    process_count = sum(
        1 for article, _ in sample if PROCESS_ROLE in article.get("job_roles", [])
    )
    company_count = len({article.get("company") for article, _ in sample})
    print("=== 분류 검토표 생성 완료 ===")
    print(f"검토 대상: {len(sample)}건 / 기업: {company_count}개")
    print(f"자동 공정 판정: {process_count}건 / 비교 대상: {len(sample) - process_count}건")
    print(f"저장 위치: {args.output.resolve()}")


if __name__ == "__main__":
    main()
