const assert = require("node:assert/strict");
const analyzer = require("../docs/jd-analyzer-v4.js");

function assertEvidenceIntegrity(result) {
  const ids = new Set(result.units.map((row) => row.id));
  const factRows = [
    ...result.facts.duties,
    ...result.facts.competencies,
    ...result.facts.required,
    ...result.facts.preferred,
    ...result.facts.knowledge,
    ...result.facts.tools,
    ...result.facts.collaborators,
    ...result.facts.metrics,
    ...result.facts.keywords,
  ];
  factRows.forEach((row) => {
    assert.ok(row.evidenceIds.length > 0, `근거 없는 Fact: ${row.value || row.original}`);
    row.evidenceIds.forEach((id) => assert.ok(ids.has(id), `존재하지 않는 근거 번호: ${id}`));
  });
  result.interpretations.filter((row) => row.status === "supported").forEach((row) => {
    assert.ok(row.evidenceIds.length > 0, `근거 없는 해석: ${row.label}`);
    row.evidenceIds.forEach((id) => assert.ok(ids.has(id), `존재하지 않는 해석 근거: ${id}`));
  });
  const careerRows = [
    result.careerAnalysis.definition,
    ...result.careerAnalysis.workAxes,
    ...result.careerAnalysis.problems,
    ...result.careerAnalysis.competencyLinks,
    ...result.careerAnalysis.performanceGroups,
    ...result.careerAnalysis.deliveryGoals,
    ...result.careerAnalysis.emphasis,
    ...result.careerAnalysis.preparation.must,
    ...result.careerAnalysis.preparation.strengths,
    ...result.careerAnalysis.preparation.study,
  ].filter((row) => row.status !== "insufficient");
  careerRows.forEach((row) => {
    assert.ok(row.evidenceIds.length > 0, `근거 없는 직무 해석: ${row.title || row.label || row.problem || row.category}`);
    row.evidenceIds.forEach((id) => assert.ok(ids.has(id), `존재하지 않는 직무 해석 근거: ${id}`));
  });
}

const hyundai = `직무명: 생산기술
주요 업무
1) 신차 준비 및 생산 라인 설계: 공법과 투자비를 검토하고 신공장 건설, 레이아웃과 표준인원 및 공장 운영관리 프로세스를 수립합니다.
2) 자동화 설비 고도화 및 스마트팩토리 구축: 빅데이터, AI, 비전 활용 기술을 개발하고 E-FOREST 시스템을 확대 적용합니다.
3) 공장 생산성, 가동률, 수익성, 품질 개선: 가동률 저해요인을 분석하고 개선하며 신차 개발 단계별 부품 품질을 확보합니다.
Minimum qualifications
- 학사 또는 석사 학위를 취득했거나 졸업 예정인 분
- 기계공학, 자동차공학, 산업공학, 전기공학, 전자공학 전공인 분
- SPA, OPIc, TOEIC Speaking, TEPS Speaking 영어회화 성적을 보유한 분`;

const hyundaiResult = analyzer.analyze({ jdText: hyundai });
assert.equal(hyundaiResult.facts.jobTitle.value, "생산기술");
assert.equal(hyundaiResult.facts.jobTitle.origin, "jd");
assert.ok(hyundaiResult.facts.jobTitle.evidenceIds.length > 0);
assert.equal(hyundaiResult.facts.duties.length, 3);
assert.equal(hyundaiResult.facts.required.length, 3);
assert.ok(hyundaiResult.facts.metrics.some((row) => /가동률/.test(row.value)));
assert.ok(hyundaiResult.facts.tools.some((row) => row.value === "AI" ) === false);
assert.ok(hyundaiResult.facts.keywords.some((row) => row.standardized === "Automation / Smart Factory"));
assert.ok(hyundaiResult.careerAnalysis.definition.status === "supported");
assert.ok(hyundaiResult.careerAnalysis.workAxes.some((row) => row.id === "launch"));
assert.ok(hyundaiResult.careerAnalysis.workAxes.some((row) => row.id === "line"));
assert.ok(hyundaiResult.careerAnalysis.workAxes.some((row) => row.id === "economics"));
assert.ok(hyundaiResult.careerAnalysis.workAxes.some((row) => row.id === "automation"));
assert.ok(hyundaiResult.careerAnalysis.workAxes.some((row) => row.id === "operations_improvement"));
assert.ok(hyundaiResult.careerAnalysis.workAxes.some((row) => row.id === "quality"));
assert.ok(hyundaiResult.careerAnalysis.problems.some((row) => /가동률/.test(row.problem)));
assert.ok(hyundaiResult.careerAnalysis.performanceGroups.some((row) => row.category === "경제성 지표"));
assert.ok(hyundaiResult.careerAnalysis.deliveryGoals.some((row) => row.category === "자동화·혁신 목표"));
assert.ok(hyundaiResult.careerAnalysis.preparation.must.some((row) => /영어회화/.test(row.title)));
assert.equal(JSON.stringify(hyundaiResult.careerAnalysis).includes("수율"), false);
assert.equal(hyundaiResult.validation.status, "pass");
assert.equal(JSON.stringify(hyundaiResult).includes("재료·화학"), false);
assert.equal("profile" in hyundaiResult, false);
assertEvidenceIntegrity(hyundaiResult);

const hynix = `직무명: 양산기술
What You'll Experience
• Photolithography, Etch, Ion Implant & Diffusion, Thin Film, Cleaning & CMP 등 핵심 양산 공정을 안정적으로 운영하고 조건을 최적화하여 생산 품질과 수율을 높입니다.
• 반도체 장비를 Set-up하고 지속적인 개선을 수행하며 장비 업체와 협업합니다.
이런 역량이나 경험이 있다면 더 좋습니다
• 반도체 공정 전반의 흐름과 원리를 이해하고 있는 분
• TEST 분석 프로그램 개발 등 프로그래밍을 활용해본 경험이 있는 분`;
const hynixResult = analyzer.analyze({ jdText: hynix });
assert.equal(hynixResult.facts.duties.length, 2);
assert.equal(hynixResult.facts.preferred.length, 2);
assert.ok(hynixResult.facts.collaborators.some((row) => /장비\s*업체/.test(row.value)));
assert.ok(hynixResult.facts.metrics.some((row) => /수율/.test(row.value)));
assert.ok(hynixResult.careerAnalysis.workAxes.some((row) => row.id === "quality"));
assert.ok(hynixResult.careerAnalysis.competencyLinks.some((row) => /반도체 공정/.test(row.requirement)));
assertEvidenceIntegrity(hynixResult);

const generic = analyzer.analyze({
  roleName: "데이터 엔지니어",
  jdText: `주요 업무
- Python과 SQL을 사용해 데이터 파이프라인을 개발합니다.
- 개발 부서와 협업하여 데이터 품질을 개선합니다.
자격 요건
- Python 개발 경험
우대 사항
- Tableau 활용 경험`,
});
assert.equal(generic.facts.jobTitle.origin, "user");
assert.ok(generic.facts.tools.some((row) => row.value === "Python"));
assert.ok(generic.facts.tools.some((row) => row.value === "SQL"));
assert.ok(generic.facts.tools.some((row) => row.value === "Tableau"));
assert.ok(generic.facts.collaborators.some((row) => /개발\s*부서/.test(row.value)));
assert.ok(generic.careerAnalysis.workAxes.some((row) => ["data", "software"].includes(row.id)));
assert.equal("profile" in generic.careerAnalysis, false);
assertEvidenceIntegrity(generic);

const noRequirementHeading = analyzer.analyze({ jdText: "고객 데이터를 분석하고 서비스 품질을 개선합니다." });
assert.equal(noRequirementHeading.facts.required.length, 0);
assert.equal(noRequirementHeading.facts.preferred.length, 0);
assert.equal(noRequirementHeading.facts.jobTitle.value, "원문에 없음");
assert.ok(noRequirementHeading.warnings.length > 0);
assertEvidenceIntegrity(noRequirementHeading);

const noYieldContamination = analyzer.analyze({
  roleName: "생산기술",
  jdText: `주요 업무
- 생산 라인의 품질을 개선합니다.
- 자동화 설비를 구축하고 가동률 저해요인을 분석합니다.
우대 사항
- Python, R, DBMS 활용 경험
- 품질경영기사 자격증 보유`,
});
assert.equal(JSON.stringify(noYieldContamination.careerAnalysis).includes("수율"), false);
assert.equal(noYieldContamination.validation.status, "pass");
assert.ok(noYieldContamination.facts.tools.some((row) => row.value === "DBMS"));
assert.ok(noYieldContamination.careerAnalysis.competencyLinks.some((row) => /Python/.test(row.requirement)));
const licensePreparation = noYieldContamination.careerAnalysis.preparation.strengths.find((row) => /기사/.test(row.title));
assert.ok(licensePreparation);
assert.match(licensePreparation.detail, /특정 업무축에 억지로 연결하지 않고/);
assertEvidenceIntegrity(noYieldContamination);

const deliberateContamination = analyzer.validateCareerAnalysis("품질 개선", {
  definition: { value: "수율 개선" }, workAxes: [], problems: [], competencyLinks: [], performanceGroups: [], deliveryGoals: [], emphasis: [], preparation: { must: [], strengths: [], study: [] },
});
assert.equal(deliberateContamination.status, "fail");
assert.ok(deliberateContamination.unsupportedTerms.includes("수율"));

console.log("JD analyzer v4 tests passed");
