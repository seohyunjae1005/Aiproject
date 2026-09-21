/**
 * Google Form 응답 Sheet에 연결해서 사용하는 맞춤 이메일 발송 코드.
 *
 * 안전 기본값:
 * - 실제 다중 발송은 LIVE_SEND_ENABLED가 false인 동안 실행되지 않는다.
 * - 같은 이메일의 가장 최근 신청·해지 상태만 사용한다.
 * - 발송 기록에는 이메일 원문 대신 SHA-256 해시만 저장한다.
 * - 같은 구독자에게 같은 맞춤 콘텐츠를 두 번 보내지 않는다.
 */

const PUBLIC_DATA_URL = 'https://seohyunjae1005.github.io/Aiproject/data/latest.json';
const SITE_URL = 'https://seohyunjae1005.github.io/Aiproject/';
const SUBSCRIPTION_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSe3Vm-nkOof2qsQfEIIH5pPNs6JE2stnCWOv_4Y_DsQi8YpUQ/viewform?usp=dialog';

// 맞춤 시험이 끝날 때까지 false로 둔다. true로 바꾸기 전에는 다중 발송이 실행되지 않는다.
const LIVE_SEND_ENABLED = false;
const MAX_SENDS_PER_RUN = 20;
const MAX_ARTICLES_PER_EMAIL = 8;
const DELIVERY_LOG_SHEET = '발송 기록';
const DELIVERY_LOG_HEADERS = [
  '발송 시각',
  '구독자 키',
  '발송 주기',
  '콘텐츠 키',
  '기사 수',
  '결과',
  '응답 행',
];

const REQUIRED_HEADERS = {
  email: ['이메일 주소'],
  frequency: ['희망 발송 주기'],
  consent: ['개인정보 수집 및 이메일 수신 동의'],
  requestType: ['요청 유형'],
};

const OPTIONAL_HEADERS = {
  jobInterests: ['관심직무', '관심 직무'],
  companyInterests: ['관심 기업군', '관심기업군', '관심 기업'],
};

const PROCESS_FALLBACK_ROLES = [
  '공정기술·양산기술',
  'R&D공정·공정설계',
  '평가분석·품질·PE',
  '설비기술·기반기술',
  'P&T·패키지개발',
];

function normalizedHeader(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizedToken(value) {
  return normalizedHeader(value).toLowerCase().replace(/[^0-9a-z가-힣]/g, '');
}

function findHeaderIndex(headers, aliases, required) {
  const normalized = headers.map(normalizedHeader);
  for (const alias of aliases) {
    const index = normalized.indexOf(alias);
    if (index >= 0) return index;
  }
  if (required) throw new Error(`필수 열을 찾을 수 없습니다: ${aliases[0]}`);
  return -1;
}

function headerIndexes(headers) {
  const indexes = {};
  Object.entries(REQUIRED_HEADERS).forEach(([key, aliases]) => {
    indexes[key] = findHeaderIndex(headers, aliases, true);
  });
  Object.entries(OPTIONAL_HEADERS).forEach(([key, aliases]) => {
    indexes[key] = findHeaderIndex(headers, aliases, false);
  });
  return indexes;
}

function findResponseSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  for (const sheet of spreadsheet.getSheets()) {
    if (sheet.getLastRow() < 1 || sheet.getLastColumn() < 1) continue;
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
    try {
      headerIndexes(headers);
      return sheet;
    } catch (error) {
      // 발송 기록 등 다른 시트는 건너뛴다.
    }
  }
  throw new Error('Google Form 응답 시트를 찾을 수 없습니다. 질문 제목을 확인하세요.');
}

function hasValidConsent(value) {
  const consent = normalizedHeader(value);
  return consent.includes('동의') && !consent.includes('미동의') && !consent.includes('동의하지');
}

function deliveryKind(frequency) {
  const value = normalizedHeader(frequency);
  if (value.includes('주 1회') || value.includes('주간')) return 'weekly';
  if (value.includes('일일') || value.includes('새 기사')) return 'daily';
  return '';
}

function splitSelections(value) {
  return String(value || '')
    .split(/[,;\n]/)
    .map((item) => normalizedHeader(item))
    .filter(Boolean);
}

function valueAt(row, index) {
  return index >= 0 ? String(row[index] || '').trim() : '';
}

function readLatestStates() {
  const sheet = findResponseSheet();
  const values = sheet.getDataRange().getDisplayValues();
  if (values.length < 2) throw new Error('시험할 응답이 없습니다.');
  const indexes = headerIndexes(values[0]);
  const states = new Map();
  values.slice(1).forEach((row, rowOffset) => {
    const email = valueAt(row, indexes.email).toLowerCase();
    if (!email) return;
    states.set(email, {
      email,
      frequency: valueAt(row, indexes.frequency),
      consent: valueAt(row, indexes.consent),
      requestType: valueAt(row, indexes.requestType),
      jobInterests: splitSelections(valueAt(row, indexes.jobInterests)),
      companyInterests: splitSelections(valueAt(row, indexes.companyInterests)),
      sheetRow: rowOffset + 2,
    });
  });
  return [...states.values()];
}

function approvedSubscribers(kind) {
  return readLatestStates()
    .filter((row) =>
      row.requestType === '신규 구독 신청' &&
      hasValidConsent(row.consent) &&
      deliveryKind(row.frequency) === kind
    )
    .sort((a, b) => a.sheetRow - b.sheetRow);
}

function latestApprovedSubscriber() {
  const approved = readLatestStates().filter((row) =>
    row.requestType === '신규 구독 신청' && hasValidConsent(row.consent)
  );
  if (!approved.length) throw new Error('유효한 신규 구독 신청이 없습니다.');
  return approved.sort((a, b) => b.sheetRow - a.sheetRow)[0];
}

function sha256(value) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(value),
    Utilities.Charset.UTF_8
  );
  return bytes.map((byte) => ((byte + 256) % 256).toString(16).padStart(2, '0')).join('');
}

function subscriberKey(email) {
  return sha256(String(email || '').trim().toLowerCase());
}

function fetchPublicPayload() {
  const response = UrlFetchApp.fetch(PUBLIC_DATA_URL, { muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) {
    throw new Error(`공개 웹 데이터 읽기 실패: HTTP ${response.getResponseCode()}`);
  }
  return JSON.parse(response.getContentText());
}

function validDate(value) {
  const date = new Date(String(value || ''));
  return Number.isNaN(date.getTime()) ? null : date;
}

function recentArticles(payload, kind) {
  const reference = validDate(payload.generated_at) || new Date();
  const days = kind === 'weekly' ? 7 : 1;
  const cutoff = new Date(reference.getTime() - days * 24 * 60 * 60 * 1000);
  return (payload.articles || [])
    .filter((article) => {
      const published = validDate(article.published_at);
      return published && cutoff <= published && published <= reference;
    })
    .sort((a, b) => String(b.published_at || '').localeCompare(String(a.published_at || '')));
}

function valuesMatch(left, right) {
  const a = normalizedToken(left);
  const b = normalizedToken(right);
  return Boolean(a && b && (a === b || a.includes(b) || b.includes(a)));
}

function articleMatchesJob(article, preferences) {
  const roles = article.job_roles || [];
  return preferences.some((preference) => roles.some((role) => valuesMatch(role, preference)));
}

function canonicalCompany(value) {
  const token = normalizedToken(value);
  if (token.includes('삼성') || token.includes('samsung')) return 'Samsung Electronics';
  if (token.includes('하이닉스') || token.includes('skhynix')) return 'SK hynix';
  if (token.includes('키옥시아') || token.includes('kioxia')) return 'Kioxia';
  if (token.includes('마이크론') || token.includes('micron')) return 'Micron';
  if (token.includes('tsmc')) return 'TSMC';
  if (token.includes('인텔') || token.includes('intel')) return 'Intel';
  if (token.includes('asml')) return 'ASML';
  if (token.includes('어플라이드') || token.includes('appliedmaterials')) return 'Applied Materials';
  if (token.includes('램리서치') || token.includes('lamresearch')) return 'Lam Research';
  if (token.includes('도쿄일렉트론') || token.includes('tokyoelectron')) return 'Tokyo Electron';
  if (token === 'kla' || token.includes('케이엘에이')) return 'KLA';
  return '';
}

function companyGroupMembers(preference) {
  const token = normalizedToken(preference);
  if (
    token.includes('전체') ||
    token.includes('모든') ||
    token.includes('전기업') ||
    token.includes('all')
  ) return ['*'];
  if (token.includes('메모리')) {
    return ['Samsung Electronics', 'SK hynix', 'Kioxia', 'Micron'];
  }
  if (token.includes('파운드리') || token.includes('로직')) {
    return ['Samsung Electronics', 'TSMC', 'Intel'];
  }
  if (token.includes('장비')) {
    return ['ASML', 'Applied Materials', 'Lam Research', 'Tokyo Electron', 'KLA'];
  }
  const company = canonicalCompany(preference);
  return company ? [company] : [];
}

function articleMatchesCompany(article, preferences) {
  const articleCompany = canonicalCompany(article.company) || String(article.company || '');
  return preferences.some((preference) => {
    const members = companyGroupMembers(preference);
    if (members.includes('*') || members.includes(articleCompany)) return true;
    return valuesMatch(article.company, preference);
  });
}

function uniqueArticles(articles) {
  const seen = new Set();
  return articles.filter((article) => {
    const key = String(article.url || article.title || '');
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function selectPersonalizedArticles(payload, kind, subscriber) {
  const recent = recentArticles(payload, kind);
  const scored = recent
    .map((article) => {
      const jobMatch = articleMatchesJob(article, subscriber.jobInterests);
      const companyMatch = articleMatchesCompany(article, subscriber.companyInterests);
      return {
        article,
        score: (jobMatch ? 6 : 0) + (companyMatch ? 4 : 0),
      };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || String(b.article.published_at || '').localeCompare(String(a.article.published_at || '')));

  let articles = uniqueArticles(scored.map((row) => row.article)).slice(0, MAX_ARTICLES_PER_EMAIL);
  let fallback = false;
  if (!articles.length) {
    fallback = true;
    const processRows = recent.filter((article) =>
      (article.job_roles || []).some((role) => PROCESS_FALLBACK_ROLES.includes(role))
    );
    const highRows = processRows.filter((article) => article.relevance === 'high');
    articles = uniqueArticles(highRows.length ? highRows : processRows).slice(0, MAX_ARTICLES_PER_EMAIL);
  }

  return { articles, fallback, recentCount: recent.length };
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(value, pattern) {
  const date = validDate(value);
  if (!date) return '날짜 미상';
  return Utilities.formatDate(date, 'Asia/Seoul', pattern || 'yyyy.MM.dd');
}

function articleHtml(article) {
  const title = article.title_ko || article.title || '제목 없음';
  const original = article.title || '';
  const summary = article.summary_ko || article.summary || '';
  const tags = [
    ...(article.tech_domains || []).slice(0, 2),
    ...(article.job_roles || []).slice(0, 2),
  ];
  const tagHtml = tags.map((tag) =>
    `<span style="display:inline-block;margin:2px;padding:2px 6px;border:1px solid #355064;color:#8fb9df;font-size:11px">${escapeHtml(tag)}</span>`
  ).join('');
  const originalHtml = title !== original && original
    ? `<p style="margin:4px 0;color:#78909c;font-size:11px">원문: ${escapeHtml(original)}</p>`
    : '';
  return `
    <tr><td style="padding:16px 0;border-top:1px solid #263b4a">
      <p style="margin:0;color:#6aa9ff;font-size:12px;font-weight:700">${escapeHtml(article.company)} · ${formatDate(article.published_at)}</p>
      <h3 style="margin:6px 0;color:#f2f7fa;font-size:17px;line-height:1.45">${escapeHtml(title)}</h3>
      ${originalHtml}
      <p style="margin:8px 0;color:#b6c5ce;font-size:13px;line-height:1.6">${escapeHtml(summary)}</p>
      <div>${tagHtml}</div>
      <p style="margin:10px 0 0"><a href="${escapeHtml(article.url)}" style="color:#54e0bc">공식 원문 확인 →</a></p>
    </td></tr>`;
}

function preferenceLabel(subscriber) {
  const jobs = subscriber.jobInterests.length ? subscriber.jobInterests.join(', ') : '선택 없음';
  const companies = subscriber.companyInterests.length ? subscriber.companyInterests.join(', ') : '선택 없음';
  return `관심 직무: ${jobs} / 관심 기업: ${companies}`;
}

function buildPersonalizedDigest(payload, kind, subscriber, isTest) {
  const selected = selectPersonalizedArticles(payload, kind, subscriber);
  if (!selected.articles.length) return null;

  const report = (((payload || {}).monthly_trend_report || {}).report || {});
  const headline = report.headline_ko || '최근 반도체 공정·양산기술 동향';
  const summary = report.summary_ko || '공식 뉴스룸의 최신 반도체 기술동향을 확인하세요.';
  const dateLabel = formatDate(payload.generated_at, 'yyyy년 MM월 dd일');
  const subject = `${isTest ? '[테스트] ' : ''}[반도체 맞춤 브리프] ${dateLabel} 관심 기술동향 ${selected.articles.length}건`;
  const rows = selected.articles.map(articleHtml).join('');
  const fallbackNotice = selected.fallback
    ? '<p style="padding:10px 12px;background:#172532;border-left:3px solid #f0b35a;color:#e5c999;font-size:12px;line-height:1.55">선택한 관심 분야의 새 기사가 없어 공정·양산기술 관련 핵심 기사로 대체했습니다.</p>'
    : '<p style="padding:10px 12px;background:#102a27;border-left:3px solid #54e0bc;color:#a8ddd0;font-size:12px;line-height:1.55">선택한 관심 직무와 기업에 맞는 기사를 우선 배치했습니다.</p>';
  const preference = preferenceLabel(subscriber);
  const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;background:#071019;font-family:Arial,'Malgun Gothic',sans-serif;color:#f2f7fa">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 12px">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#0c1823;border:1px solid #263b4a">
      <tr><td style="padding:24px">
        <p style="margin:0;color:#54e0bc;font-size:12px;font-weight:700;letter-spacing:1px">PERSONALIZED SEMICONDUCTOR BRIEF</p>
        <h1 style="margin:8px 0;font-size:24px">${escapeHtml(headline)}</h1>
        <p style="color:#b6c5ce;line-height:1.65">${escapeHtml(summary)}</p>
        ${fallbackNotice}
        <p style="color:#8fa6b4;font-size:12px;line-height:1.55">${escapeHtml(preference)}</p>
        <p><a href="${SITE_URL}" style="color:#54e0bc">전체 동향판에서 근거 확인 →</a></p>
      </td></tr>
      <tr><td style="padding:0 24px"><h2 style="font-size:18px">${kind === 'weekly' ? '최근 7일' : '최근 1일'} 맞춤 공식 기사</h2><table role="presentation" width="100%">${rows}</table></td></tr>
      <tr><td style="padding:20px 24px;border-top:1px solid #263b4a;color:#78909c;font-size:11px;line-height:1.6">
        공식 뉴스룸 기반 참고용 자료입니다. 중요한 판단 전 원문을 확인하세요.<br>
        이 이메일에는 추적 픽셀이 없습니다. <a href="${SUBSCRIPTION_FORM_URL}" style="color:#6aa9ff">관심 항목 변경·구독 해지</a>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;

  const preferenceKey = [
    ...subscriber.jobInterests.map(normalizedToken).sort(),
    ...subscriber.companyInterests.map(normalizedToken).sort(),
  ].join('|');
  const articleKeys = selected.articles.map((article) => String(article.url || article.title || '')).sort();
  return {
    subject,
    html,
    articleCount: selected.articles.length,
    contentKey: sha256(`${kind}\n${preferenceKey}\n${articleKeys.join('\n')}`),
    fallback: selected.fallback,
  };
}

function getDeliveryLogSheet(createIfMissing) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(DELIVERY_LOG_SHEET);
  if (!sheet && createIfMissing) {
    sheet = spreadsheet.insertSheet(DELIVERY_LOG_SHEET);
    sheet.appendRow(DELIVERY_LOG_HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, DELIVERY_LOG_HEADERS.length).setFontWeight('bold');
  }
  return sheet;
}

function successfulDeliveryKeys() {
  const sheet = getDeliveryLogSheet(false);
  if (!sheet || sheet.getLastRow() < 2) return new Set();
  const values = sheet.getDataRange().getDisplayValues();
  const headers = values[0].map(normalizedHeader);
  const subscriberIndex = headers.indexOf('구독자 키');
  const kindIndex = headers.indexOf('발송 주기');
  const contentIndex = headers.indexOf('콘텐츠 키');
  const resultIndex = headers.indexOf('결과');
  if ([subscriberIndex, kindIndex, contentIndex, resultIndex].some((index) => index < 0)) {
    throw new Error('발송 기록 시트의 열 제목이 올바르지 않습니다.');
  }
  const keys = new Set();
  values.slice(1).forEach((row) => {
    if (row[resultIndex] === '성공') {
      keys.add(`${row[subscriberIndex]}|${row[kindIndex]}|${row[contentIndex]}`);
    }
  });
  return keys;
}

function deliveryKey(subscriber, kind, digest) {
  return `${subscriberKey(subscriber.email)}|${kind}|${digest.contentKey}`;
}

function appendDeliveryLog(subscriber, kind, digest, result) {
  const sheet = getDeliveryLogSheet(true);
  sheet.appendRow([
    new Date(),
    subscriberKey(subscriber.email),
    kind,
    digest.contentKey,
    digest.articleCount,
    result,
    subscriber.sheetRow,
  ]);
}

function buildDeliveryPlan(kind, payload) {
  const sent = successfulDeliveryKeys();
  const subscribers = approvedSubscribers(kind);
  const pending = [];
  let duplicateCount = 0;
  let emptyCount = 0;
  subscribers.forEach((subscriber) => {
    const digest = buildPersonalizedDigest(payload, kind, subscriber, false);
    if (!digest) {
      emptyCount += 1;
      return;
    }
    if (sent.has(deliveryKey(subscriber, kind, digest))) {
      duplicateCount += 1;
      return;
    }
    pending.push({ subscriber, digest });
  });
  return {
    kind,
    approvedCount: subscribers.length,
    duplicateCount,
    emptyCount,
    pending,
  };
}

/** 이메일을 보내지 않고 일간·주간 맞춤 발송 대상 수만 표시한다. */
function previewDeliveryPlan() {
  const payload = fetchPublicPayload();
  ['daily', 'weekly'].forEach((kind) => {
    const plan = buildDeliveryPlan(kind, payload);
    console.log(
      `${kind}: 승인 ${plan.approvedCount}명 / 중복 제외 ${plan.duplicateCount}명 / 콘텐츠 없음 ${plan.emptyCount}명 / 발송 예정 ${plan.pending.length}명`
    );
  });
}

/** 가장 최근 구독자의 관심 조건과 맞춤 기사 수만 확인하며 이메일은 보내지 않는다. */
function previewLatestSubscriberPersonalization() {
  const subscriber = latestApprovedSubscriber();
  const kind = deliveryKind(subscriber.frequency);
  if (!kind) throw new Error('선택한 희망 발송 주기를 해석할 수 없습니다.');
  const digest = buildPersonalizedDigest(fetchPublicPayload(), kind, subscriber, true);
  if (!digest) throw new Error('관심 분야 및 공정·양산 대체 기준에 맞는 새 기사가 없습니다.');
  console.log(
    `Sheet ${subscriber.sheetRow}행 / ${kind} / 맞춤 기사 ${digest.articleCount}건 / 공정·양산 대체 ${digest.fallback ? '예' : '아니오'}`
  );
}

function sendApprovedDigest(kind) {
  if (!LIVE_SEND_ENABLED) {
    throw new Error('다중 발송이 잠겨 있습니다. 맞춤 시험 후 LIVE_SEND_ENABLED를 true로 바꾸세요.');
  }
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    throw new Error('다른 발송 작업이 실행 중입니다. 잠시 후 다시 시도하세요.');
  }
  try {
    const plan = buildDeliveryPlan(kind, fetchPublicPayload());
    const remainingQuota = MailApp.getRemainingDailyQuota();
    const limit = Math.min(MAX_SENDS_PER_RUN, remainingQuota);
    const targets = plan.pending.slice(0, limit);
    if (!targets.length) {
      console.log(`${kind}: 새로 발송할 맞춤 콘텐츠가 없습니다.`);
      return;
    }
    let successCount = 0;
    const failures = [];
    targets.forEach(({ subscriber, digest }) => {
      try {
        MailApp.sendEmail({
          to: subscriber.email,
          subject: digest.subject,
          htmlBody: digest.html,
          name: '반도체 기술동향 트래커',
        });
        appendDeliveryLog(subscriber, kind, digest, '성공');
        successCount += 1;
      } catch (error) {
        appendDeliveryLog(subscriber, kind, digest, `실패: ${error.message}`);
        failures.push(`Sheet ${subscriber.sheetRow}행`);
      }
    });
    console.log(
      `${kind}: ${successCount}건 발송 성공 / ${failures.length}건 실패 / 1회 제한 ${MAX_SENDS_PER_RUN}건`
    );
    if (failures.length) throw new Error(`일부 발송 실패: ${failures.join(', ')}`);
  } finally {
    lock.releaseLock();
  }
}

function sendDailyDigest() {
  sendApprovedDigest('daily');
}

function sendWeeklyDigest() {
  sendApprovedDigest('weekly');
}

/** 가장 최근의 유효한 신규 신청자 1명에게 관심 조건을 반영한 시험 메일을 보낸다. */
function sendTestToLatestSubscriber() {
  const subscriber = latestApprovedSubscriber();
  const kind = deliveryKind(subscriber.frequency);
  if (!kind) throw new Error('선택한 희망 발송 주기를 해석할 수 없습니다.');
  const digest = buildPersonalizedDigest(fetchPublicPayload(), kind, subscriber, true);
  if (!digest) throw new Error('관심 분야 및 공정·양산 대체 기준에 맞는 새 기사가 없습니다.');
  MailApp.sendEmail({
    to: subscriber.email,
    subject: digest.subject,
    htmlBody: digest.html,
    name: '반도체 기술동향 트래커',
  });
  console.log(
    `맞춤 시험 메일 1건 발송 완료: Sheet ${subscriber.sheetRow}행 / 기사 ${digest.articleCount}건 / 공정·양산 대체 ${digest.fallback ? '예' : '아니오'}`
  );
}
