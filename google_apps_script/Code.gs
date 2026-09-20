/**
 * Google Form 응답 Sheet에 연결해서 사용한다.
 * 기본 함수는 가장 최근의 유효한 신규 구독 신청 1건에만 테스트 메일을 보낸다.
 */

const DAILY_DIGEST_URL = 'https://seohyunjae1005.github.io/Aiproject/newsletter/daily.html';
const DAILY_META_URL = 'https://seohyunjae1005.github.io/Aiproject/newsletter/daily.json';
const WEEKLY_DIGEST_URL = 'https://seohyunjae1005.github.io/Aiproject/newsletter/weekly.html';
const WEEKLY_META_URL = 'https://seohyunjae1005.github.io/Aiproject/newsletter/weekly.json';

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

function readLatestStates() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
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

function latestApprovedSubscriber() {
  const approved = readLatestStates().filter((row) =>
    row.requestType === '신규 구독 신청' && row.consent.includes('동의')
  );
  if (!approved.length) throw new Error('유효한 신규 구독 신청이 없습니다.');
  return approved.sort((a, b) => b.sheetRow - a.sheetRow)[0];
}

function fetchDigest(frequency) {
  const weekly = frequency.includes('주 1회');
  const htmlUrl = weekly ? WEEKLY_DIGEST_URL : DAILY_DIGEST_URL;
  const metaUrl = weekly ? WEEKLY_META_URL : DAILY_META_URL;
  const meta = JSON.parse(UrlFetchApp.fetch(metaUrl).getContentText());
  if (!meta.send_recommended) {
    throw new Error('새 기사가 없어 현재 리포트는 발송하지 않는 것이 좋습니다.');
  }
  return {
    subject: `[테스트] ${meta.subject}`,
    html: UrlFetchApp.fetch(htmlUrl).getContentText(),
  };
}

function sendTestToLatestSubscriber() {
  const subscriber = latestApprovedSubscriber();
  const digest = fetchDigest(subscriber.frequency);
  MailApp.sendEmail({
    to: subscriber.email,
    subject: digest.subject,
    htmlBody: digest.html,
    name: '반도체 기술동향 트래커',
  });
  console.log(`시험 메일 1건 발송 완료: Sheet ${subscriber.sheetRow}행`);
}
