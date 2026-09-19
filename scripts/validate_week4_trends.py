"""공개 웹 데이터로 4주차 산업 동향 집계의 일관성을 검사한다."""

from __future__ import annotations

import json
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SRC_ROOT = PROJECT_ROOT / "src"
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from trend_tracker.trend_summary import build_trend_summary, validate_trend_summary


INPUT_PATH = PROJECT_ROOT / "docs" / "data" / "latest.json"
REPORT_PATH = PROJECT_ROOT / "docs" / "week4_trend_quality_report.md"


def _names(rows: list[dict], limit: int = 3) -> str:
    selected = [f"{row['name']}({row['count']}건)" for row in rows[:limit]]
    return ", ".join(selected) if selected else "집계 없음"


def main() -> None:
    source = json.loads(INPUT_PATH.read_text(encoding="utf-8"))
    articles = source.get("articles") or []
    summary = build_trend_summary(articles, source.get("generated_at"))
    issues = validate_trend_summary(summary, articles)
    status = "PASS" if not issues else "FAIL"

    lines = [
        "# 4주차 산업 동향 집계 품질 보고서",
        "",
        f"- 검사 결과: **{status}**",
        f"- 기준 시각: {summary['reference_at']}",
        f"- 원본 기사: {len(articles)}건",
        "",
        "## 기간별 검사 결과",
        "",
        "| 기간 | 전체 기사 | 핵심 기술 기사 | 기업 | 상위 기술 분야 | 상위 관련 직무 |",
        "| --- | ---: | ---: | ---: | --- | --- |",
    ]
    for days in (7, 30, 90):
        row = summary["windows"][str(days)]
        lines.append(
            f"| 최근 {days}일 | {row['article_count']} | "
            f"{row['high_relevance_count']} | {row['company_count']} | "
            f"{_names(row['top_tech_domains'])} | {_names(row['top_job_roles'])} |"
        )
    lines.extend(["", "## 자동 검증", ""])
    if issues:
        lines.extend(f"- [FAIL] {issue}" for issue in issues)
    else:
        lines.extend(
            [
                "- [PASS] 기간이 길어질수록 기사 수가 같거나 증가함",
                "- [PASS] 핵심 기술 기사 수가 전체 기사 수를 넘지 않음",
                "- [PASS] 모든 기간의 기사 수가 원본 기사 수 범위 안에 있음",
            ]
        )
    lines.extend(
        [
            "",
            "## 해석 시 주의사항",
            "",
            "- 기사 건수는 실제 투자액이나 기술 중요도 그 자체가 아니라 공식 발표 빈도를 뜻한다.",
            "- 분류 결과는 취업 준비용 1차 탐색 자료이며, 중요한 판단 전 공식 원문을 확인한다.",
            "- 30일 상승 신호는 최근 30일과 그 직전 30일의 발표 건수 차이로 계산한다.",
            "",
        ]
    )
    REPORT_PATH.write_text("\n".join(lines), encoding="utf-8")

    print("=== 4주차 산업 동향 집계 검사 ===")
    print(f"상태: {status}")
    for days in (7, 30, 90):
        row = summary["windows"][str(days)]
        print(
            f"최근 {days}일: 전체 {row['article_count']}건 / "
            f"핵심 {row['high_relevance_count']}건 / 기업 {row['company_count']}개"
        )
    print(f"보고서: {REPORT_PATH}")
    if issues:
        raise SystemExit(" / ".join(issues))


if __name__ == "__main__":
    main()
