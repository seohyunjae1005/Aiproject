"""Gemini로 공개 기사 3건을 분석하고 원문 근거를 자동 검증한다."""

from __future__ import annotations

import json
import os
import random
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SRC = PROJECT_ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from trend_tracker.analysis_schema import ALLOWED_ROLES, ANALYSIS_VERSION


REQUEST_PATH = PROJECT_ROOT / "runtime" / "analysis_requests.json"
BODY_PATH = PROJECT_ROOT / "runtime" / "article_bodies.json"
RESULT_PATH = PROJECT_ROOT / "runtime" / "analysis_results.json"
REPORT_PATH = PROJECT_ROOT / "runtime" / "analysis_validation.md"
DEFAULT_MODEL = "gemini-3.5-flash-lite"
FALLBACK_MODELS = ("gemini-3.1-flash-lite",)
MAX_ARTICLES = 3
ALLOWED_CONFIDENCE = {"high", "medium", "low"}


def normalize_text(value: str) -> str:
    value = unicodedata.normalize("NFKC", value)
    value = value.translate(str.maketrans({"“": '"', "”": '"', "’": "'", "‘": "'"}))
    return re.sub(r"\s+", " ", value).strip().casefold()


def evidence_word_count(value: str) -> int:
    return len(re.findall(r"[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*", value))


def trim_evidence(value: str, limit: int = 25) -> str:
    """인용문의 앞부분을 단어 경계를 유지해 제한 길이로 줄인다."""

    matches = list(re.finditer(r"[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*", value))
    if len(matches) <= limit:
        return value.strip()
    return value[: matches[limit - 1].end()].strip()


def sanitize_analysis(analysis: dict, body: str) -> tuple[dict, list[str]]:
    """근거를 새로 만들지 않고, 검증 가능한 사실만 안전하게 남긴다."""

    cleaned = json.loads(json.dumps(analysis, ensure_ascii=False))
    notes: list[str] = []
    facts = cleaned.get("facts")
    if not isinstance(facts, list):
        return cleaned, notes

    verified_facts: list[dict] = []
    normalized_body = normalize_text(body)
    for index, fact in enumerate(facts, start=1):
        if not isinstance(fact, dict):
            notes.append(f"사실 {index}: 객체 형식이 아니어서 제외")
            continue
        evidence = str(fact.get("evidence_en") or "").strip()
        shortened = trim_evidence(evidence)
        if shortened != evidence:
            notes.append(f"사실 {index}: 근거 구절을 25단어로 축약")
        fact["evidence_en"] = shortened
        if not shortened or normalize_text(shortened) not in normalized_body:
            notes.append(f"사실 {index}: 원문과 정확히 일치하지 않아 제외")
            continue
        verified_facts.append(fact)

    if len(verified_facts) > 5:
        notes.append(f"사실 항목 {len(verified_facts)}개 중 앞의 5개만 유지")
        verified_facts = verified_facts[:5]
    cleaned["facts"] = verified_facts
    return cleaned, notes


def extract_json(text: str) -> dict:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    parsed = json.loads(cleaned)
    if not isinstance(parsed, dict):
        raise ValueError("AI 응답 최상위 값이 JSON 객체가 아닙니다.")
    return parsed


def call_gemini(prompt: str, api_key: str, model: str) -> tuple[dict, str]:
    """혼잡 오류에는 재시도한 뒤 무료 경량 모델로 전환한다."""

    models = list(dict.fromkeys((model, *FALLBACK_MODELS)))
    errors: list[str] = []
    for candidate_model in models:
        try:
            return call_one_model(prompt, api_key, candidate_model), candidate_model
        except RuntimeError as exc:
            errors.append(f"{candidate_model}: {exc}")
    raise RuntimeError(" / ".join(errors))


def call_one_model(prompt: str, api_key: str, model: str) -> dict:
    model_path = urllib.parse.quote(model, safe="-.")
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model_path}:generateContent"
    )
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 4096,
            "responseMimeType": "application/json",
        },
    }
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "x-goog-api-key": api_key,
        },
        method="POST",
    )

    last_error: Exception | None = None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=90) as response:
                result = json.loads(response.read().decode("utf-8"))
            candidates = result.get("candidates") or []
            parts = candidates[0].get("content", {}).get("parts", []) if candidates else []
            text = "".join(str(part.get("text") or "") for part in parts)
            if not text:
                raise ValueError("Gemini가 분석 본문을 반환하지 않았습니다.")
            return extract_json(text)
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")[:500]
            last_error = RuntimeError(f"Gemini HTTP {exc.code}: {detail}")
            if exc.code not in {429, 500, 502, 503, 504}:
                break
        except (urllib.error.URLError, TimeoutError) as exc:
            last_error = exc
        if attempt < 2:
            time.sleep((2 ** (attempt + 1)) + random.uniform(0.2, 1.0))
    raise RuntimeError(str(last_error or "Gemini 호출에 실패했습니다."))


def validate_analysis(analysis: dict, body: str) -> list[str]:
    issues: list[str] = []
    required = {
        "analysis_version",
        "summary_ko",
        "facts",
        "technology_signals",
        "company_implications",
        "role_insights",
        "uncertainties_ko",
        "overall_confidence",
    }
    missing = sorted(required - set(analysis))
    if missing:
        issues.append("필수 항목 누락: " + ", ".join(missing))

    if analysis.get("analysis_version") != ANALYSIS_VERSION:
        issues.append("분석 버전이 요청값과 다름")
    if not isinstance(analysis.get("summary_ko"), str) or not analysis.get("summary_ko", "").strip():
        issues.append("한국어 요약이 비어 있음")
    if analysis.get("overall_confidence") not in ALLOWED_CONFIDENCE:
        issues.append("전체 신뢰도 값이 허용 범위를 벗어남")

    facts = analysis.get("facts")
    if not isinstance(facts, list) or not 1 <= len(facts) <= 5:
        issues.append("사실 항목은 1~5개여야 함")
    else:
        normalized_body = normalize_text(body)
        for index, fact in enumerate(facts, start=1):
            if not isinstance(fact, dict):
                issues.append(f"사실 {index}: 객체 형식이 아님")
                continue
            evidence = str(fact.get("evidence_en") or "").strip()
            statement = str(fact.get("statement_ko") or "").strip()
            if not statement:
                issues.append(f"사실 {index}: 설명이 비어 있음")
            if not evidence:
                issues.append(f"사실 {index}: 근거 구절이 비어 있음")
                continue
            if evidence_word_count(evidence) > 25:
                issues.append(f"사실 {index}: 근거 구절이 25단어를 초과함")
            if normalize_text(evidence) not in normalized_body:
                issues.append(f"사실 {index}: 근거 구절을 원문에서 찾을 수 없음")

    signals = analysis.get("technology_signals")
    if not isinstance(signals, list) or not signals or not all(isinstance(x, str) for x in signals):
        issues.append("핵심 기술 목록 형식이 잘못됨")

    implications = analysis.get("company_implications")
    if not isinstance(implications, list):
        issues.append("회사 영향 가설 목록 형식이 잘못됨")
    else:
        for index, item in enumerate(implications, start=1):
            if not isinstance(item, dict):
                issues.append(f"회사 영향 {index}: 객체 형식이 아님")
                continue
            if item.get("target_company") not in {"Samsung Electronics", "SK hynix"}:
                issues.append(f"회사 영향 {index}: 대상 회사가 허용 목록에 없음")
            if item.get("confidence") not in ALLOWED_CONFIDENCE:
                issues.append(f"회사 영향 {index}: 신뢰도 값이 잘못됨")

    role_insights = analysis.get("role_insights")
    if not isinstance(role_insights, list) or not 1 <= len(role_insights) <= 4:
        issues.append("직무 인사이트는 1~4개여야 함")
    else:
        for index, item in enumerate(role_insights, start=1):
            if not isinstance(item, dict):
                issues.append(f"직무 {index}: 객체 형식이 아님")
                continue
            if item.get("role") not in ALLOWED_ROLES:
                issues.append(f"직무 {index}: 허용되지 않은 직무명")
            for field in ("considerations_ko", "study_points_ko"):
                value = item.get(field)
                if not isinstance(value, list) or not value:
                    issues.append(f"직무 {index}: {field}가 비어 있거나 목록이 아님")

    if not isinstance(analysis.get("uncertainties_ko"), list):
        issues.append("불확실성 항목이 목록이 아님")
    return issues


def write_report(results: list[dict], model: str) -> None:
    passed = sum(row.get("validation_status") == "PASS" for row in results)
    failed = sum(row.get("validation_status") == "FAIL" for row in results)
    errors = sum(row.get("validation_status") == "ERROR" for row in results)
    lines = [
        "# AI 분석 시험 검증 보고서",
        "",
        f"- 모델: `{model}`",
        f"- 처리 기사: {len(results)}건",
        f"- 검증 통과: {passed}건",
        f"- 검증 실패: {failed}건",
        f"- API/파싱 오류: {errors}건",
        "",
        "> 이 결과는 공개 기사 3건의 시험 분석이며, 사람의 최종 검토 전에는 웹사이트에 게시하지 않습니다.",
        "",
    ]
    for row in results:
        lines.extend(
            [
                f"## {row.get('company')} — {row.get('title')}",
                "",
                f"- 상태: **{row.get('validation_status')}**",
            ]
        )
        notes = row.get("normalization_notes") or []
        if notes:
            lines.append("- 자동 정리:")
            lines.extend(f"  - {note}" for note in notes)
        issues = row.get("validation_issues") or []
        if issues:
            lines.append("- 확인사항:")
            lines.extend(f"  - {issue}" for issue in issues)
        lines.append("")
    REPORT_PATH.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise SystemExit("GEMINI_API_KEY가 없습니다. GitHub Actions 비밀키를 확인하세요.")
    model = os.environ.get("GEMINI_MODEL", DEFAULT_MODEL).strip() or DEFAULT_MODEL
    if not REQUEST_PATH.exists() or not BODY_PATH.exists():
        raise SystemExit("먼저 본문 추출과 분석 요청 준비 스크립트를 실행하세요.")

    requests = json.loads(REQUEST_PATH.read_text(encoding="utf-8"))[:MAX_ARTICLES]
    bodies = json.loads(BODY_PATH.read_text(encoding="utf-8"))
    body_by_url = {str(row.get("url") or ""): str(row.get("body") or "") for row in bodies}
    if not requests:
        raise SystemExit("분석할 요청이 없습니다.")

    results: list[dict] = []
    print(f"=== Gemini 직무 분석 시험 시작: 최대 {MAX_ARTICLES}건 ===")
    for index, row in enumerate(requests, start=1):
        url = str(row.get("url") or "")
        body = body_by_url.get(url, "")
        result = {
            "company": row.get("company"),
            "title": row.get("title"),
            "url": url,
            "model": model,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }
        try:
            raw_analysis, used_model = call_gemini(
                str(row.get("prompt") or ""), api_key, model
            )
            analysis, normalization_notes = sanitize_analysis(raw_analysis, body)
            issues = validate_analysis(analysis, body)
            result.update(
                {
                    "model": used_model,
                    "analysis": analysis,
                    "normalization_notes": normalization_notes,
                    "validation_status": "PASS" if not issues else "FAIL",
                    "validation_issues": issues,
                }
            )
        except Exception as exc:  # 한 기사 실패가 나머지 분석을 막지 않도록 한다.
            result.update(
                {
                    "analysis": None,
                    "validation_status": "ERROR",
                    "validation_issues": [str(exc)],
                }
            )
        results.append(result)
        print(f"{index}/{len(requests)} {row.get('company')}: {result['validation_status']}")

    RESULT_PATH.parent.mkdir(parents=True, exist_ok=True)
    RESULT_PATH.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    write_report(results, model)
    print(f"결과: {RESULT_PATH}")
    print(f"검증 보고서: {REPORT_PATH}")
    if all(row.get("validation_status") == "ERROR" for row in results):
        raise SystemExit("모든 기사 분석이 실패했습니다. 로그의 오류 메시지를 확인하세요.")


if __name__ == "__main__":
    main()
