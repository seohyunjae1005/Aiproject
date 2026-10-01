const assert = require("node:assert/strict");
const profileStore = require("../docs/profile-store.js");

const memory = new Map();
const storage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, value),
  removeItem: (key) => memory.delete(key),
};

const saved = profileStore.save({
  education: "대학교 재학",
  major: "신소재공학",
  skills: "Python 데이터 분석\n반도체 공정 교육",
  certificates: "OPIc IM2",
  experiences: "공정 실습에서 측정 데이터를 비교함\n팀 프로젝트에서 일정 관리를 담당함",
}, storage);

assert.equal(profileStore.load(storage).major, "신소재공학");
assert.equal(profileStore.summary(saved).experienceCount, 2);
assert.equal(profileStore.summary(saved).ready, true);
assert.match(profileStore.toExperienceText(saved), /공정 실습/);
assert.match(profileStore.toExperienceText(saved), /보유 기술 및 교육: Python/);
assert.equal(profileStore.clear(storage).experiences, "");
assert.equal(profileStore.load(storage).major, "");

console.log("Profile store tests passed");
