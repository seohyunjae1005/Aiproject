(function (root) {
  "use strict";

  const COMPANY_PATTERNS = [
    ["Samsung Electronics", /삼성전자|samsung\s+electronics/i],
    ["SK hynix", /sk\s*하이닉스|sk\s*hynix|에스케이하이닉스/i],
    ["Micron", /마이크론|micron/i],
    ["Kioxia", /키옥시아|kioxia/i],
    ["TSMC", /\btsmc\b|대만반도체제조/i],
    ["Intel", /인텔|\bintel\b/i],
    ["ASML", /\basml\b/i],
    ["Applied Materials", /어플라이드\s*머티어리얼즈|applied\s+materials/i],
    ["Lam Research", /램\s*리서치|lam\s+research/i],
    ["Tokyo Electron", /도쿄\s*일렉트론|tokyo\s+electron|\btel\b/i],
    ["KLA", /\bkla\b/i],
  ];

  const ROLE_GROUPS = [
    { category: "공정·양산 엔지니어링", aliases: ["양산기술", "공정기술", "공정개발", "process integration", "process engineer", "process engineering", "manufacturing engineering"] },
    { category: "공정설계·R&D", aliases: ["공정설계", "r&d공정", "반도체공정설계", "device integration", "process development"] },
    { category: "설비·장비 엔지니어링", aliases: ["설비기술", "기반기술", "equipment engineer", "field service engineer", "customer engineer"] },
    { category: "패키지·테스트", aliases: ["p&t", "패키지개발", "패키징", "package development", "test engineering"] },
    { category: "평가·분석·품질", aliases: ["평가분석", "품질", "product engineering", "failure analysis", "quality engineering"] },
    { category: "소자·회로", aliases: ["소자", "회로설계", "device engineer", "circuit design"] },
    { category: "소프트웨어·데이터·AI", aliases: ["소프트웨어", "데이터", "인공지능", "machine learning", "data scientist", "software engineer"] },
  ];

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function mapRole(roleName) {
    const value = String(roleName || "").trim();
    if (!value) return { original: "", category: "직무 확인 필요", confidence: "low", matchedAlias: "" };
    const lowered = value.toLocaleLowerCase("ko");
    for (const group of ROLE_GROUPS) {
      const alias = group.aliases.find((candidate) => lowered.includes(candidate.toLocaleLowerCase("ko")));
      if (alias) return { original: value, category: group.category, confidence: "medium", matchedAlias: alias };
    }
    return { original: value, category: "기타·직무 확인 필요", confidence: "low", matchedAlias: "" };
  }

  function detectCompany(text) {
    const value = String(text || "");
    return COMPANY_PATTERNS.find(([, pattern]) => pattern.test(value))?.[0] || "";
  }

  function detectRoles(text) {
    const value = String(text || "");
    const hits = [];
    ROLE_GROUPS.forEach((group) => {
      group.aliases.forEach((alias) => {
        const match = value.match(new RegExp(escapeRegExp(alias), "i"));
        if (match) hits.push({ index: match.index ?? Number.MAX_SAFE_INTEGER, alias, category: group.category });
      });
    });
    hits.sort((left, right) => left.index - right.index || right.alias.length - left.alias.length);
    const seen = new Set();
    return hits.filter((hit) => {
      const key = hit.alias.toLocaleLowerCase("ko");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).map((hit) => ({ original: hit.alias, category: hit.category, confidence: "medium", matchedAlias: hit.alias }));
  }

  function detectRole(text) {
    return detectRoles(text)[0] || { original: "", category: "직무 확인 필요", confidence: "low", matchedAlias: "" };
  }

  function detect(text) {
    const roles = detectRoles(text);
    return { company: detectCompany(text), role: roles[0] || detectRole(""), roles };
  }

  root.RoleNormalizer = { COMPANY_PATTERNS, ROLE_GROUPS, mapRole, detectCompany, detectRoles, detectRole, detect };
  if (typeof module !== "undefined" && module.exports) module.exports = root.RoleNormalizer;
})(typeof window !== "undefined" ? window : globalThis);
