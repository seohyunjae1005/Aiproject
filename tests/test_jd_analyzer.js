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
assert.equal(unspecified.limitations.some((value) => value.includes("사용자 경험")), true);

const mixedRoles = analyzer.analyze({
  jdText: "모집 부문\n공정 엔지니어와 데이터 엔지니어 각 부문에서 분석 경험 보유자를 모집합니다.",
  experienceText: "분석 프로젝트 경험",
});
assert.equal(mixedRoles.limitations.some((value) => value.includes("여러 직무")), true);

console.log("JD analyzer tests passed");
