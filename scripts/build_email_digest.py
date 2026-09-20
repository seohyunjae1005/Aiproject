"""개인정보나 발송 기능 없이 검토용 반도체 이메일 리포트를 만든다."""

from __future__ import annotations

import html
import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
INPUT_PATH = PROJECT_ROOT / "docs" / "data" / "latest.json"
OUTPUT_PATH = PROJECT_ROOT / os.environ.get(
    "DIGEST_OUTPUT_PATH", "runtime/email_digest_preview.html"
)
META_PATH = PROJECT_ROOT / os.environ.get(
    "DIGEST_META_PATH", "runtime/email_digest_meta.json"
)
SITE_URL = "https://seohyunjae1005.github.io/Aiproject/"
SUBSCRIPTION_FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSe3Vm-nkOof2qsQfEIIH5pPNs6JE2stnCWOv_4Y_DsQi8YpUQ/viewform?usp=dialog"


def _number(name: str, default: int, minimum: int, maximum: int) -> int:
    try:
        value = int(os.environ.get(name, str(default)))
    except ValueError:
        value = default
    return max(minimum, min(value, maximum))


def _date(value: str | None) -> datetime | None:
    try:
        parsed = datetime.fromisoformat(str(value or "").replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed.replace(tzinfo=parsed.tzinfo or timezone.utc)


def select_articles(payload: dict, days: int, limit: int) -> list[dict]:
    reference = _date(payload.get("generated_at")) or datetime.now(timezone.utc)
    cutoff = reference - timedelta(days=days)
    rows = []
    for article in payload.get("articles") or []:
        published = _date(article.get("published_at"))
        if published is not None and cutoff <= published <= reference:
            rows.append(article)
    rows.sort(key=lambda row: str(row.get("published_at") or ""), reverse=True)
    return rows[:limit]


def _article_html(article: dict) -> str:
    title = article.get("title_ko") or article.get("title") or "제목 없음"
    original = article.get("title") or ""
    summary = article.get("summary_ko") or article.get("summary") or ""
    published = _date(article.get("published_at"))
    date_label = published.astimezone(timezone(timedelta(hours=9))).strftime("%Y.%m.%d") if published else "날짜 미상"
    tags = [*(article.get("tech_domains") or [])[:2], *(article.get("job_roles") or [])[:1]]
    tag_html = "".join(
        f'<span style="display:inline-block;margin:2px;padding:2px 6px;border:1px solid #355064;color:#8fb9df;font-size:11px">{html.escape(str(tag))}</span>'
        for tag in tags
    )
    original_html = ""
    if title != original and original:
        original_html = f'<p style="margin:4px 0;color:#78909c;font-size:11px">원문: {html.escape(str(original))}</p>'
    return f"""
      <tr><td style="padding:16px 0;border-top:1px solid #263b4a">
        <p style="margin:0;color:#6aa9ff;font-size:12px;font-weight:700">{html.escape(str(article.get('company') or ''))} · {date_label}</p>
        <h3 style="margin:6px 0;color:#f2f7fa;font-size:17px;line-height:1.45">{html.escape(str(title))}</h3>
        {original_html}
        <p style="margin:8px 0;color:#b6c5ce;font-size:13px;line-height:1.6">{html.escape(str(summary))}</p>
        <div>{tag_html}</div>
        <p style="margin:10px 0 0"><a href="{html.escape(str(article.get('url') or ''))}" style="color:#54e0bc">공식 원문 확인 →</a></p>
      </td></tr>
    """


def build_digest(payload: dict, articles: list[dict], days: int) -> tuple[str, dict]:
    monthly = payload.get("monthly_trend_report") or {}
    report = monthly.get("report") or {}
    headline = report.get("headline_ko") or "최근 반도체 공정·양산기술 동향"
    summary = report.get("summary_ko") or "공식 뉴스룸의 최신 공정·메모리·장비 기사를 확인하세요."
    findings = "".join(
        f'<li style="margin:5px 0">{html.escape(str(row.get("title_ko") or ""))}</li>'
        for row in (report.get("key_findings") or [])[:3]
    )
    article_rows = "".join(_article_html(row) for row in articles)
    if not article_rows:
        article_rows = '<tr><td style="padding:18px 0;color:#9fb0bc">선택 기간에 새 공식 기사가 없습니다. 이번 미리보기는 발송하지 않는 것이 좋습니다.</td></tr>'
    generated = _date(payload.get("generated_at")) or datetime.now(timezone.utc)
    date_label = generated.astimezone(timezone(timedelta(hours=9))).strftime("%Y년 %m월 %d일")
    subject = f"[반도체 공정 브리프] {date_label} 핵심 기술동향 {len(articles)}건"
    document = f"""<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><title>{html.escape(subject)}</title></head>
<body style="margin:0;background:#071019;font-family:Arial,'Malgun Gothic',sans-serif;color:#f2f7fa">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 12px">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#0c1823;border:1px solid #263b4a">
      <tr><td style="padding:24px">
        <p style="margin:0;color:#54e0bc;font-size:12px;font-weight:700;letter-spacing:1px">SEMICONDUCTOR PROCESS BRIEF</p>
        <h1 style="margin:8px 0;font-size:24px">{html.escape(str(headline))}</h1>
        <p style="color:#b6c5ce;line-height:1.65">{html.escape(str(summary))}</p>
        {f'<ul style="padding-left:20px;color:#dce7ed">{findings}</ul>' if findings else ''}
        <p><a href="{SITE_URL}" style="color:#54e0bc">전체 동향판에서 근거 확인 →</a></p>
      </td></tr>
      <tr><td style="padding:0 24px"><h2 style="font-size:18px">최근 {days}일 공식 기사</h2><table role="presentation" width="100%">{article_rows}</table></td></tr>
      <tr><td style="padding:20px 24px;border-top:1px solid #263b4a;color:#78909c;font-size:11px;line-height:1.6">
        공식 뉴스룸 기반 참고용 자료입니다. 중요한 판단 전 원문을 확인하세요.<br>
        이 이메일에는 추적 픽셀이 없습니다. <a href="{SUBSCRIPTION_FORM_URL}" style="color:#6aa9ff">구독 변경·해지 요청</a>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>"""
    meta = {
        "generated_at": generated.isoformat(),
        "subject": subject,
        "period_days": days,
        "article_count": len(articles),
        "send_recommended": bool(articles),
        "contains_subscriber_data": False,
        "tracking_pixel": False,
    }
    return document, meta


def main() -> None:
    days = _number("DIGEST_DAYS", 1, 1, 7)
    limit = _number("DIGEST_MAX_ARTICLES", 8, 1, 20)
    payload = json.loads(INPUT_PATH.read_text(encoding="utf-8"))
    articles = select_articles(payload, days, limit)
    document, meta = build_digest(payload, articles, days)
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(document, encoding="utf-8")
    META_PATH.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    print("=== 이메일 리포트 미리보기 생성 ===")
    print(f"기간: 최근 {days}일 / 기사: {len(articles)}건")
    print(f"발송 권장: {'예' if meta['send_recommended'] else '아니오'}")
    print(f"HTML: {OUTPUT_PATH}")
    print("실제 이메일은 발송하지 않았습니다.")


if __name__ == "__main__":
    main()
