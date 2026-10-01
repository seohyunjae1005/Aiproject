(function (root) {
  "use strict";

  const TAXONOMY = [
    { id: "process", name: "공정·생산", keywords: ["공정", "생산", "양산", "제조", "수율", "레시피", "조건 최적화", "공정개선"], study: "공정 흐름과 조건 변화가 품질·생산성에 미치는 영향을 실제 사례로 설명해 보세요." },
    { id: "quality", name: "품질·검증", keywords: ["품질", "검증", "불량", "신뢰성", "검사", "계측", "테스트", "원인 분석"], study: "품질 문제를 발견하고 원인을 좁혀 개선한 과정을 문제–분석–결과 순서로 정리해 보세요." },
    { id: "data", name: "데이터 분석", keywords: ["데이터", "통계", "분석", "지표", "대시보드", "sql", "python", "파이썬", "excel", "엑셀"], study: "데이터를 정리해 판단하거나 개선으로 연결한 경험을 수치와 함께 준비해 보세요." },
    { id: "problem", name: "문제 해결", keywords: ["문제 해결", "트러블슈팅", "개선", "최적화", "원인", "해결", "분석적 사고"], study: "문제의 원인 가설, 확인 방법, 실제 조치와 결과를 분리해 설명하는 연습을 해보세요." },
    { id: "research", name: "연구·개발", keywords: ["연구", "개발", "실험", "특허", "논문", "시뮬레이션", "설계", "평가"], study: "가설을 세우고 실험·검증한 경험에서 본인의 판단 근거를 정리해 보세요." },
    { id: "software", name: "소프트웨어·자동화", keywords: ["소프트웨어", "프로그래밍", "코딩", "자동화", "알고리즘", "시스템", "java", "javascript", "c++", "api"], study: "사용 가능한 도구의 이름보다 그 도구로 어떤 문제를 해결했는지 결과 중심으로 정리해 보세요." },
    { id: "equipment", name: "설비·장비", keywords: ["설비", "장비", "유지보수", "가동률", "예방보전", "셋업", "setup", "hardware", "하드웨어"], study: "설비 구조, 이상 신호, 안전한 조치 순서를 직무 관점에서 학습해 보세요." },
    { id: "design", name: "설계·도면", keywords: ["설계", "도면", "cad", "기구", "회로", "전장", "모델링", "해석"], study: "요구조건을 설계 선택으로 바꾼 과정과 검증 기준을 사례로 준비해 보세요." },
    { id: "project", name: "프로젝트 관리", keywords: ["프로젝트", "일정", "기획", "관리", "리스크", "예산", "성과", "목표"], study: "목표, 일정, 위험요소, 이해관계자를 어떻게 관리했는지 구체적인 역할을 정리해 보세요." },
    { id: "communication", name: "협업·소통", keywords: ["협업", "소통", "커뮤니케이션", "협의", "발표", "보고", "문서", "유관부서", "팀워크"], study: "의견이 다른 사람과 기준을 맞추고 결과를 만든 경험을 행동 중심으로 준비해 보세요." },
    { id: "customer", name: "고객·영업", keywords: ["고객", "영업", "시장", "제안", "수주", "파트너", "요구사항", "기술지원"], study: "고객 요구를 파악하고 해결안이나 가치로 바꾼 경험을 정리해 보세요." },
    { id: "language", name: "외국어", keywords: ["영어", "외국어", "글로벌", "toeic", "opic", "토익", "오픽", "중국어", "일본어"], study: "공고에 명시된 언어 사용 상황에 맞춰 읽기·회의·발표 경험을 구분해 준비해 보세요." },
    { id: "safety", name: "안전·환경", keywords: ["안전", "환경", "보건", "규정", "법규", "위험성", "esg"], study: "관련 법규와 작업 위험요소를 확인하고 예방 조치로 연결한 사례를 준비해 보세요." },
    { id: "leadership", name: "리더십·조직", keywords: ["리더십", "리딩", "조직", "의사결정", "멘토링", "교육", "책임감"], study: "직책보다 판단을 내리고 구성원의 행동을 이끌어 낸 구체적인 장면을 정리해 보세요." },
  ];

  const SECTION_RULES = [
    { level: "required", regex: /^(필수|자격\s*요건|지원\s*자격|요구\s*사항|requirements?|qualifications?|who\s+we(?:'|’)?re\s+looking\s+for|우리는\s*이런\s*사람을\s*찾고\s*있습니다)\s*[:：]?$/i },
    { level: "preferred", regex: /^(우대|우대\s*사항|preferred|nice\s*to\s*have|이런\s*역량이나\s*경\S{0,2}이\s*있다면\s*더\s*좋습니다)\s*[:：]?$/i },
    { level: "duty", regex: /^(담당\s*업무|주요\s*업무|수행\s*업무|직무\s*내용|responsibilities|what\s*you(?:'|’)?ll\s*do|what\s*you(?:'|’)?ll\s*experience|경험할\s*수\s*있습니다)\s*[:：]?$/i },
    { level: "ignore", regex: /^(복리\s*후생|전형\s*절차|지원\s*방법|근무\s*(조건|지역|장소)|회사\s*소개|benefits?|about\s*us)\s*[:：]?$/i },
  ];

  function normalize(value) {
    return String(value || "").toLocaleLowerCase("ko").replace(/[\s·•\-–—_*()[\]{}<>:：,.;!?/\\]+/g, "");
  }

  function cleanLine(value) {
    return String(value || "")
      .replace(/^\s*(?:[-–—•·▪▶✓✔]|\d+[.)]|[가-힣][.)])\s*/, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function sectionLevel(line) {
    const cleaned = cleanLine(line).replace(/[.!?]+$/, "");
    const rule = SECTION_RULES.find((item) => item.regex.test(cleaned));
    return rule ? rule.level : null;
  }

  function prepareSourceLines(sourceText) {
    return String(sourceText || "")
      .replace(/we\s*[•·]\s*re/gi, "we're")
      .replace(/you\s*[•·]\s*ll/gi, "you'll")
      .replace(/\s*(about\s+us)\s*/gi, "\n$1\n")
      .replace(/\s*(what\s+you(?:'|’)?ll\s+experience)\s*/gi, "\n$1\n")
      .replace(/\s*(who\s+we(?:'|’)?re\s+looking\s+for)\s*/gi, "\n$1\n")
      .replace(/\s*(우리는\s*이런\s*사람을\s*찾고\s*있습니다)\s*/g, "\n$1\n")
      .replace(/\s*(이런\s*역량이나\s*경\S{0,2}이\s*있다면\s*더\s*좋습니다)\s*/g, "\n$1\n")
      .replace(/\s*[•▪▶✓✔]\s*/g, "\n")
      .replace(/([.!?])\s+(?=[가-힣A-Z])/g, "$1\n")
      .split(/\r?\n/);
  }

  function detectCompetencies(text) {
    const normalized = String(text || "").toLocaleLowerCase("ko");
    return TAXONOMY.filter((item) => item.keywords.some((keyword) => normalized.includes(keyword.toLocaleLowerCase("ko"))))
      .map((item) => item.id);
  }

  function parseRequirements(sourceText) {
    const source = String(sourceText || "").trim();
    const rawLines = prepareSourceLines(source);
    const requirements = [];
    let currentLevel = "unspecified";

    rawLines.forEach((rawLine) => {
      const detected = sectionLevel(rawLine);
      if (detected) {
        currentLevel = detected;
        return;
      }
      if (currentLevel === "ignore") return;
      const line = cleanLine(rawLine);
      if (line.length < 6 || line.length > 500) return;
      if (/^(채용|모집|공고|접수|마감|근무지|고용형태)\s*[:：]/.test(line)) return;
      const competencies = detectCompetencies(line);
      const looksRelevant = competencies.length > 0
        || /(경험|역량|능력|가능|전공|학위|자격|담당|수행|운영|구축|보유|이해|활용)/.test(line);
      if (!looksRelevant && currentLevel === "unspecified") return;
      const looksLikeDuty = /(운영|최적화|관리|개선|개발|설계|구축|제어|담당|수행|높입니다|극대화)/.test(line)
        && !/(있는\s*분|경험이\s*있는|역량이\s*있는|관련\s*분야|전공|학위|자격)/.test(line);
      const effectiveLevel = currentLevel === "required" && looksLikeDuty ? "duty" : currentLevel;
      requirements.push({
        id: `J${requirements.length + 1}`,
        text: line,
        level: effectiveLevel,
        competencies,
        quoteVerified: normalize(source).includes(normalize(line)),
      });
    });
    return requirements.slice(0, 40);
  }

  function parseExperiences(experienceText) {
    return String(experienceText || "")
      .split(/\r?\n/)
      .map(cleanLine)
      .filter((line) => line.length >= 5)
      .slice(0, 30)
      .map((text, index) => ({ id: `E${index + 1}`, text, competencies: detectCompetencies(text) }));
  }

  function buildMatches(requirements, experiences) {
    return requirements.map((requirement) => {
      const candidates = experiences.map((experience) => {
        const shared = requirement.competencies.filter((id) => experience.competencies.includes(id));
        return { experience, shared };
      }).filter((item) => item.shared.length > 0)
        .sort((left, right) => right.shared.length - left.shared.length);
      const best = candidates[0] || null;
      return {
        requirement,
        experience: best?.experience || null,
        shared: best?.shared || [],
        strength: !best ? "none" : best.shared.length >= 2 ? "strong" : "partial",
      };
    });
  }

  function competencyFrequency(requirements) {
    return TAXONOMY.map((item) => ({
      id: item.id,
      name: item.name,
      count: requirements.filter((requirement) => requirement.competencies.includes(item.id)).length,
    })).filter((item) => item.count > 0)
      .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name, "ko"));
  }

  function learningPriorities(matches) {
    const rows = [];
    const seen = new Set();
    matches.filter((match) => match.strength === "none")
      .sort((left, right) => {
        const rank = { required: 0, preferred: 1, duty: 2, unspecified: 3 };
        return rank[left.requirement.level] - rank[right.requirement.level];
      })
      .forEach((match) => {
        match.requirement.competencies.forEach((id) => {
          if (seen.has(id)) return;
          const taxonomy = TAXONOMY.find((item) => item.id === id);
          if (!taxonomy) return;
          seen.add(id);
          rows.push({
            competency: taxonomy.name,
            requirementId: match.requirement.id,
            requirementText: match.requirement.text,
            level: match.requirement.level,
            suggestion: taxonomy.study,
          });
        });
      });
    return rows.slice(0, 8);
  }

  function jdLearningPriorities(requirements) {
    const rows = [];
    const seen = new Set();
    const rank = { required: 0, duty: 1, preferred: 2, unspecified: 3 };
    [...requirements].sort((left, right) => rank[left.level] - rank[right.level]).forEach((requirement) => {
      requirement.competencies.forEach((id) => {
        if (seen.has(id)) return;
        const taxonomy = TAXONOMY.find((item) => item.id === id);
        if (!taxonomy) return;
        seen.add(id);
        rows.push({
          competency: taxonomy.name,
          requirementId: requirement.id,
          requirementText: requirement.text,
          level: requirement.level,
          suggestion: taxonomy.study,
          mode: "jd_only",
        });
      });
    });
    return rows.slice(0, 8);
  }

  const QUESTION_TEMPLATES = {
    process: (role) => `${role} 업무에서 공정 안정화 또는 조건 최적화에 기여할 수 있는 경험과 판단 과정을 설명해 주세요.`,
    quality: () => "품질이나 성능 문제를 발견하고 원인을 좁혀 개선한 경험을 설명해 주세요.",
    data: () => "데이터를 이용해 문제를 판단하거나 개선 방향을 제시한 경험을 설명해 주세요.",
    problem: () => "예상하지 못한 문제의 원인을 찾고 해결한 과정을 구체적으로 설명해 주세요.",
    research: () => "실험·연구·개발 과정에서 가설을 세우고 결과를 검증한 경험을 설명해 주세요.",
    software: () => "프로그래밍이나 자동화를 활용해 업무 또는 프로젝트 문제를 해결한 경험을 설명해 주세요.",
    equipment: () => "장비의 성능·안정성·생산성을 높이기 위해 점검하거나 개선한 경험을 설명해 주세요.",
    design: () => "요구조건을 설계안으로 바꾸고 결과를 검증한 경험을 설명해 주세요.",
    project: () => "프로젝트 목표와 일정을 관리하며 본인이 맡은 역할과 성과를 설명해 주세요.",
    communication: () => "다른 사람 또는 조직과 기준을 맞추고 공동의 결과를 만든 경험을 설명해 주세요.",
    customer: () => "상대방의 요구를 파악해 해결안이나 가치로 바꾼 경험을 설명해 주세요.",
    language: () => "외국어를 실제 과제·협업·자료 이해에 활용한 경험을 설명해 주세요.",
    safety: () => "안전·환경 위험을 확인하고 예방 조치로 연결한 경험을 설명해 주세요.",
    leadership: () => "팀의 방향을 정하거나 구성원의 행동을 이끌어 결과를 만든 경험을 설명해 주세요.",
  };

  function suggestApplicationQuestions(requirements, matches, roleName) {
    const role = String(roleName || "지원 직무").trim() || "지원 직무";
    const frequency = competencyFrequency(requirements);
    return frequency.slice(0, 4).map((row, index) => {
      const evidence = requirements.filter((requirement) => requirement.competencies.includes(row.id));
      const matched = matches.find((match) => match.shared.includes(row.id) && match.experience);
      const template = QUESTION_TEMPLATES[row.id] || (() => `${role} 수행에 필요한 ${row.name} 역량을 보여주는 경험을 설명해 주세요.`);
      return {
        id: `Q${index + 1}`,
        competency: row.name,
        question: template(role),
        requirementIds: evidence.slice(0, 3).map((requirement) => requirement.id),
        experience: matched?.experience || null,
        source: "jd_suggestion",
      };
    });
  }

  function analyze(input) {
    const jdText = String(input?.jdText || "").trim();
    if (!jdText) throw new Error("JD 원문을 입력해 주세요.");
    const requirements = parseRequirements(jdText);
    const experiences = parseExperiences(input?.experienceText || "");
    const profileProvided = experiences.length > 0;
    const matches = profileProvided ? buildMatches(requirements, experiences) : [];
    const limitations = [];
    if (jdText.length < 250) limitations.push("JD 내용이 짧아 제한적인 결과만 표시합니다.");
    if (requirements.length === 0) limitations.push("담당 업무·자격·우대 문장을 찾지 못했습니다. 추출 원문에서 해당 내용이 포함됐는지 확인해 주세요.");
    if (requirements.some((row) => row.level === "unspecified")) limitations.push("일부 문장에는 필수·우대 표시가 없어 ‘구분 없음’으로 유지했습니다.");
    if (/(모집\s*부문|직무별|각\s*부문)/.test(jdText)) limitations.push("여러 직무가 섞인 공고일 수 있습니다. 지원할 직무 부분만 남기면 결과가 더 명확해집니다.");
    if (!profileProvided) limitations.push("JD 분석은 완료했으며, 내 프로필이 없어 경험 비교만 생략했습니다.");
    return {
      requirements,
      experiences,
      matches,
      frequency: competencyFrequency(requirements),
      learning: profileProvided ? learningPriorities(matches) : jdLearningPriorities(requirements),
      suggestedQuestions: suggestApplicationQuestions(requirements, matches, input?.roleName),
      profileProvided,
      limitations,
      analyzedAt: new Date().toISOString(),
    };
  }

  root.JDAnalyzer = { TAXONOMY, normalize, prepareSourceLines, parseRequirements, parseExperiences, buildMatches, competencyFrequency, learningPriorities, jdLearningPriorities, suggestApplicationQuestions, analyze };
  if (typeof module !== "undefined" && module.exports) module.exports = root.JDAnalyzer;
})(typeof window !== "undefined" ? window : globalThis);
