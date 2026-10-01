const assert = require("node:assert/strict");
const analyzer = require("../docs/jd-analyzer-v2.js");

const compactHynix = `이천/청주/용인 양산기술 About Us 우리는 이련 가치를 만듭니다. What You'll Experience 경험할 수 있습니다 WhO we•re Looking for 우리는 이련 사람을 찾고 있습니다. 개발 완료된 제품이 최고의 품질과 성능을 갖줘 안정적으로 생산될 수 있도록 생산 공정과 테스트를 구현하고 최적화하는 역할을 담당합니다 • 공정 운영 및 최적화 Photolithography, Etch, lon lmplant & Diffusion, Thin Film, Cleaning & CMP 등 핵심 양산 공정을 안정적으로 운영하고, 조건을 최적화하여 생산 품질과 수율을 높입니다 • 장비 Set-up 관리 및 개선 반도체 장비를 Set-up하고 지속적인 개조 개선을 수행하며, 장비 업체와 협업함으로써 공정 성능과 생산성을 극대화합니다 • 파생제품 및 요소기술 개발 신규 파생 제품과 핵심 요소 기술을 개발하여 경쟁력을 강화하고 차세대 제품 대응 기반을 마련합니다 • AMHS 설계/구축/운영/제어 OHT, Stocker, Conveyor, AMR 등의 자동반송 H/W 시스템의 Layout 설계/구축/운영 및 반송 제어(MCS) 최적화(Throughput/Utilization) 업무를 수행합니다. 이런 역량이나 경협이 있다면 더 좋습니다 • 전자, 전기, 화공, 화학, 재료, 물리, 반도체, 기계, 산업공학 등 관련 분야에 경험과 역량이 있는 분 • 반도체 공정 전반의 흐름과 원리를 이해하고 있는 분 • 반도체 관련 실험이나 프로젝트를 통해 학습해본 경험이 있는 분 • TEST/분석 프로그램 개발 등 프로그래밍을 활용해본 경험이 있는 분`;

const preview = analyzer.previewSource(compactHynix);
assert.equal(preview.headingCount >= 3, true);
assert.equal(preview.semanticUnitCount >= 8, true);
assert.equal(preview.warnings.length >= 2, true);
assert.equal(preview.cleanedText.includes("Ion Implant"), true);
assert.equal(preview.cleanedText.includes("[회사 소개]"), true);

const requirements = analyzer.parseRequirements(preview.cleanedText);
assert.equal(requirements.some((row) => /Who we/i.test(row.text)), false);
assert.equal(requirements.some((row) => row.text.includes("Photolithography, Etch, Ion Implant & Diffusion, Thin Film, Cleaning & CMP")), true);
assert.equal(requirements.some((row) => row.competencies.includes("wafer_processes")), true);
assert.equal(requirements.some((row) => row.competencies.includes("equipment_supplier")), true);
assert.equal(requirements.some((row) => row.competencies.includes("amhs_control")), true);
assert.equal(requirements.some((row) => row.competencies.includes("related_majors")), true);
assert.equal(requirements.every((row) => row.quoteVerified), true);

const genericDevelopment = analyzer.parseRequirements("[담당 업무]\n개발 완료된 제품을 안정적으로 생산합니다.");
assert.equal(genericDevelopment.some((row) => row.competencies.includes("product_technology")), false);

const result = analyzer.analyze({ jdText: preview.cleanedText, roleName: "양산기술", experienceText: "" });
assert.equal(result.profileProvided, false);
assert.equal(result.workBlocks.length >= 4, true);
assert.equal(result.topStrategies.length >= 4, true);
assert.equal(new Set(result.topStrategies.map((row) => row.requirementId)).size, result.topStrategies.length);
assert.equal(result.summary.includes("양산기술"), true);
assert.equal(Array.isArray(result.frequency), false);
assert.equal(result.studyTopics.every((row) => /Top \d · J\d/.test(row.basedOn)), true);
assert.equal(result.suggestedQuestions.every((row) => /^J\d+$/.test(row.requirementId)), true);

const profileResult = analyzer.analyze({
  jdText: preview.cleanedText,
  roleName: "양산기술",
  experienceText: "반도체 공정 실습에서 Photolithography와 Etch 조건별 측정 결과를 비교함\nPython으로 TEST 분석 프로그램을 만들어 반복 판정을 자동화함",
});
assert.equal(profileResult.profileProvided, true);
assert.equal(profileResult.matches.length > 0, true);
assert.equal(profileResult.suggestedQuestions.some((row) => row.experience?.id?.startsWith("E")), true);

const unclassified = analyzer.analyze({
  jdText: "[담당 업무]\n고객 요청 문서를 작성하고 정리합니다.",
  roleName: "기타 직무",
  experienceText: "",
});
assert.equal(unclassified.requirements[0].competencies.length, 0);
assert.equal(unclassified.requirements[0].classificationReason.includes("임의 분류하지 않음"), true);

console.log("JD analyzer v2 tests passed");
