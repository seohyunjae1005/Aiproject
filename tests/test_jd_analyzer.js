if (true) {
  require("./test_jd_analyzer_v4.js");
} else {
const assert = require("node:assert/strict");
const analyzer = require("../docs/jd-analyzer.js");

const jd = `담당 업무
- 공정 데이터를 분석하고 생산 조건을 개선합니다.
자격 요건
- Python을 활용한 데이터 분석 경험
- 유관 부서와 협업할 수 있는 커뮤니케이션 역량
우대 사항
- 반도체 공정 실습 경험`;

const experience = `반도체 공정 실습에서 측정 데이터를 정리하고 원인을 분석함
팀 프로젝트에서 발표를 담당함`;

const result = analyzer.analyze({ jdText: jd, experienceText: experience });

assert.equal(result.requirements.length, 4);
assert.equal(result.requirements.every((row) => row.quoteVerified), true);
assert.equal(result.requirements[1].level, "required");
assert.equal(result.requirements[3].level, "preferred");
assert.equal(result.experiences.length, 2);
assert.equal(result.matches.some((row) => row.experience), true);
assert.equal(result.frequency.some((row) => row.id === "data"), true);

const noInventedGap = analyzer.analyze({
  jdText: "자격 요건\n데이터 분석 경험을 보유한 사람",
  experienceText: "고객 상담 경험",
});
assert.equal(noInventedGap.learning.some((row) => /SPC|DOE/i.test(row.suggestion)), false);
assert.equal(noInventedGap.learning.every((row) => row.requirementId.startsWith("J")), true);

const unspecified = analyzer.analyze({
  jdText: "데이터를 활용하여 고객 문제를 분석하고 해결한 경험이 있는 분",
  experienceText: "",
});
assert.equal(unspecified.requirements[0].level, "unspecified");
assert.equal(unspecified.limitations.some((value) => value.includes("구분 없음")), true);
assert.equal(unspecified.limitations.some((value) => value.includes("프로필")), true);

const mixedRoles = analyzer.analyze({
  jdText: "모집 부문\n공정 엔지니어와 데이터 엔지니어 각 부문에서 분석 경험 보유자를 모집합니다.",
  experienceText: "분석 프로젝트 경험",
});
assert.equal(mixedRoles.limitations.some((value) => value.includes("여러 직무")), true);

const compactHynix = `이천/청주/용인 양산기술 About Us 우리는 이런 가치를 만듭니다. What You'll Experience 경험할 수 있습니다 Who we•re Looking for 우리는 이런 사람을 찾고 있습니다. 개발 완료된 제품이 최고의 품질과 성능을 갖춰 안정적으로 생산될 수 있도록 생산 공정과 테스트를 구현하고 최적화하는 역할을 담당합니다 • 공정 운영 및 최적화 Photolithography, Etch, Ion Implant & Diffusion, Thin Film, Cleaning & CMP 등 핵심 양산 공정을 안정적으로 운영하고 조건을 최적화하여 생산 품질과 수율을 높입니다 • 장비 Set-up 관리 및 개선 반도체 장비를 Set-up하고 지속적인 개조 개선을 수행하며 장비 업체와 협업합니다 • 파생제품 및 요소기술 개발 신규 파생 제품과 핵심 요소 기술을 개발합니다 이런 역량이나 경험이 있다면 더 좋습니다 전자, 전기, 화공, 화학, 재료, 물리, 반도체, 기계, 산업공학 등 관련 분야에 경험과 역량이 있는 분 • 반도체 공정 전반의 흐름과 원리를 이해하고 있는 분 • 반도체 관련 실험이나 프로젝트를 통해 학습해본 경험이 있는 분 • TEST/분석 프로그램 개발 등 프로그래밍을 활용해본 경험이 있는 분`;
const compactResult = analyzer.analyze({ jdText: compactHynix, experienceText: "" });
assert.equal(compactResult.requirements.length >= 6, true);
assert.equal(compactResult.requirements.some((row) => row.level === "duty"), true);
assert.equal(compactResult.requirements.some((row) => row.level === "preferred"), true);
assert.equal(compactResult.profileProvided, false);
assert.equal(compactResult.matches.length, 0);
assert.equal(compactResult.learning.every((row) => row.mode === "jd_only"), true);
assert.equal(compactResult.suggestedQuestions.length > 0, true);
assert.equal(compactResult.suggestedQuestions.every((row) => row.requirementIds.every((id) => id.startsWith("J"))), true);
assert.equal(compactResult.suggestedQuestions.every((row) => row.source === "jd_suggestion"), true);

const profileQuestionResult = analyzer.analyze({
  jdText: compactHynix,
  roleName: "양산기술",
  experienceText: "반도체 공정 실습에서 측정 데이터를 분석하고 공정 조건별 결과를 비교함\n팀 프로젝트에서 Python으로 반복 분석을 자동화함",
});
assert.equal(profileQuestionResult.profileProvided, true);
assert.equal(profileQuestionResult.suggestedQuestions.some((row) => row.experience?.id?.startsWith("E")), true);
assert.equal(profileQuestionResult.suggestedQuestions[0].question.includes("양산기술"), true);

console.log("JD analyzer tests passed");
}
