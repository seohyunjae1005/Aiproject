(function (root) {
  "use strict";

  const SEMICONDUCTOR_SKILLS = [
    {
      id: "wafer_processes",
      name: "웨이퍼 핵심 공정 이해",
      regex: /(photolithography|lithography|노광|etch(?:ing)?|식각|ion\s*implant|이온\s*주입|diffusion|확산|thin\s*film|박막|cleaning|세정|\bcmp\b)/i,
      importance: "여러 단위 공정을 함께 제시한 것은 특정 장비 한 대보다 공정 흐름과 공정 간 영향을 폭넓게 이해하는 인재를 찾는다는 신호입니다.",
      resume: "직접 수행한 공정명, 바꾼 조건, 측정값과 결과를 한 묶음으로 적고 경험하지 않은 공정은 쓰지 마세요.",
      study: "Photolithography→Etch→Ion Implant·Diffusion→Thin Film→Cleaning·CMP의 목적과 앞뒤 공정 영향",
      question: "여러 반도체 단위 공정 중 직접 다뤄본 공정과, 조건 변화가 결과에 미친 영향을 설명해 주세요.",
    },
    {
      id: "yield_optimization",
      name: "공정 안정화·조건 최적화·수율",
      regex: /(공정|조건|레시피).{0,18}(안정|최적화|개선)|수율|생산\s*품질|공정\s*성능/i,
      importance: "개발 결과를 반복 가능한 양산 조건으로 만들고 품질·수율을 유지하는 것이 직무의 직접 성과로 제시됩니다.",
      resume: "비교한 조건, 고정한 변수, 판단 지표, 개선 전후 결과를 밝혀 양산 안정화 사고방식을 보여주세요.",
      study: "공정 조건 창(process window), 주요 관리 변수, 수율·품질 지표와 조건 변경의 관계",
      question: "조건을 비교해 품질·수율 또는 재현성을 높인 경험을 판단 지표와 함께 설명해 주세요.",
    },
    {
      id: "equipment_supplier",
      name: "장비 Set-up·개조 개선·협력사 협업",
      regex: /(장비|설비).{0,25}(set[- ]?up|셋업|개조|개선|업체|협력사)|(set[- ]?up|셋업).{0,20}(장비|설비)|장비\s*업체|vendor|supplier/i,
      importance: "공정 조건만 조정하는 역할이 아니라 장비 도입·개선과 외부 장비사 협업까지 책임 범위에 포함됩니다.",
      resume: "장비 또는 실험 장치에서 확인한 이상, 조정한 항목, 협의 대상, 성능·생산성 변화를 구체적으로 적으세요.",
      study: "장비 Set-up과 qualification 흐름, 개조 전후 검증, 장비사와 사양·이슈를 정리하는 방법",
      question: "장비나 실험 장치를 설치·조정·개선하면서 관계자와 협의해 성능을 높인 경험을 설명해 주세요.",
    },
    {
      id: "amhs_control",
      name: "AMHS·반송 제어·생산성 최적화",
      regex: /(\bamhs\b|\boht\b|stocker|conveyor|\bamr\b|자동\s*반송|\bmcs\b|throughput|utilization|layout)/i,
      importance: "웨이퍼 공정뿐 아니라 공장 내 물류 장비와 제어 시스템의 처리량·활용률까지 다루는 세부 업무가 명시돼 있습니다.",
      resume: "동선·대기·병목을 데이터나 시뮬레이션으로 개선한 경험이 있다면 대상, 제약조건, 처리량 변화를 중심으로 쓰세요.",
      study: "OHT·Stocker·Conveyor·AMR 역할, MCS 제어, Layout과 Throughput·Utilization의 관계",
      question: "물류·동선·대기시간 또는 자동화 시스템의 병목을 찾아 개선한 경험을 설명해 주세요.",
    },
    {
      id: "product_technology",
      name: "파생제품·요소기술·차세대 대응",
      regex: /(파생\s*제품|요소\s*기술|차세대\s*제품|신규\s*제품).{0,20}(개발|대응|기반)|경쟁력.{0,12}강화/i,
      importance: "현재 양산 운영과 함께 다음 제품에 적용할 요소기술을 준비하는 개발 성격도 포함된 직무입니다.",
      resume: "기존 방식의 한계를 정의하고 새 조건·재료·구조를 검토한 경험을 가설과 검증 결과 중심으로 적으세요.",
      study: "양산 공정 변경점 관리, 파생제품 조건 전개, 요소기술 검증에서 재현성과 양산성 판단",
      question: "기존 방식의 한계를 개선하거나 다음 단계에 적용할 기술을 검증한 경험을 설명해 주세요.",
    },
    {
      id: "process_fundamentals",
      name: "반도체 공정 흐름·원리",
      regex: /반도체\s*공정.{0,18}(흐름|원리|전반)|공정\s*전반.{0,12}(이해|원리)/i,
      importance: "개별 공정 암기보다 전체 제조 흐름과 앞뒤 공정의 영향을 설명할 수 있는지를 우대조건으로 확인합니다.",
      resume: "수강명만 나열하지 말고 프로젝트에서 어떤 공정 원리를 적용해 결과를 해석했는지 한 사례로 보여주세요.",
      study: "웨이퍼 투입부터 패턴 형성·막질·세정·검사까지 전체 흐름과 공정 간 상호작용",
      question: "반도체 공정 흐름을 이해한 뒤 실험 결과나 문제 원인을 다르게 해석한 경험을 설명해 주세요.",
    },
    {
      id: "process_experiment",
      name: "반도체 실험·프로젝트 경험",
      regex: /반도체.{0,18}(실험|프로젝트)|공정.{0,12}(실습|실험|프로젝트)/i,
      importance: "이론 지식뿐 아니라 직접 실험하거나 프로젝트로 적용한 흔적을 우대하고 있습니다.",
      resume: "실험 목적, 본인이 조작·측정한 항목, 실패 또는 편차, 결과 해석을 분리해 적으세요.",
      study: "실험 설계 시 변수·대조 조건·측정 지표를 구분하고 결과의 한계를 설명하는 방법",
      question: "반도체 실험 또는 프로젝트에서 직접 수행한 작업과 결과 해석 과정을 설명해 주세요.",
    },
    {
      id: "test_programming",
      name: "TEST·분석 프로그램 개발",
      regex: /(test|테스트|분석).{0,18}(프로그램|프로그래밍|자동화|코드).{0,10}(개발|활용|경험)?|(python|파이썬|matlab|c\+\+|java).{0,20}(분석|test|테스트|자동화)/i,
      importance: "반복 측정·분석을 프로그램으로 처리해 판단 속도와 일관성을 높일 수 있는 경험을 우대합니다.",
      resume: "언어 이름보다 입력 데이터, 자동화한 작업, 검증 방법, 절감 시간이나 오류 감소를 적으세요.",
      study: "측정 데이터 전처리, 합격 기준 판정, 반복 분석 자동화와 결과 검증 방식",
      question: "TEST 또는 분석 작업을 프로그램으로 구현해 반복 업무나 판단을 개선한 경험을 설명해 주세요.",
    },
    {
      id: "related_majors",
      name: "공학·자연과학 전공 기반",
      regex: /(전자|전기|화공|화학|재료|물리|반도체|기계|산업공학).{0,35}(전공|분야|경험|역량)/i,
      importance: "특정 한 전공보다 공정·장비·재료·자동화 문제에 연결할 수 있는 폭넓은 공학·과학 기반을 허용합니다.",
      resume: "전공명 자체보다 지원 업무와 직접 이어지는 과목·실험·설계 경험을 골라 연결하세요.",
      study: "본인 전공 지식이 공정 조건, 장비, 재료 특성 또는 생산 시스템 중 어디에 연결되는지 정리",
      question: "본인의 전공 지식을 이 직무의 공정·장비·생산 문제에 적용한 경험을 설명해 주세요.",
    },
  ];

  const SECTION_RULES = [
    { level: "duty", label: "담당 업무", regex: /^(담당\s*업무|주요\s*업무|수행\s*업무|직무\s*내용|responsibilities|what\s*you(?:'|’)?ll\s*(?:do|experience)|경험할\s*수\s*있습니다)$/i },
    { level: "preferred", label: "우대사항", regex: /^(우대|우대\s*사항|preferred|nice\s*to\s*have|이런\s*역량이나\s*경\S{0,2}이\s*있다면\s*더\s*좋습니다)$/i },
    { level: "required", label: "지원 자격", regex: /^(필수|자격\s*요건|지원\s*자격|요구\s*사항|requirements?|qualifications?|who\s+we(?:'|’)?re\s+looking\s+for|우리는\s*이\S{0,2}\s*사람을\s*찾고\s*있습니다)$/i },
    { level: "ignore", label: "회사 소개", regex: /^(복리\s*후생|전형\s*절차|지원\s*방법|근무\s*(?:조건|지역|장소)|회사\s*소개|benefits?|about\s*us|우리는\s*이런\s*가치를\s*만듭니다)$/i },
  ];

  const OCR_CHECKS = [
    { regex: /\blon\s+lmplant\b/i, text: "‘lon lmplant’는 ‘Ion Implant’의 OCR 오류일 수 있습니다." },
    { regex: /\bwh[o0]\s+we[•·]?re\b/i, text: "‘Who we're’ 제목의 대소문자·기호가 깨졌을 수 있습니다." },
    { regex: /\byou[•·]\s*ll\b/i, text: "‘You'll’의 아포스트로피가 글머리표로 인식됐을 수 있습니다." },
    { regex: /(이련|경협|갖줘|반도세|자세대|구측)/, text: "한글 OCR 오타로 보이는 단어가 있습니다. 정리본에서 원문 PDF와 대조해 주세요." },
    { regex: /[\u4e00-\u9fff]/, text: "한글 문장 안에 한자가 섞여 있습니다. PDF 글자 추출 오류인지 확인해 주세요." },
    { regex: /�/, text: "읽지 못한 글자(�)가 있습니다. 해당 부분을 직접 수정해 주세요." },
  ];

  function normalize(value) {
    return String(value || "").toLocaleLowerCase("ko").replace(/[\s·•\-–—_*()[\]{}<>:：,.;!?/\\]+/g, "");
  }

  function cleanLine(value) {
    return String(value || "").replace(/^\s*(?:[-–—•·▪▶✓✔]|\d+[.)]|[가-힣][.)])\s*/, "")
      .replace(/^[.;:!?]\s*/, "").replace(/\s+([,.;:!?])/g, "$1").replace(/\s+/g, " ").trim();
  }

  function sectionRule(line) {
    const heading = cleanLine(line).replace(/[.!?]+$/, "").trim();
    return SECTION_RULES.find((item) => item.regex.test(heading)) || null;
  }

  function conservativeOcrFixes(value) {
    return String(value || "").replace(/we\s*[•·]\s*re/gi, "we're").replace(/you\s*[•·]\s*ll/gi, "you'll")
      .replace(/\blon\s+lmplant\b/gi, "Ion Implant");
  }

  function markInlineBoundaries(value) {
    let text = conservativeOcrFixes(value).replace(/\r/g, "\n");
    const headings = [
      /about\s+us/gi, /what\s+you(?:'|’)?ll\s+experience/gi, /what\s+you(?:'|’)?ll\s+do/gi,
      /who\s+we(?:'|’)?re\s+looking\s+for/gi, /우리는\s*이런\s*가치를\s*만듭니다/gi,
      /경험할\s*수\s*있습니다/gi, /우리는\s*이\S{0,2}\s*사람을\s*찾고\s*있습니다/gi,
      /이런\s*역량이나\s*경\S{0,2}이\s*있다면\s*더\s*좋습니다/gi, /담당\s*업무/gi, /자격\s*요건/gi, /우대\s*사항/gi,
    ];
    headings.forEach((regex) => { text = text.replace(regex, (match) => `\n§H§${match}\n`); });
    return text.replace(/\s*[•▪▶✓✔]\s*/g, "\n§B§").replace(/\n{3,}/g, "\n\n");
  }

  function mergeSourceUnits(sourceText) {
    const raw = markInlineBoundaries(sourceText).split(/\n+/);
    const units = [];
    let buffer = "";
    let bufferBullet = false;
    const flush = () => {
      const text = cleanLine(buffer);
      if (text) units.push({ kind: "text", text, bullet: bufferBullet });
      buffer = "";
      bufferBullet = false;
    };
    raw.forEach((rawLine) => {
      let line = rawLine.trim();
      if (!line || /^\[\d+쪽\]$/.test(line)) return;
      const bracketHeading = line.match(/^\[([^\]]+)\]$/);
      if (bracketHeading && sectionRule(bracketHeading[1])) {
        flush();
        units.push({ kind: "heading", text: bracketHeading[1], section: sectionRule(bracketHeading[1]) });
        return;
      }
      if (line.startsWith("§H§")) {
        flush();
        line = cleanLine(line.slice(3));
        if (line) units.push({ kind: "heading", text: line, section: sectionRule(line) });
        return;
      }
      const bullet = line.startsWith("§B§") || /^[-–—]\s+/.test(line);
      if (bullet) {
        flush();
        line = line.startsWith("§B§") ? line.slice(3).trim() : line.replace(/^[-–—]\s+/, "");
        bufferBullet = true;
      }
      if (!line) return;
      if (buffer && (bullet || /[.!?]$/.test(buffer))) flush();
      buffer = buffer ? `${buffer} ${line}` : line;
    });
    flush();
    return units;
  }

  function detectOcrWarnings(sourceText) {
    return [...new Set(OCR_CHECKS.filter((item) => item.regex.test(String(sourceText || ""))).map((item) => item.text))];
  }

  function previewSource(sourceText) {
    const source = String(sourceText || "").trim();
    if (!source) throw new Error("JD 원문을 입력하거나 PDF를 선택해 주세요.");
    const units = mergeSourceUnits(source);
    const lines = [];
    let lastHeading = "";
    units.forEach((unit) => {
      if (unit.kind === "heading") {
        const heading = unit.section?.label || unit.text;
        if (heading !== lastHeading) lines.push("", `[${heading}]`);
        lastHeading = heading;
      } else {
        lines.push(`${unit.bullet ? "- " : ""}${unit.text}`);
        lastHeading = "";
      }
    });
    return {
      cleanedText: lines.join("\n").replace(/^\n+/, "").replace(/\n{3,}/g, "\n\n").trim(),
      warnings: detectOcrWarnings(source),
      semanticUnitCount: units.filter((unit) => unit.kind === "text").length,
      headingCount: units.filter((unit) => unit.kind === "heading").length,
    };
  }

  function detectedSkills(text) {
    return SEMICONDUCTOR_SKILLS.filter((skill) => skill.regex.test(String(text || ""))).map((skill) => skill.id);
  }

  function isDutySentence(text) {
    return /(역할을\s*담당|공정.{0,20}(운영|최적화)|장비.{0,25}(set[- ]?up|개조|개선)|파생\s*제품|요소\s*기술|\bamhs\b|자동\s*반송|업무를\s*수행|수율을\s*높|생산성을\s*극대화)/i.test(text);
  }

  function isQualificationSentence(text) {
    return /(있는\s*분|경험이\s*있는|역량이\s*있는|관련\s*분야|전공|학위|자격|이해하고\s*있는)/.test(text);
  }

  function parseRequirements(sourceText) {
    const source = String(sourceText || "").trim();
    const units = mergeSourceUnits(source);
    const requirements = [];
    let currentLevel = "unspecified";
    units.forEach((unit) => {
      if (unit.kind === "heading") {
        currentLevel = unit.section?.level || currentLevel;
        return;
      }
      const text = unit.text;
      if (text.length < 8 || text.length > 700) return;
      const skills = detectedSkills(text);
      const duty = isDutySentence(text);
      const qualification = isQualificationSentence(text);
      if (currentLevel === "ignore" && !duty && !qualification && skills.length === 0) return;
      if (!duty && !qualification && skills.length === 0 && currentLevel === "unspecified") return;
      let level = currentLevel;
      if (duty && !qualification) level = "duty";
      else if (qualification && currentLevel !== "preferred") level = "required";
      requirements.push({
        id: `J${requirements.length + 1}`,
        text,
        level,
        competencies: skills,
        quoteVerified: normalize(source).includes(normalize(text)),
        classificationReason: skills.length ? "반도체 전용 표현이 직접 확인됨" : "반도체 전용 역량 사전과 직접 일치하는 표현이 없어 임의 분류하지 않음",
      });
    });
    return requirements.slice(0, 40);
  }

  function parseExperiences(experienceText) {
    return String(experienceText || "").split(/\r?\n/).map(cleanLine).filter((line) => line.length >= 5).slice(0, 30)
      .map((text, index) => ({ id: `E${index + 1}`, text, competencies: detectedSkills(text) }));
  }

  function buildMatches(requirements, experiences) {
    return requirements.map((requirement) => {
      const candidates = experiences.map((experience) => ({ experience, shared: requirement.competencies.filter((id) => experience.competencies.includes(id)) }))
        .filter((candidate) => candidate.shared.length).sort((a, b) => b.shared.length - a.shared.length);
      return { requirement, experience: candidates[0]?.experience || null, shared: candidates[0]?.shared || [] };
    }).filter((row) => row.experience);
  }

  function competencyCoverage(requirements) {
    return SEMICONDUCTOR_SKILLS.map((skill) => ({ id: skill.id, name: skill.name, evidenceIds: requirements.filter((row) => row.competencies.includes(skill.id)).map((row) => row.id) }))
      .filter((row) => row.evidenceIds.length);
  }

  function workBlocks(requirements) {
    const specificity = ["amhs_control", "equipment_supplier", "wafer_processes", "product_technology", "yield_optimization", "test_programming"];
    return requirements.filter((row) => row.level === "duty").map((row) => {
      const primaryId = specificity.find((id) => row.competencies.includes(id)) || row.competencies[0];
      return {
        id: row.id,
        title: primaryId ? SEMICONDUCTOR_SKILLS.find((skill) => skill.id === primaryId)?.name : "업무 내용 확인 필요",
        text: row.text,
        competencyIds: row.competencies,
        classificationReason: row.classificationReason,
      };
    });
  }

  function summaryFromBlocks(blocks, roleName) {
    const names = [...new Set(blocks.map((block) => block.title).filter((name) => name && name !== "업무 내용 확인 필요"))].slice(0, 3);
    const role = String(roleName || "지원 직무").trim() || "지원 직무";
    return names.length ? `${role}은(는) ${names.join("·")}을 중심으로 양산 안정성과 다음 제품 대응을 함께 맡는 직무로 해석됩니다.`
      : `${role}의 업무 문장은 확인했지만 반도체 세부 역량을 충분히 구분하지 못했습니다.`;
  }

  function topResumeStrategies(requirements) {
    const usedRequirements = new Set();
    const rows = [];
    const levelRank = { duty: 4, preferred: 3, required: 2, unspecified: 1, ignore: 0 };
    const candidates = requirements.flatMap((requirement) => requirement.competencies.map((skillId, skillIndex) => ({ requirement, skillId, skillIndex })))
      .sort((a, b) => levelRank[b.requirement.level] - levelRank[a.requirement.level] || a.skillIndex - b.skillIndex);
    candidates.forEach(({ requirement, skillId }) => {
      if (usedRequirements.has(requirement.id) || rows.some((row) => row.skillId === skillId) || rows.length >= 5) return;
      const skill = SEMICONDUCTOR_SKILLS.find((item) => item.id === skillId);
      if (!skill) return;
      usedRequirements.add(requirement.id);
      rows.push({ rank: rows.length + 1, skillId, name: skill.name, requirementId: requirement.id, evidence: requirement.text, importance: skill.importance, resume: skill.resume });
    });
    return rows;
  }

  function jobFeatures(requirements) {
    return requirements.filter((row) => row.level === "preferred" || row.level === "required").map((row) => {
      const skill = SEMICONDUCTOR_SKILLS.find((item) => row.competencies.includes(item.id));
      if (!skill) return null;
      let interpretation = `${skill.name}을(를) 지원자의 준비 근거로 확인하는 공고입니다.`;
      if (skill.id === "related_majors") interpretation = "전자·재료·화학·기계·산업공학 등 전공 폭이 넓어, 전공명보다 직무 문제에 연결한 경험이 중요합니다.";
      if (skill.id === "process_experiment") interpretation = "이론만이 아니라 반도체 실험·프로젝트에서 직접 적용한 경험을 우대합니다.";
      if (skill.id === "test_programming") interpretation = "공정 전공자에게도 TEST·분석 업무를 프로그램으로 다뤄본 경험을 추가 강점으로 봅니다.";
      if (skill.id === "process_fundamentals") interpretation = "개별 공정 지식과 함께 반도체 제조 흐름 전체를 이해하는지를 확인합니다.";
      return { requirementId: row.id, fact: row.text, interpretation };
    }).filter(Boolean).slice(0, 5);
  }

  function studyTopics(topStrategies) {
    return topStrategies.map((row) => {
      const skill = SEMICONDUCTOR_SKILLS.find((item) => item.id === row.skillId);
      return { title: skill.name, topic: skill.study, basedOn: `Top ${row.rank} · ${row.requirementId}` };
    });
  }

  function suggestedQuestions(topStrategies, matches, roleName) {
    const role = String(roleName || "지원 직무").trim() || "지원 직무";
    return topStrategies.slice(0, 4).map((row, index) => {
      const skill = SEMICONDUCTOR_SKILLS.find((item) => item.id === row.skillId);
      const match = matches.find((item) => item.requirement.id === row.requirementId || item.shared.includes(row.skillId));
      return { id: `Q${index + 1}`, label: `${role} 준비용 제안`, question: skill.question, requirementId: row.requirementId, experience: match?.experience || null };
    });
  }

  function analyze(input) {
    const jdText = String(input?.jdText || "").trim();
    if (!jdText) throw new Error("정리한 JD 원문을 확인해 주세요.");
    const requirements = parseRequirements(jdText);
    const experiences = parseExperiences(input?.experienceText || "");
    const matches = experiences.length ? buildMatches(requirements, experiences) : [];
    const blocks = workBlocks(requirements);
    const topStrategies = topResumeStrategies(requirements);
    const unclassified = requirements.filter((row) => row.competencies.length === 0);
    const limitations = [];
    if (jdText.length < 250) limitations.push("정리된 JD가 짧아 일부 업무·자격 내용이 빠졌을 수 있습니다.");
    if (!requirements.length) limitations.push("담당 업무·자격·우대 의미 단위를 찾지 못했습니다. 정리 미리보기에서 문단을 확인해 주세요.");
    if (unclassified.length) limitations.push(`${unclassified.length}개 의미 단위는 반도체 전용 사전과 직접 일치하지 않아 임의 분류하지 않았습니다.`);
    if (!experiences.length) limitations.push("JD 분석과 이력서 접근 전략은 완료했으며, 내 프로필 비교만 생략했습니다.");
    return {
      requirements, workBlocks: blocks, summary: summaryFromBlocks(blocks, input?.roleName), topStrategies,
      features: jobFeatures(requirements), studyTopics: studyTopics(topStrategies), coverage: competencyCoverage(requirements),
      unclassified, experiences, matches, profileProvided: experiences.length > 0,
      suggestedQuestions: suggestedQuestions(topStrategies, matches, input?.roleName), limitations, analyzedAt: new Date().toISOString(),
    };
  }

  root.JDAnalyzer = {
    TAXONOMY: SEMICONDUCTOR_SKILLS, SEMICONDUCTOR_SKILLS, normalize, cleanLine, mergeSourceUnits, detectOcrWarnings,
    previewSource, detectedSkills, parseRequirements, parseExperiences, buildMatches, competencyCoverage, workBlocks,
    topResumeStrategies, jobFeatures, studyTopics, suggestedQuestions, analyze,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = root.JDAnalyzer;
})(typeof window !== "undefined" ? window : globalThis);
