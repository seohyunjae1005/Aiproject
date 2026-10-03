(function (root) {
  "use strict";

  const SECTION_RULES = [
    ["duty", "주요 업무", /^(담당\s*업무|주요\s*업무|수행\s*업무|직무\s*내용|업무\s*내용|responsibilities|what\s*you(?:'|’)?ll\s*(?:do|experience)|경험할\s*수\s*있습니다)$/i],
    ["required", "필수 조건", /^(필수|필수\s*조건|필수\s*요건|자격\s*요건|지원\s*자격|지원자격|minimum\s*qualifications?|basic\s*qualifications?|requirements?|qualifications?|who\s+we(?:'|’)?re\s+looking\s+for)$/i],
    ["preferred", "우대 조건", /^(우대|우대\s*사항|우대\s*조건|preferred(?:\s*qualifications?)?|nice\s*to\s*have|이런\s*역량이나\s*경\S{0,2}이\s*있다면\s*더\s*좋습니다)$/i],
    ["ignore", "기타", /^(복리\s*후생|전형\s*절차|지원\s*방법|근무\s*(조건|지역|장소)|회사\s*소개|benefits?|about\s*us)$/i],
  ].map(([level, label, regex]) => ({ level, label, regex }));

  const KEYWORD_RULES = [
    [/공정\s*최적화|조건\s*최적화/gi, "Process Optimization"],
    [/수율\s*(향상|개선|증대)|수율/gi, "Yield Improvement"],
    [/생산성\s*(향상|개선)|생산성/gi, "Productivity Improvement"],
    [/가동률\s*(향상|개선)|가동률/gi, "Equipment Utilization Improvement"],
    [/품질\s*(안정화|향상|개선|확보)|품질/gi, "Quality Improvement"],
    [/데이터\s*(분석|활용)|빅데이터/gi, "Data Analysis"],
    [/자동화\s*(설비|시스템|기술)?|스마트\s*팩토리/gi, "Automation / Smart Factory"],
    [/라인\s*설계|생산\s*라인|레이아웃|layout/gi, "Production Line Design"],
    [/투자비|원가|수익성/gi, "Cost / Investment Review"],
    [/유관\s*부서\s*협업|협력사\s*협업|업체와\s*협업|협업/gi, "Cross-functional Collaboration"],
    [/문제\s*해결|원인\s*분석|저해\s*요인/gi, "Problem Solving"],
    [/설비\s*(개선|고도화|set[- ]?up)|장비\s*(개선|set[- ]?up)/gi, "Equipment Engineering"],
  ];
  const TOOL_RULES = [
    [/\bPython\b/gi, "Python"], [/\bSQL\b/gi, "SQL"], [/\bJMP\b/gi, "JMP"], [/\bMinitab\b/gi, "Minitab"],
    [/\bMATLAB\b/gi, "MATLAB"], [/\bR\b/g, "R"], [/\bC\+\+\b/gi, "C++"], [/\bJava\b/gi, "Java"],
    [/\bExcel\b/gi, "Excel"], [/\bTableau\b/gi, "Tableau"], [/\bPower\s*BI\b/gi, "Power BI"],
    [/\bCAD\b/gi, "CAD"], [/\bCATIA\b/gi, "CATIA"], [/\bPLC\b/gi, "PLC"], [/\bSPC\b/gi, "SPC"], [/\bDOE\b/gi, "DOE"],
    [/\bE-FOREST\b/gi, "E-FOREST"],
  ];
  const TECH_RULES = [
    [/빅데이터/gi, "빅데이터"], [/\bAI\b|인공지능/gi, "AI·인공지능"], [/컴퓨터\s*비전|\bvision\b|비전\s*활용/gi, "비전 기술"],
    [/스마트\s*팩토리/gi, "스마트팩토리"], [/Photolithography/gi, "Photolithography"], [/\bEtch\b/gi, "Etch"],
    [/Ion\s*Implant/gi, "Ion Implant"], [/Diffusion/gi, "Diffusion"], [/Thin\s*Film/gi, "Thin Film"], [/Cleaning/gi, "Cleaning"], [/\bCMP\b/gi, "CMP"],
  ];
  const COLLABORATOR_RULES = [/유관\s*부서/gi, /장비\s*업체/gi, /협력사/gi, /고객사?/gi, /연구소/gi, /생산\s*부서/gi, /품질\s*부서/gi, /개발\s*부서/gi, /외부\s*업체/gi];
  const METRIC_RULES = [/수율\s*(향상|개선|증대)?/gi, /생산성\s*(향상|개선)?/gi, /가동률\s*(향상|개선)?/gi, /품질\s*(안정화|향상|개선|확보)?/gi, /원가\s*(절감|개선)?/gi, /수익성\s*(향상|개선)?/gi, /처리량\s*(향상|개선)?/gi, /불량률\s*(감소|개선)?/gi, /납기\s*(준수|단축)?/gi];
  const KNOWLEDGE_HINT = /(전공|지식|이해|원리|공학|과학|기술|공정|설계|알고리즘|회로|재료|통계)/i;
  const COMPETENCY_HINT = /(경험|역량|능력|가능한\s*분|이해|활용|분석|설계|개발|협업|커뮤니케이션|문제\s*해결)/i;
  const ELIGIBILITY_HINT = /(학위|졸업|전공|성적|어학|영어|자격증?|경력\s*\d|병역|근무\s*가능)/i;
  const DUTY_HINT = /(담당|수행|설계|구축|운영|관리|검토|분석|개선|개발|최적화|산출|수립|지원|적용|평가|확보|협업)/i;

  function normalize(value) { return String(value || "").toLocaleLowerCase("ko").replace(/[\s·•\-–—_*()[\]{}<>:：,.;!?/\\'’]+/g, ""); }
  function clean(value) { return String(value || "").replace(/^\s*(?:[-–—•·▪▶✓✔]|\d+[.)]|[가-힣][.)])\s*/, "").replace(/\s+([,.;:!?])/g, "$1").replace(/\s+/g, " ").trim(); }
  function sectionRule(text) { const heading = clean(text).replace(/[.!?]+$/, ""); return SECTION_RULES.find((rule) => rule.regex.test(heading)); }
  function markBoundaries(value) {
    let text = String(value || "").replace(/\r/g, "\n").replace(/we\s*[•·]\s*re/gi, "we're").replace(/you\s*[•·]\s*ll/gi, "you'll").replace(/\blon\s+lmplant\b/gi, "Ion Implant");
    const headings = [/minimum\s+qualifications?/gi, /basic\s+qualifications?/gi, /preferred\s+qualifications?/gi, /responsibilities/gi, /what\s+you(?:'|’)?ll\s+(do|experience)/gi, /who\s+we(?:'|’)?re\s+looking\s+for/gi, /담당\s*업무/gi, /주요\s*업무/gi, /지원\s*자격/gi, /지원자격/gi, /자격\s*요건/gi, /필수\s*(조건|요건)/gi, /우대\s*(사항|조건)/gi, /이런\s*역량이나\s*경\S{0,2}이\s*있다면\s*더\s*좋습니다/gi];
    headings.forEach((regex) => { text = text.replace(regex, (match) => `\n§H§${match}\n`); });
    return text.replace(/(^|\s)(\d{1,2}[.)])(?=\s*[가-힣A-Za-z])/g, "$1\n§N§$2\n").replace(/\s*[•▪▶✓✔]\s*/g, "\n§B§").replace(/\s+·\s+/g, "\n§B§").replace(/\n{3,}/g, "\n\n");
  }
  function segment(sourceText) {
    const source = String(sourceText || ""); const units = []; let buffer = ""; let section = "unspecified"; let group = ""; let counter = 0;
    const flush = () => {
      const text = clean(buffer); buffer = ""; if (text.length < 2) return;
      const exactStart = source.indexOf(text); units.push({ id: `JD-${String(units.length + 1).padStart(2, "0")}`, text, section, group: group || `U${++counter}`, start: exactStart, end: exactStart >= 0 ? exactStart + text.length : -1, verified: normalize(source).includes(normalize(text)) });
    };
    markBoundaries(source).split(/\n+/).forEach((raw) => {
      let line = raw.trim(); if (!line || /^\[\d+쪽\]$/.test(line)) return;
      const bracket = line.match(/^\[([^\]]+)\]$/); const bracketRule = bracket ? sectionRule(bracket[1]) : null;
      if (bracketRule) { flush(); section = bracketRule.level; group = ""; return; }
      const plainRule = sectionRule(line);
      if (plainRule) { flush(); section = plainRule.level; group = ""; return; }
      if (line.startsWith("§H§")) { flush(); const rule = sectionRule(line.slice(3)); if (rule) section = rule.level; group = ""; return; }
      if (line.startsWith("§N§")) { flush(); group = `N${line.slice(3).replace(/\D/g, "")}`; return; }
      if (line.startsWith("§B§") || /^[-–—]\s+/.test(line)) { flush(); line = line.startsWith("§B§") ? line.slice(3).trim() : line.replace(/^[-–—]\s+/, ""); if (!group) group = `U${++counter}`; else if (!/^N\d+$/.test(group)) group = `U${++counter}`; }
      if (!line) return; if (buffer && /[.!?]$/.test(buffer)) flush(); buffer = buffer ? `${buffer} ${line}` : line;
    }); flush();
    // 복사 과정에서 소제목이 사라졌더라도, 자격요건 앞의 번호 업무 블록은
    // 버리지 않는다. 단, 일반 소개 문장을 업무로 단정하지 않도록 번호 표지가
    // 있거나 명확한 수행 동사가 있는 의미 단위만 제한적으로 복원한다.
    units.forEach((unit) => {
      if (unit.section !== "unspecified") return;
      if ((/^N\d+$/.test(unit.group) || DUTY_HINT.test(unit.text)) && DUTY_HINT.test(unit.text)) unit.section = "duty_inferred";
    });
    return units;
  }
  function previewSource(sourceText) {
    const units = segment(sourceText); if (!units.length) throw new Error("분석할 JD 원문을 입력해 주세요.");
    return { cleanedText: String(sourceText || "").trim(), units, semanticUnitCount: units.length, headingCount: new Set(units.map((u) => u.section).filter((s) => s !== "unspecified")).size, warnings: units.every((u) => u.verified) ? [] : ["일부 의미 단위를 원문에서 정확히 다시 찾지 못했습니다. 원문을 확인해 주세요."] };
  }
  function unique(values) { return [...new Set(values.filter(Boolean))]; }
  function matches(text, rules) { return unique(rules.flatMap((rule) => [...String(text).matchAll(rule)].map((match) => match[0].trim()))); }
  function fact(value, evidenceIds) { return { value: String(value || "").trim(), evidenceIds: unique(evidenceIds) }; }
  function mergeFacts(rows) {
    const merged = new Map();
    rows.filter((row) => row?.value).forEach((row) => {
      const key = normalize(row.value);
      if (!merged.has(key)) merged.set(key, fact(row.value, row.evidenceIds));
      else merged.get(key).evidenceIds = unique([...merged.get(key).evidenceIds, ...(row.evidenceIds || [])]);
    });
    return [...merged.values()];
  }
  function safeTest(regex, text) { regex.lastIndex = 0; return regex.test(text); }
  function extractJobTitle(source, units, userRole) {
    const match = String(source).match(/(?:직무명|모집\s*직무|포지션|position)\s*[:：]\s*([^\n]{2,60})/i);
    if (match) {
      const value = clean(match[1]);
      const evidence = units.find((unit) => normalize(unit.text).includes(normalize(value)) || /직무명|모집\s*직무|포지션|position/i.test(unit.text));
      return { value, evidenceIds: evidence ? [evidence.id] : [], origin: evidence ? "jd" : "unverified" };
    }
    return userRole ? { value: String(userRole).trim(), evidenceIds: [], origin: "user" } : { value: "원문에 없음", evidenceIds: [], origin: "none" };
  }
  function keywordFacts(units) {
    const rows = [];
    units.forEach((unit) => KEYWORD_RULES.forEach(([regex, standard]) => { [...unit.text.matchAll(regex)].forEach((match) => rows.push({ original: match[0].trim(), standardized: standard, evidenceIds: [unit.id] })); }));
    const seen = new Set(); return rows.filter((row) => { const key = `${row.original}|${row.standardized}`; if (seen.has(key)) return false; seen.add(key); return true; }).slice(0, 20);
  }
  function extractFacts(source, units, roleName) {
    const dutyUnits = units.filter((u) => u.section === "duty" || u.section === "duty_inferred");
    const duties = mergeFacts(dutyUnits.map((u) => fact(u.text, [u.id])));
    const requiredUnits = units.filter((u) => u.section === "required"); const preferredUnits = units.filter((u) => u.section === "preferred");
    const required = requiredUnits.filter((u) => ELIGIBILITY_HINT.test(u.text)).map((u) => fact(u.text, [u.id]));
    const competencies = mergeFacts([...requiredUnits, ...preferredUnits].filter((u) => COMPETENCY_HINT.test(u.text) && !ELIGIBILITY_HINT.test(u.text)).map((u) => fact(u.text, [u.id])));
    const preferred = mergeFacts(preferredUnits.map((u) => fact(u.text, [u.id])));
    const statedKnowledge = [...requiredUnits, ...preferredUnits].filter((u) => KNOWLEDGE_HINT.test(u.text)).map((u) => fact(u.text, [u.id]));
    const technicalKnowledge = units.flatMap((u) => TECH_RULES.flatMap(([regex, name]) => safeTest(regex, u.text) ? [fact(name, [u.id])] : []));
    const knowledge = mergeFacts([...statedKnowledge, ...technicalKnowledge]).slice(0, 12);
    const tools = mergeFacts(units.flatMap((u) => TOOL_RULES.flatMap(([regex, name]) => safeTest(regex, u.text) ? [fact(name, [u.id])] : [])));
    const collaborators = mergeFacts(units.flatMap((u) => matches(u.text, COLLABORATOR_RULES).map((value) => fact(value, [u.id]))));
    const metrics = mergeFacts(units.flatMap((u) => matches(u.text, METRIC_RULES).map((value) => fact(value, [u.id]))));
    return { jobTitle: extractJobTitle(source, units, roleName), duties, competencies, required: mergeFacts(required), preferred, knowledge, tools, collaborators, metrics, keywords: keywordFacts(units) };
  }
  function interpretation(label, value, evidenceIds) { return { label, value, evidenceIds: unique(evidenceIds), status: evidenceIds.length ? "supported" : "insufficient" }; }
  function buildInterpretations(facts) {
    const rows = []; const dutyRefs = unique(facts.duties.slice(0, 4).flatMap((row) => row.evidenceIds)); const metricRefs = unique(facts.metrics.slice(0, 4).flatMap((row) => row.evidenceIds));
    if (facts.duties.length && facts.metrics.length) rows.push(interpretation("직무 Mission", `JD에 명시된 주요 업무를 수행해 ${unique(facts.metrics.map((r) => r.value)).slice(0, 3).join("·")} 목표에 기여하는 역할로 해석됩니다.`, [...dutyRefs, ...metricRefs]));
    else rows.push(interpretation("직무 Mission", "해석 근거 부족", []));
    if (facts.duties.length >= 2) rows.push(interpretation("예상 업무 흐름", facts.duties.slice(0, 4).map((row, i) => `${i + 1}. ${row.value}`).join(" → "), dutyRefs));
    else rows.push(interpretation("예상 업무 흐름", "해석 근거 부족", []));
    if (facts.metrics.length) rows.push(interpretation("성과 목표/KPI 의미", `${unique(facts.metrics.map((r) => r.value)).join("·")}은(는) 업무 결과를 확인할 때 살펴볼 성과 기준 후보입니다. 실제 산식과 목표값은 원문에 없으면 확인할 수 없습니다.`, metricRefs));
    else rows.push(interpretation("성과 목표/KPI 의미", "해석 근거 부족", []));
    const problemKeywords = facts.keywords.filter((row) => ["Problem Solving", "Quality Improvement", "Productivity Improvement", "Equipment Utilization Improvement", "Yield Improvement"].includes(row.standardized));
    if (problemKeywords.length) {
      const labels = unique(problemKeywords.map((row) => ({
        "Problem Solving": "저해 요인",
        "Quality Improvement": "품질",
        "Productivity Improvement": "생산성",
        "Equipment Utilization Improvement": "가동률",
        "Yield Improvement": "수율",
      }[row.standardized])));
      rows.push(interpretation("대표 문제 상황", `JD가 언급한 ${labels.join("·")} 문제의 원인을 확인하고 개선안을 검증하는 상황이 발생할 가능성이 있습니다.`, problemKeywords.flatMap((r) => r.evidenceIds)));
    }
    else rows.push(interpretation("대표 문제 상황", "해석 근거 부족", []));
    if (facts.competencies.length || facts.keywords.length) rows.push(interpretation("중요해 보이는 역량", unique([...facts.competencies.slice(0, 3).map((r) => r.value), ...facts.keywords.slice(0, 4).map((r) => r.original)]).join(" / "), unique([...facts.competencies.flatMap((r) => r.evidenceIds), ...facts.keywords.flatMap((r) => r.evidenceIds)])));
    else rows.push(interpretation("중요해 보이는 역량", "해석 근거 부족", []));
    return rows;
  }
  function studySuggestions(facts) {
    const suggestions = [];
    const add = (name, reason, keyword) => { const refs = facts.keywords.filter((r) => r.standardized === keyword).flatMap((r) => r.evidenceIds); if (refs.length && !facts.tools.some((r) => r.value === name)) suggestions.push({ name, reason, evidenceIds: unique(refs) }); };
    add("Python", "데이터 전처리·분석 기초 연습 후보", "Data Analysis"); add("SQL", "업무 데이터 조회·집계 학습 후보", "Data Analysis");
    add("JMP 또는 Minitab", "공정·품질 데이터 비교와 통계 해석 학습 후보", "Process Optimization"); add("PLC 기초", "설비 자동화 구조 이해를 위한 학습 후보", "Automation / Smart Factory");
    return suggestions.slice(0, 3);
  }

  const WORK_AXIS_RULES = [
    { id: "launch", title: "제품·양산 준비", regex: /신차|신제품|신규\s*제품|양산\s*(준비|전환)|제품\s*도입|개발\s*단계/, purpose: "제품을 실제 생산·운영 환경에 안정적으로 도입" },
    { id: "line", title: "공정·라인 설계", regex: /라인|레이아웃|layout|공법|투자비|표준\s*인원|공장\s*건설|공정\s*설계|운영관리\s*프로세스/, purpose: "필요 생산능력과 운영 효율을 갖춘 생산 체계를 설계" },
    { id: "automation", title: "자동화·시스템 고도화", regex: /자동화|스마트\s*팩토리|빅데이터|\bAI\b|인공지능|비전|시스템\s*(구축|확대|고도화)|디지털/, purpose: "자동화와 데이터 활용으로 운영 수준을 높임" },
    { id: "improvement", title: "생산성·품질 개선", regex: /생산성|가동률|품질|수율|원가|수익성|저해\s*요인|불량|처리량|납기|최적화/, purpose: "손실 요인을 찾아 JD가 제시한 성과 목표를 개선" },
    { id: "operations", title: "운영·안정화", regex: /운영|관리|안정|set[- ]?up|유지|모니터링|생산\s*공정/, purpose: "공정·설비·서비스가 안정적으로 작동하도록 관리" },
    { id: "data", title: "데이터 분석·활용", regex: /데이터\s*(분석|활용)|파이프라인|데이터베이스|\bSQL\b|통계|모델/, purpose: "데이터를 수집·분석해 판단과 개선에 활용" },
    { id: "software", title: "개발·구현", regex: /소프트웨어|프로그램|프로그래밍|코드|\bAPI\b|배포|테스트|개발|구현/, purpose: "요구 기능을 실제 시스템이나 프로그램으로 구현" },
    { id: "research", title: "연구·평가·검증", regex: /연구|실험|평가|검증|시험|특성\s*분석/, purpose: "가설이나 기술의 성능을 평가하고 검증" },
    { id: "business", title: "고객·사업 실행", regex: /고객|시장|영업|전략|사업|매출/, purpose: "고객과 시장 요구를 사업 성과로 연결" },
  ];

  function evidenceOf(rows) { return unique((rows || []).flatMap((row) => row.evidenceIds || [])); }
  function topicParticle(word) {
    const last = String(word || "").slice(-1); const code = last.charCodeAt(0);
    if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 === 0 ? "는" : "은";
    return "는";
  }
  function shortDuty(text) {
    const value = clean(text).replace(/^(?:담당\s*업무\s*)/i, "");
    const colon = value.split(/[:：]/);
    if (colon.length > 1 && colon[0].length >= 3 && colon[0].length <= 32) return `${colon[0].trim()}: ${colon.slice(1).join(":").trim()}`;
    return value.length > 170 ? `${value.slice(0, 167).trim()}…` : value;
  }
  function axisScore(text, axis) {
    const matches = String(text).match(new RegExp(axis.regex.source, "gi"));
    return matches ? matches.length : 0;
  }
  function buildWorkAxes(facts) {
    const buckets = new Map(); const unclassified = [];
    facts.duties.forEach((duty) => {
      const ranked = WORK_AXIS_RULES.map((axis) => ({ axis, score: axisScore(duty.value, axis) })).sort((a, b) => b.score - a.score);
      if (!ranked[0] || ranked[0].score === 0) { unclassified.push(duty); return; }
      const selected = ranked[0].axis;
      if (!buckets.has(selected.id)) buckets.set(selected.id, { ...selected, duties: [] });
      buckets.get(selected.id).duties.push(duty);
    });
    const axes = [...buckets.values()].map((axis) => ({
      id: axis.id,
      title: axis.title,
      actualWork: axis.duties.map((row) => shortDuty(row.value)),
      purpose: axis.purpose,
      evidenceIds: evidenceOf(axis.duties),
    }));
    if (unclassified.length) axes.push({ id: "other", title: "기타 핵심 업무", actualWork: unclassified.map((row) => shortDuty(row.value)), purpose: "사전에 맞지 않더라도 JD가 직접 제시한 업무로 보존", evidenceIds: evidenceOf(unclassified) });
    return axes.slice(0, 6);
  }
  function hasAny(text, regex) { regex.lastIndex = 0; return regex.test(String(text)); }
  function matchingEvidence(facts, regex) {
    const rows = [...facts.duties, ...facts.metrics, ...facts.keywords.map((row) => ({ value: row.original, evidenceIds: row.evidenceIds }))];
    return evidenceOf(rows.filter((row) => hasAny(row.value, regex)));
  }
  function buildProblems(facts, axes) {
    const candidates = [
      { regex: /가동률|저해\s*요인/, problem: "가동률을 떨어뜨리는 요인이 발생함", target: "설비·공정의 저해 요인", direction: "저해 요인을 검토·분석하고 개선", result: "가동률·생산성 개선" },
      { regex: /품질|불량/, problem: "생산 과정에서 요구 품질을 확보해야 함", target: "JD에 언급된 제품·부품 품질", direction: "품질 상태를 확인하고 확보·개선 활동을 수행", result: "품질 확보·개선" },
      { regex: /수율/, problem: "생산 과정에서 수율 손실이 발생함", target: "공정 조건과 수율 저하 요인", direction: "조건을 최적화하고 결과를 확인", result: "수율 향상" },
      { regex: /원가|투자비|수익성/, problem: "기술 선택과 생산 체계의 경제성을 함께 판단해야 함", target: "공법·투자비·원가·수익성", direction: "대안을 검토하고 비용·수익 관점에서 비교", result: "투자 타당성·수익성 확보" },
      { regex: /신차|신제품|양산\s*(준비|전환)|개발\s*단계/, problem: "새 제품을 생산 현장에 안정적으로 도입해야 함", target: "제품 구조·공법·라인·운영 조건", direction: "사전 검토와 설계·품질 확보를 병행", result: "안정적인 제품·양산 준비" },
      { regex: /자동화|스마트\s*팩토리|빅데이터|\bAI\b|비전/, problem: "자동화 설비와 데이터 활용 수준을 높여야 함", target: "JD에 언급된 자동화 설비와 데이터 활용 방식", direction: "자동화·데이터 기술을 개발하고 현장에 적용", result: "생산 체계 고도화" },
    ];
    return candidates.map((row) => ({ ...row, evidenceIds: matchingEvidence(facts, row.regex) })).filter((row) => row.evidenceIds.length).slice(0, 5);
  }
  function buildCompetencyLinks(facts, axes) {
    const rows = [...facts.competencies, ...facts.preferred, ...facts.required];
    const seen = new Set(); const links = [];
    rows.forEach((row) => {
      const value = row.value; const normalized = normalize(value); if (!normalized || seen.has(normalized)) return;
      let axis = axes.find((item) => item.actualWork.some((work) => {
        const tokens = value.match(/[가-힣A-Za-z]{2,}/g) || [];
        return tokens.some((token) => normalize(work).includes(normalize(token)));
      }));
      if (!axis && /분석|데이터|Python|SQL|통계|프로그램/i.test(value)) axis = axes.find((item) => ["data", "automation", "improvement", "software"].includes(item.id));
      if (!axis && /공정|원리|반도체|설계|전공|공학/i.test(value)) axis = axes.find((item) => ["operations", "improvement", "line", "research"].includes(item.id));
      if (!axis && /협업|커뮤니케이션/i.test(value)) axis = axes[0];
      if (!axis) return;
      let reason = `${axis.title} 업무의 대상을 이해하고 실행하기 위한 배경으로 연결됩니다.`;
      if (/분석|데이터|Python|SQL|통계/i.test(value)) reason = `${axis.title}에서 현상을 수치로 확인하고 원인을 좁히는 데 연결됩니다.`;
      else if (/협업|커뮤니케이션/i.test(value)) reason = `${axis.title} 수행 중 관련 조직과 조건·일정·결과를 조율하는 데 연결됩니다.`;
      else if (/공정|원리|반도체|설계|공학/i.test(value)) reason = `${axis.title}의 변수와 기술적 제약을 이해하는 기반으로 연결됩니다.`;
      links.push({ requirement: value, axisTitle: axis.title, reason, evidenceIds: unique([...(row.evidenceIds || []), ...axis.evidenceIds]) }); seen.add(normalized);
    });
    return links.slice(0, 6);
  }
  function buildPerformanceGroups(facts, axes) {
    const groups = [
      ["생산 운영", /생산성|가동률|처리량|납기/], ["품질", /품질|수율|불량률/], ["경제성", /원가|투자비|수익성/], ["구축·고도화 목표", /안정|자동화|최적화|스마트\s*팩토리/],
    ];
    const rows = [...facts.metrics, ...facts.keywords.map((row) => ({ value: row.original, evidenceIds: row.evidenceIds }))];
    return groups.map(([category, regex]) => {
      const matched = mergeFacts(rows.filter((row) => hasAny(row.value, regex)));
      if (!matched.length) return null;
      const items = [];
      matched.map((row) => row.value).sort((a, b) => b.length - a.length).forEach((value) => {
        if (!items.some((item) => normalize(item).includes(normalize(value)) || normalize(value).includes(normalize(item)))) items.push(value);
      });
      const relatedAxes = axes.filter((axis) => axis.actualWork.some((work) => hasAny(work, regex))).map((axis) => axis.title);
      return { category, items, connection: relatedAxes.length ? `${unique(relatedAxes).join("·")} 업무의 결과를 확인하는 기준입니다.` : "JD가 직접 언급한 업무 결과 기준입니다.", evidenceIds: evidenceOf(matched) };
    }).filter(Boolean);
  }
  function buildEmphasis(facts, axes) {
    const concepts = [
      ["생산성과 가동률", /생산성|가동률/], ["품질과 수율", /품질|수율|불량/], ["자동화와 데이터 활용", /자동화|스마트\s*팩토리|빅데이터|\bAI\b|비전|데이터/],
      ["공정·라인 설계", /라인|레이아웃|공법|공정\s*설계/], ["경제성", /원가|투자비|수익성/], ["운영 안정화", /운영|안정|set[- ]?up|관리/],
    ];
    const evidenceRows = [...facts.duties, ...facts.competencies, ...facts.required, ...facts.preferred];
    return concepts.map(([label, regex]) => {
      const matched = evidenceRows.filter((row) => hasAny(row.value, regex)); const refs = evidenceOf(matched);
      if (!refs.length) return null;
      const count = refs.length; const inDuty = facts.duties.some((row) => hasAny(row.value, regex));
      const level = count >= 2 ? "핵심 강조" : inDuty ? "중요" : "보조";
      return { label, level, reason: count >= 2 ? `서로 다른 ${count}개 의미 단위에서 반복됩니다.` : "주요 업무 문장에서 직접 확인됩니다.", evidenceIds: refs };
    }).filter(Boolean).sort((a, b) => {
      const scores = { "핵심 강조": 3, "중요": 2, "보조": 1 };
      return scores[b.level] - scores[a.level];
    }).slice(0, 6);
  }
  function buildPreparation(facts, axes, suggestions) {
    const must = facts.required.slice(0, 5).map((row) => ({ title: row.value, detail: "지원 전 충족 여부를 원문 기준으로 먼저 확인해야 합니다.", evidenceIds: row.evidenceIds }));
    const strengths = [...facts.preferred, ...facts.competencies].slice(0, 5).map((row) => {
      const axis = axes.find((item) => item.evidenceIds.some((id) => row.evidenceIds.includes(id))) || axes[0];
      return { title: row.value, detail: axis ? `${axis.title} 업무와 연결되는 경험을 구체적인 행동·결과로 설명할 준비가 필요합니다.` : "JD 문장과 직접 연결되는 경험 근거를 준비할 수 있습니다.", evidenceIds: unique([...(row.evidenceIds || []), ...(axis?.evidenceIds || [])]) };
    });
    if (!strengths.length) axes.slice(0, 3).forEach((axis) => strengths.push({ title: axis.title, detail: "이 업무와 관련해 본인이 수행한 행동·판단·산출물을 설명할 수 있도록 정리합니다.", evidenceIds: axis.evidenceIds }));
    const study = suggestions.map((row) => ({ title: row.name, detail: row.reason, evidenceIds: row.evidenceIds }));
    return { must, strengths, study };
  }
  function buildCareerAnalysis(facts, suggestions) {
    const workAxes = buildWorkAxes(facts); const performanceGroups = buildPerformanceGroups(facts, workAxes);
    const metricNames = unique(performanceGroups.flatMap((row) => row.items)).slice(0, 4);
    const axisNames = workAxes.slice(0, 3).map((row) => row.title);
    const definitionRefs = unique([...workAxes.slice(0, 3).flatMap((row) => row.evidenceIds), ...performanceGroups.flatMap((row) => row.evidenceIds)]);
    const role = facts.jobTitle.value === "원문에 없음" ? "이 직무" : facts.jobTitle.value;
    const definition = definitionRefs.length && axisNames.length
      ? interpretation("직무 한 줄 정의", `${role}${topicParticle(role)} ${axisNames.join("·")}을 수행해 ${metricNames.length ? `${metricNames.join("·")} 같은 성과` : "JD에 제시된 업무 목표"}를 확보·개선하는 역할로 해석됩니다.`, definitionRefs)
      : interpretation("직무 한 줄 정의", "해석 근거 부족", []);
    return {
      definition,
      workAxes,
      problems: buildProblems(facts, workAxes),
      competencyLinks: buildCompetencyLinks(facts, workAxes),
      performanceGroups,
      emphasis: buildEmphasis(facts, workAxes),
      preparation: buildPreparation(facts, workAxes, suggestions),
    };
  }
  function analyze(input) {
    const source = String(input?.jdText || "").trim(); if (!source) throw new Error("분석할 JD 원문을 입력해 주세요.");
    const units = segment(source); const facts = extractFacts(source, units, input?.roleName); const interpretations = buildInterpretations(facts); const suggestions = studySuggestions(facts); const warnings = [];
    if (units.some((u) => !u.verified)) warnings.push("일부 근거 문장을 원문에서 다시 찾지 못해 해당 결과를 최종 사실로 확정하지 않았습니다.");
    if (!units.some((u) => u.section === "duty") && units.some((u) => u.section === "duty_inferred")) warnings.push("주요 업무 소제목이 없어 번호·수행 동사를 기준으로 업무 의미 단위를 복원했습니다. 원문과 대조해 주세요.");
    if (!units.some((u) => u.section === "duty" || u.section === "duty_inferred")) warnings.push("주요 업무 소제목 또는 명확한 업무 문장을 찾지 못했습니다. 업무 Fact를 ‘원문에 없음’으로 표시합니다.");
    return { units, facts, interpretations, studySuggestions: suggestions, careerAnalysis: buildCareerAnalysis(facts, suggestions), warnings, analyzedAt: new Date().toISOString() };
  }

  root.JDAnalyzer = { SECTION_RULES, KEYWORD_RULES, TOOL_RULES, normalize, clean, segment, previewSource, extractFacts, buildInterpretations, studySuggestions, buildCareerAnalysis, analyze };
  if (typeof module !== "undefined" && module.exports) module.exports = root.JDAnalyzer;
})(typeof window !== "undefined" ? window : globalThis);
