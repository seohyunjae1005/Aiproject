(function (root) {
  "use strict";

  const STORAGE_KEY = "semiconductor-career-profile-v1";
  const EMPTY_PROFILE = Object.freeze({
    education: "",
    major: "",
    targetRoles: "",
    skills: "",
    certificates: "",
    experiences: "",
    updatedAt: "",
  });

  function clean(value) {
    return String(value || "").replace(/\r\n/g, "\n").trim();
  }

  function normalize(profile) {
    return {
      education: clean(profile?.education),
      major: clean(profile?.major),
      targetRoles: clean(profile?.targetRoles),
      skills: clean(profile?.skills),
      certificates: clean(profile?.certificates),
      experiences: clean(profile?.experiences),
      updatedAt: clean(profile?.updatedAt),
    };
  }

  function load(storage) {
    try {
      const raw = storage?.getItem(STORAGE_KEY);
      return raw ? normalize(JSON.parse(raw)) : { ...EMPTY_PROFILE };
    } catch (_error) {
      return { ...EMPTY_PROFILE };
    }
  }

  function save(profile, storage) {
    const normalized = normalize({ ...profile, updatedAt: new Date().toISOString() });
    storage?.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  }

  function clear(storage) {
    storage?.removeItem(STORAGE_KEY);
    return { ...EMPTY_PROFILE };
  }

  function lines(value) {
    return clean(value).split("\n").map((line) => line.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);
  }

  function toExperienceText(profile) {
    const normalized = normalize(profile);
    return [
      ...lines(normalized.experiences),
      ...lines(normalized.skills).map((value) => `보유 기술 및 교육: ${value}`),
      ...lines(normalized.certificates).map((value) => `자격 및 어학: ${value}`),
    ].join("\n");
  }

  function summary(profile) {
    const normalized = normalize(profile);
    const experienceCount = lines(normalized.experiences).length;
    const filled = ["education", "major", "targetRoles", "skills", "certificates", "experiences"]
      .filter((key) => normalized[key]).length;
    return { filled, experienceCount, ready: experienceCount > 0 };
  }

  root.CareerProfile = { STORAGE_KEY, EMPTY_PROFILE, normalize, load, save, clear, lines, toExperienceText, summary };
  if (typeof module !== "undefined" && module.exports) module.exports = root.CareerProfile;
})(typeof window !== "undefined" ? window : globalThis);
