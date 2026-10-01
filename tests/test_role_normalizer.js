const assert = require("node:assert/strict");
const normalizer = require("../docs/role-normalizer.js");

assert.equal(normalizer.mapRole("삼성전자 공정기술").category, "공정·양산 엔지니어링");
assert.equal(normalizer.mapRole("SK하이닉스 양산기술").category, "공정·양산 엔지니어링");
assert.equal(normalizer.mapRole("알 수 없는 직무").confidence, "low");

const samsung = normalizer.detect("2026 삼성전자 DS부문 공정기술 채용공고");
assert.equal(samsung.company, "Samsung Electronics");
assert.equal(samsung.role.original, "공정기술");

const hynix = normalizer.detect("SK hynix 양산기술 직무 소개");
assert.equal(hynix.company, "SK hynix");
assert.equal(hynix.role.category, "공정·양산 엔지니어링");

const multiple = normalizer.detectRoles("공정기술과 패키지개발 직무를 함께 모집합니다.");
assert.deepEqual(multiple.map((row) => row.original), ["공정기술", "패키지개발"]);

console.log("Role normalizer tests passed");
