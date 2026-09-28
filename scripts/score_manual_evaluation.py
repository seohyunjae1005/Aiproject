"""30건 수동 평가표의 중간 결과와 분류 규칙 개선 전후를 계산한다."""

from __future__ import annotations

import argparse
import json
import re
import sys
import zipfile
from collections import Counter
from datetime import datetime
from pathlib import Path
from xml.etree import ElementTree as ET


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SRC = PROJECT_ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from trend_tracker.classification import CLASSIFICATION_VERSION, enrich_article


DEFAULT_WORKBOOK = (
    PROJECT_ROOT.parent
    / "outputs"
    / "manual-evaluation-30"
    / "반도체_기사_30건_간편_평가표.xlsx"
)
DEFAULT_ARTICLES = PROJECT_ROOT / "docs" / "data" / "latest.json"
DEFAULT_REPORT = (
    PROJECT_ROOT.parent
    / "outputs"
    / "manual-evaluation-30"
    / "반도체_기사_분류_중간결과.md"
)

PROCESS_ROLE = "공정기술·양산기술"
NS = {"main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
REL_NS = {"rel": "http://schemas.openxmlformats.org/package/2006/relationships"}
OFFICE_REL = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"


def _column_number(reference: str) -> int:
    letters = re.match(r"[A-Z]+", reference)
    if not letters:
        return 0
    number = 0
    for char in letters.group(0):
        number = number * 26 + ord(char) - ord("A") + 1
    return number


def _shared_strings(archive: zipfile.ZipFile) -> list[str]:
    try:
        root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
    except KeyError:
        return []
    return [
        "".join(node.text or "" for node in item.findall(".//main:t", NS))
        for item in root.findall("main:si", NS)
    ]


def _worksheet_path(archive: zipfile.ZipFile, sheet_name: str) -> str:
    workbook = ET.fromstring(archive.read("xl/workbook.xml"))
    relation_id = None
    for sheet in workbook.findall(".//main:sheet", NS):
        if sheet.attrib.get("name") == sheet_name:
            relation_id = sheet.attrib.get(OFFICE_REL)
            break
    if not relation_id:
        raise ValueError(f"시트를 찾을 수 없습니다: {sheet_name}")

    relations = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
    for relation in relations.findall("rel:Relationship", REL_NS):
        if relation.attrib.get("Id") == relation_id:
            target = relation.attrib["Target"].replace("\\", "/")
            if target.startswith("/"):
                return target.lstrip("/")
            return f"xl/{target.lstrip('./')}"
    raise ValueError(f"시트 연결을 찾을 수 없습니다: {sheet_name}")


def _cell_text(cell: ET.Element, shared: list[str]) -> str:
    cell_type = cell.attrib.get("t")
    if cell_type == "inlineStr":
        return "".join(node.text or "" for node in cell.findall(".//main:t", NS))
    value = cell.find("main:v", NS)
    if value is None or value.text is None:
        return ""
    if cell_type == "s":
        try:
            return shared[int(value.text)]
        except (ValueError, IndexError):
            return ""
    return value.text


def read_review_rows(path: Path, sheet_name: str = "평가표") -> list[dict[str, str]]:
    """스타일 오류가 있는 파일도 값만 안전하게 읽도록 XLSX XML을 직접 읽는다."""
    with zipfile.ZipFile(path) as archive:
        shared = _shared_strings(archive)
        root = ET.fromstring(archive.read(_worksheet_path(archive, sheet_name)))

    raw_rows: dict[int, dict[int, str]] = {}
    for row in root.findall(".//main:sheetData/main:row", NS):
        row_number = int(row.attrib.get("r", "0"))
        values: dict[int, str] = {}
        for cell in row.findall("main:c", NS):
            column = _column_number(cell.attrib.get("r", ""))
            values[column] = _cell_text(cell, shared)
        raw_rows[row_number] = values

    headers = raw_rows.get(5, {})
    rows: list[dict[str, str]] = []
    for row_number in sorted(number for number in raw_rows if number >= 6):
        values = raw_rows[row_number]
        record = {
            header: values.get(column, "").strip()
            for column, header in headers.items()
            if header
        }
        if record.get("평가 ID"):
            rows.append(record)
    return rows


def _normalize(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "")).casefold().strip()


def load_article_index(path: Path) -> dict[tuple[str, str], dict]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    index: dict[tuple[str, str], dict] = {}
    for article in payload.get("articles") or []:
        company = _normalize(article.get("company"))
        for title in (article.get("title_ko"), article.get("title")):
            if title:
                index[(company, _normalize(title))] = article
    return index


def _is_human_process_related(value: str) -> bool | None:
    if value in {"직접", "간접"}:
        return True
    if value == "무관":
        return False
    return None


def _accuracy(correct: int, total: int) -> str:
    return f"{correct / total:.1%}" if total else "계산 불가"


def build_metrics(rows: list[dict[str, str]], article_index: dict) -> dict:
    reviewed = [row for row in rows if row.get("원문 확인") == "검토 완료"]
    process_counts = Counter(row.get("자동 공정 판정 평가") for row in reviewed)
    tech_counts = Counter(row.get("자동 기술 분야 평가") for row in reviewed)
    job_counts = Counter(row.get("자동 관련 직무 평가") for row in reviewed)
    translation_counts = Counter(row.get("한국어 제목 번역 품질") for row in reviewed)
    error_counts = Counter(
        row.get("오류 유형")
        for row in reviewed
        if row.get("오류 유형") not in {None, "", "없음"}
    )

    compared: list[dict[str, object]] = []
    unmatched: list[str] = []
    inconsistent: list[dict[str, str]] = []
    for row in reviewed:
        human = _is_human_process_related(row.get("공정 관련성", ""))
        if human is None:
            continue
        baseline = row.get("자동 공정 판정") == "관련"
        expected_evaluation = (
            "정확" if baseline == human else "과대 분류" if baseline else "누락"
        )
        recorded_evaluation = row.get("자동 공정 판정 평가", "")
        if recorded_evaluation and recorded_evaluation != expected_evaluation:
            inconsistent.append(
                {
                    "id": row.get("평가 ID") or "미상",
                    "recorded": recorded_evaluation,
                    "expected": expected_evaluation,
                }
            )
        key = (_normalize(row.get("회사")), _normalize(row.get("한국어 제목")))
        article = article_index.get(key)
        if article is None:
            unmatched.append(row.get("평가 ID") or "미상")
            continue
        enriched = enrich_article(article)
        revised = PROCESS_ROLE in (enriched.get("job_roles") or [])
        compared.append(
            {
                "id": row.get("평가 ID"),
                "human": human,
                "baseline": baseline,
                "revised": revised,
            }
        )

    baseline_correct = sum(item["baseline"] == item["human"] for item in compared)
    revised_correct = sum(item["revised"] == item["human"] for item in compared)
    return {
        "total": len(rows),
        "reviewed": len(reviewed),
        "process_counts": process_counts,
        "tech_counts": tech_counts,
        "job_counts": job_counts,
        "translation_counts": translation_counts,
        "error_counts": error_counts,
        "compared": compared,
        "unmatched": unmatched,
        "inconsistent": inconsistent,
        "baseline_correct": baseline_correct,
        "revised_correct": revised_correct,
    }


def render_report(metrics: dict) -> str:
    process = metrics["process_counts"]
    judged = process["정확"] + process["과대 분류"] + process["누락"]
    compared = metrics["compared"]
    comparison_count = len(compared)
    lines = [
        "# 반도체 기사 분류 중간 평가 결과",
        "",
        f"- 생성일: {datetime.now().astimezone().strftime('%Y-%m-%d %H:%M')}",
        f"- 검토 진행: {metrics['reviewed']}/{metrics['total']}건",
        "- 상태: 30건 완료 전 중간 결과",
        "",
        "## 현재 평가표 결과",
        "",
        f"- 공정 판정 일치율: {_accuracy(process['정확'], judged)} ({process['정확']}/{judged}건)",
        f"- 과대 분류: {process['과대 분류']}건",
        f"- 누락: {process['누락']}건",
        f"- 기술 분야 정확: {metrics['tech_counts']['정확']}건",
        f"- 관련 직무 정확: {metrics['job_counts']['정확']}건",
        f"- 한국어 제목 자연스러움: {metrics['translation_counts']['자연스러움']}건",
        "",
        f"## 분류 규칙 개선 전후 비교 ({CLASSIFICATION_VERSION})",
        "",
        f"- 비교 가능한 기사: {comparison_count}건",
        f"- 기존 자동 판정 일치율: {_accuracy(metrics['baseline_correct'], comparison_count)} "
        f"({metrics['baseline_correct']}/{comparison_count}건)",
        f"- 수정 규칙 판정 일치율: {_accuracy(metrics['revised_correct'], comparison_count)} "
        f"({metrics['revised_correct']}/{comparison_count}건)",
    ]
    if comparison_count:
        change = metrics["revised_correct"] - metrics["baseline_correct"]
        lines.append(f"- 일치 건수 변화: {change:+d}건")

    if metrics["inconsistent"]:
        lines.extend(["", "## 입력 일관성 확인", ""])
        for item in metrics["inconsistent"]:
            lines.append(
                f"- {item['id']}: 현재 입력 `{item['recorded']}` → 사람 판정 기준 `{item['expected']}`"
            )

    lines.extend(["", "## 입력된 주요 오류 유형", ""])
    error_counts = metrics["error_counts"]
    if error_counts:
        for name, count in error_counts.most_common():
            lines.append(f"- {name}: {count}건")
    else:
        lines.append("- 입력된 오류 유형 없음")

    if metrics["unmatched"]:
        lines.extend(
            [
                "",
                "## 비교 제외",
                "",
                "현재 공개 데이터에서 같은 기사를 찾지 못해 개선 규칙 비교에서 제외한 평가 ID:",
                "",
                f"- {', '.join(metrics['unmatched'])}",
            ]
        )

    lines.extend(
        [
            "",
            "## 해석 시 주의",
            "",
            "현재 수치는 검토가 끝난 기사만 사용한 중간 결과이다. 30건 검토가 끝나기 전에는 최종 정확도로 사용하지 않는다. 사람의 공정 관련성에서 `직접`과 `간접`은 관련으로, `무관`은 비관련으로 계산하였다.",
            "",
        ]
    )
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description="수동 평가표 중간 결과 계산")
    parser.add_argument("--workbook", type=Path, default=DEFAULT_WORKBOOK)
    parser.add_argument("--articles", type=Path, default=DEFAULT_ARTICLES)
    parser.add_argument("--output", type=Path, default=DEFAULT_REPORT)
    args = parser.parse_args()

    rows = read_review_rows(args.workbook)
    article_index = load_article_index(args.articles)
    metrics = build_metrics(rows, article_index)
    report = render_report(metrics)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(report, encoding="utf-8")

    process = metrics["process_counts"]
    judged = process["정확"] + process["과대 분류"] + process["누락"]
    print("=== 수동 평가 중간 결과 ===")
    print(f"검토 진행: {metrics['reviewed']}/{metrics['total']}건")
    print(f"공정 판정 일치율: {_accuracy(process['정확'], judged)}")
    print(f"과대 분류: {process['과대 분류']}건 / 누락: {process['누락']}건")
    print(f"분류 규칙 비교 가능: {len(metrics['compared'])}건")
    print(f"보고서: {args.output.resolve()}")


if __name__ == "__main__":
    main()
