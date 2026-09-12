"""DeepL 무료 개발자 한도 안에서 새 기사만 한국어로 번역한다."""

from __future__ import annotations

import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


PROJECT_ROOT = Path(__file__).resolve().parents[1]
INPUT_PATH = PROJECT_ROOT / "data" / "processed" / "latest_semiconductor_news.json"
CACHE_PATH = PROJECT_ROOT / "data" / "translations" / "ko.json"

FREE_LIMIT_MAX = 1_000_000
SAFETY_STOP_AT = 900_000
MAX_RUN_CHARACTERS = 80_000
MAX_REQUEST_CHARACTERS = 10_000
MAX_REQUEST_TEXTS = 40


def api_base(api_key: str) -> str:
    override = os.environ.get("DEEPL_API_URL", "").strip().rstrip("/")
    if override:
        return override
    return (
        "https://api-free.deepl.com"
        if api_key.endswith(":fx")
        else "https://api.deepl.com"
    )


def request_json(
    url: str,
    api_key: str,
    form: dict[str, object] | None = None,
    timeout: int = 30,
) -> dict:
    data = None
    headers = {
        "Authorization": f"DeepL-Auth-Key {api_key}",
        "User-Agent": "semiconductor-trend-tracker/1.0",
    }
    if form is not None:
        data = urlencode(form, doseq=True).encode("utf-8")
        headers["Content-Type"] = "application/x-www-form-urlencoded"
    request = Request(url, data=data, headers=headers)
    with urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def get_usage(base: str, api_key: str) -> tuple[int, int]:
    payload = request_json(f"{base}/v2/usage", api_key)
    used = int(payload.get("character_count", -1))
    limit = int(payload.get("character_limit", -1))
    if used < 0 or limit <= 0:
        raise RuntimeError("사용량 또는 한도를 확인할 수 없습니다.")
    return used, limit


def fingerprint(title: str, summary: str) -> str:
    return hashlib.sha256(f"{title}\n{summary}".encode("utf-8")).hexdigest()


def load_cache() -> dict:
    if not CACHE_PATH.exists():
        return {
            "version": 1,
            "provider": "deepl",
            "target_language": "KO",
            "updated_at": None,
            "translations": {},
        }
    payload = json.loads(CACHE_PATH.read_text(encoding="utf-8"))
    if not isinstance(payload.get("translations"), dict):
        raise RuntimeError("번역 캐시 구조가 올바르지 않습니다.")
    return payload


def save_cache(cache: dict) -> None:
    cache["updated_at"] = datetime.now(timezone.utc).isoformat()
    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = CACHE_PATH.with_suffix(".tmp")
    temporary_path.write_text(
        json.dumps(cache, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    temporary_path.replace(CACHE_PATH)


def make_batches(rows: list[dict]) -> list[list[dict]]:
    batches: list[list[dict]] = []
    batch: list[dict] = []
    text_count = 0
    character_count = 0
    for row in rows:
        row_texts = 1 + int(bool(row["summary"]))
        row_characters = len(row["title"]) + len(row["summary"])
        if batch and (
            text_count + row_texts > MAX_REQUEST_TEXTS
            or character_count + row_characters > MAX_REQUEST_CHARACTERS
        ):
            batches.append(batch)
            batch = []
            text_count = 0
            character_count = 0
        batch.append(row)
        text_count += row_texts
        character_count += row_characters
    if batch:
        batches.append(batch)
    return batches


def translate_batch(base: str, api_key: str, rows: list[dict]) -> list[dict]:
    texts: list[str] = []
    layout: list[tuple[int, str]] = []
    for index, row in enumerate(rows):
        texts.append(row["title"])
        layout.append((index, "title_ko"))
        if row["summary"]:
            texts.append(row["summary"])
            layout.append((index, "summary_ko"))

    payload = request_json(
        f"{base}/v2/translate",
        api_key,
        {
            "text": texts,
            "source_lang": "EN",
            "target_lang": "KO",
            "preserve_formatting": "1",
            "split_sentences": "nonewlines",
        },
        timeout=60,
    )
    translated = payload.get("translations") or []
    if len(translated) != len(layout):
        raise RuntimeError("번역 응답 개수가 요청과 일치하지 않습니다.")
    results = [{"title_ko": "", "summary_ko": ""} for _ in rows]
    for item, (index, field) in zip(translated, layout):
        results[index][field] = str(item.get("text") or "").strip()
    return results


def pending_articles(articles: list[dict], translations: dict) -> tuple[list[dict], int]:
    pending: list[dict] = []
    total_characters = 0
    for article in articles:
        url = str(article.get("url") or "")
        title = str(article.get("title") or "").strip()
        summary = str(article.get("summary") or "").strip()
        if not url or not title:
            continue
        source_fingerprint = fingerprint(title, summary)
        cached = translations.get(url)
        if cached and cached.get("source_fingerprint") == source_fingerprint:
            continue
        row_characters = len(title) + len(summary)
        if total_characters + row_characters > MAX_RUN_CHARACTERS:
            break
        pending.append(
            {
                "url": url,
                "title": title,
                "summary": summary,
                "source_fingerprint": source_fingerprint,
            }
        )
        total_characters += row_characters
    return pending, total_characters


def main() -> None:
    if not INPUT_PATH.exists():
        raise SystemExit("먼저 run_daily_collection.py를 실행하세요.")
    api_key = os.environ.get("DEEPL_API_KEY", "").strip()
    if not api_key:
        print("DEEPL_API_KEY가 없어 번역을 건너뜁니다. 기존 번역은 유지됩니다.")
        return

    base = api_base(api_key)
    try:
        used, limit = get_usage(base, api_key)
    except (HTTPError, URLError, TimeoutError, RuntimeError, ValueError) as error:
        print(f"무료 한도를 확인하지 못해 번역을 중단합니다: {error}")
        return
    if limit > FREE_LIMIT_MAX:
        print(f"무료 개발자 한도가 아니므로 중단합니다: character_limit={limit}")
        return
    safe_limit = min(limit, SAFETY_STOP_AT)
    if used >= safe_limit:
        print(f"무료 번역 안전 한도에 도달했습니다: {used}/{limit}자")
        return

    articles = json.loads(INPUT_PATH.read_text(encoding="utf-8")).get("articles", [])
    try:
        cache = load_cache()
    except (json.JSONDecodeError, RuntimeError) as error:
        print(f"번역 캐시 오류로 중단합니다: {error}")
        return
    translations: dict[str, dict] = cache["translations"]
    pending, requested_characters = pending_articles(articles, translations)
    if not pending:
        print(f"새 번역 없음 / DeepL 사용량: {used}/{limit}자")
        return
    if requested_characters > safe_limit - used:
        print(
            "무료 안전 한도를 넘을 수 있어 번역하지 않습니다: "
            f"필요 {requested_characters}자 / 잔여 {safe_limit - used}자"
        )
        return

    translated_count = 0
    try:
        for batch in make_batches(pending):
            results = translate_batch(base, api_key, batch)
            translated_at = datetime.now(timezone.utc).isoformat()
            for row, result in zip(batch, results):
                translations[row["url"]] = {
                    **result,
                    "source_fingerprint": row["source_fingerprint"],
                    "translated_at": translated_at,
                }
                translated_count += 1
            save_cache(cache)
    except (HTTPError, URLError, TimeoutError, RuntimeError, ValueError) as error:
        print(f"번역 오류로 이번 결과를 저장하지 않습니다: {error}")
        return

    print(f"신규 번역: {translated_count}건 / 요청 문자: {requested_characters}자")
    print(f"번역 캐시: {CACHE_PATH}")


if __name__ == "__main__":
    main()
