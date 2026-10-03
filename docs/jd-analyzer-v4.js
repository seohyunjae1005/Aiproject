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
  function analyze(input) {
    const source = String(input?.jdText || "").trim(); if (!source) throw new Error("분석할 JD 원문을 입력해 주세요.");
    const units = segment(source); const facts = extractFacts(source, units, input?.roleName); const interpretations = buildInterpretations(facts); const warnings = [];
    if (units.some((u) => !u.verified)) warnings.push("일부 근거 문장을 원문에서 다시 찾지 못해 해당 결과를 최종 사실로 확정하지 않았습니다.");
    if (!units.some((u) => u.section === "duty") && units.some((u) => u.section === "duty_inferred")) warnings.push("주요 업무 소제목이 없어 번호·수행 동사를 기준으로 업무 의미 단위를 복원했습니다. 원문과 대조해 주세요.");
    if (!units.some((u) => u.section === "duty" || u.section === "duty_inferred")) warnings.push("주요 업무 소제목 또는 명확한 업무 문장을 찾지 못했습니다. 업무 Fact를 ‘원문에 없음’으로 표시합니다.");
    return { units, facts, interpretations, studySuggestions: studySuggestions(facts), warnings, analyzedAt: new Date().toISOString() };
  }

  root.JDAnalyzer = { SECTION_RULES, KEYWORD_RULES, TOOL_RULES, normalize, clean, segment, previewSource, extractFacts, buildInterpretations, studySuggestions, analyze };
  if (typeof module !== "undefined" && module.exports) module.exports = root.JDAnalyzer;
})(typeof window !== "undefined" ? window : globalThis);
