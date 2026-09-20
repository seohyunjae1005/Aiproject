/**
 * Google Form 응답 Sheet에 연결해서 사용한다.
 *
 * 안전 기본값:
 * - 시험 메일은 가장 최근의 유효한 신규 구독 신청 1건에만 보낸다.
 * - 실제 다중 발송은 LIVE_SEND_ENABLED가 false인 동안 실행되지 않는다.
 * - 발송 기록에는 이메일 원문 대신 SHA-256 해시만 저장한다.
 */

const DAILY_DIGEST_URL = 'https://seohyunjae1005.github.io/Aiproject/newsletter/daily.html';
const DAILY_META_URL = 'https://seohyunjae1005.github.io/Aiproject/newsletter/daily.json';
const WEEKLY_DIGEST_URL = 'https://seohyunjae1005.github.io/Aiproject/newsletter/weekly.html';
const WEEKLY_META_URL = 'https://seohyunjae1005.github.io/Aiproject/newsletter/weekly.json';

// 시험이 끝날 때까지 false로 둔다. true로 바꾸기 전에는 다중 발송이 실행되지 않는다.
const LIVE_SEND_ENABLED = false;
const MAX_SENDS_PER_RUN = 20;
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
  email: '이메일 주소',
  frequency: '희망 발송 주기',
  consent: '개인정보 수집 및 이메일 수신 동의',
  requestType: '요청 유형',
};

function normalizedHeader(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function headerIndexes(headers) {
  const normalized = headers.map(normalizedHeader);
  const indexes = {};
  Object.entries(REQUIRED_HEADERS).forEach(([key, label]) => {
    const index = normalized.indexOf(label);
    if (index < 0) throw new Error(`필수 열을 찾을 수 없습니다: ${label}`);
    indexes[key] = index;
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

function readLatestStates() {
  const sheet = findResponseSheet();
  const values = sheet.getDataRange().getDisplayValues();
  if (values.length < 2) throw new Error('시험할 응답이 없습니다.');
  const indexes = headerIndexes(values[0]);
  const states = new Map();
  values.slice(1).forEach((row, rowOffset) => {
    const email = String(row[indexes.email] || '').trim().toLowerCase();
    if (!email) return;
    states.set(email, {
      email,
      frequency: String(row[indexes.frequency] || '').trim(),
      consent: String(row[indexes.consent] || '').trim(),
      requestType: String(row[indexes.requestType] || '').trim(),
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

function digestSource(kind) {
  if (kind === 'weekly') {
    return { htmlUrl: WEEKLY_DIGEST_URL, metaUrl: WEEKLY_META_URL };
  }
  if (kind === 'daily') {
    return { htmlUrl: DAILY_DIGEST_URL, metaUrl: DAILY_META_URL };
  }
  throw new Error(`지원하지 않는 발송 주기입니다: ${kind}`);
}

function fetchDigest(kind, isTest) {
  const source = digestSource(kind);
  const metaResponse = UrlFetchApp.fetch(source.metaUrl, { muteHttpExceptions: true });
  if (metaResponse.getResponseCode() !== 200) {
    throw new Error(`리포트 정보 읽기 실패: HTTP ${metaResponse.getResponseCode()}`);
  }
  const meta = JSON.parse(metaResponse.getContentText());
  if (!meta.send_recommended) {
    throw new Error('새 기사가 없어 현재 리포트는 발송하지 않는 것이 좋습니다.');
  }

  const htmlResponse = UrlFetchApp.fetch(source.htmlUrl, { muteHttpExceptions: true });
  if (htmlResponse.getResponseCode() !== 200) {
    throw new Error(`리포트 본문 읽기 실패: HTTP ${htmlResponse.getResponseCode()}`);
  }
  const html = htmlResponse.getContentText();
  return {
    subject: `${isTest ? '[테스트] ' : ''}${meta.subject}`,
    html,
    articleCount: Number(meta.article_count || 0),
    contentKey: sha256(`${kind}\n${meta.subject}\n${html}`),
  };
}

function subscriberKey(email) {
  return sha256(String(email || '').trim().toLowerCase());
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

function buildDeliveryPlan(kind) {
  const digest = fetchDigest(kind, false);
  const sent = successfulDeliveryKeys();
  const subscribers = approvedSubscribers(kind);
  const pending = subscribers.filter((subscriber) =>
    !sent.has(deliveryKey(subscriber, kind, digest))
  );
  return {
    kind,
    digest,
    approvedCount: subscribers.length,
    duplicateCount: subscribers.length - pending.length,
    pending,
  };
}

/** 이메일을 보내지 않고 현재 발송 대상 수만 실행 로그에 표시한다. */
function previewDeliveryPlan() {
  ['daily', 'weekly'].forEach((kind) => {
    try {
      const plan = buildDeliveryPlan(kind);
      console.log(
        `${kind}: 승인 ${plan.approvedCount}명 / 중복 제외 ${plan.duplicateCount}명 / 발송 예정 ${plan.pending.length}명`
      );
    } catch (error) {
      console.log(`${kind}: 발송 계획 없음 (${error.message})`);
    }
  });
}

function sendApprovedDigest(kind) {
  if (!LIVE_SEND_ENABLED) {
    throw new Error('다중 발송이 잠겨 있습니다. 검증 후 LIVE_SEND_ENABLED를 true로 바꾸세요.');
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    throw new Error('다른 발송 작업이 실행 중입니다. 잠시 후 다시 시도하세요.');
  }

  try {
    const plan = buildDeliveryPlan(kind);
    const remainingQuota = MailApp.getRemainingDailyQuota();
    const limit = Math.min(MAX_SENDS_PER_RUN, remainingQuota);
    const targets = plan.pending.slice(0, limit);
    if (!targets.length) {
      console.log(`${kind}: 새로 발송할 대상이 없습니다.`);
      return;
    }

    let successCount = 0;
    const failures = [];
    targets.forEach((subscriber) => {
      try {
        MailApp.sendEmail({
          to: subscriber.email,
          subject: plan.digest.subject,
          htmlBody: plan.digest.html,
          name: '반도체 기술동향 트래커',
        });
        appendDeliveryLog(subscriber, kind, plan.digest, '성공');
        successCount += 1;
      } catch (error) {
        appendDeliveryLog(subscriber, kind, plan.digest, `실패: ${error.message}`);
        failures.push(`Sheet ${subscriber.sheetRow}행`);
      }
    });

    console.log(
      `${kind}: ${successCount}건 발송 성공 / ${failures.length}건 실패 / 1회 제한 ${MAX_SENDS_PER_RUN}건`
    );
    if (failures.length) {
      throw new Error(`일부 발송 실패: ${failures.join(', ')}`);
    }
  } finally {
    lock.releaseLock();
  }
}

/** 매일 실행할 실제 발송 함수. LIVE_SEND_ENABLED가 false이면 발송하지 않는다. */
function sendDailyDigest() {
  sendApprovedDigest('daily');
}

/** 매주 실행할 실제 발송 함수. LIVE_SEND_ENABLED가 false이면 발송하지 않는다. */
function sendWeeklyDigest() {
  sendApprovedDigest('weekly');
}

/** 가장 최근의 유효한 신규 구독 신청 1건에만 시험 메일을 보낸다. */
function sendTestToLatestSubscriber() {
  const subscriber = latestApprovedSubscriber();
  const kind = deliveryKind(subscriber.frequency);
  if (!kind) throw new Error('선택한 희망 발송 주기를 해석할 수 없습니다.');
  const digest = fetchDigest(kind, true);
  MailApp.sendEmail({
    to: subscriber.email,
    subject: digest.subject,
    htmlBody: digest.html,
    name: '반도체 기술동향 트래커',
  });
  console.log(`시험 메일 1건 발송 완료: Sheet ${subscriber.sheetRow}행`);
}
