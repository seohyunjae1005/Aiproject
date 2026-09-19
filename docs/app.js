const state = {
  articles: [],
  company: "all",
  relevance: "all",
  job: "all",
  domain: "all",
  signal: "all",
  days: "all",
  query: "",
  language: "original",
  translatedCount: 0,
  trendDays: "30",
  trendSummary: null,
  monthlyTrendReport: null,
};

const grid = document.querySelector("#article-grid");
const empty = document.querySelector("#empty");
const resultLine = document.querySelector("#result-line");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  if (!value) return "날짜 미상";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "날짜 미상";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function withinDays(value, days) {
  if (days === "all") return true;
  const published = new Date(value).getTime();
  if (Number.isNaN(published)) return false;
  const cutoff = Date.now() - Number(days) * 24 * 60 * 60 * 1000;
  return published >= cutoff;
}

function includesValue(values, selected) {
  return selected === "all" || (values || []).includes(selected);
}

function visibleArticles() {
  const query = state.query.trim().toLocaleLowerCase("ko");
  return state.articles.filter((article) => {
    const searchable = [
      article.title,
      article.summary,
      article.title_ko,
      article.summary_ko,
      article.company,
      ...(article.matched_keywords || []),
      ...(article.tech_domains || []),
      ...(article.job_roles || []),
      ...(article.signal_types || []),
    ].join(" ").toLocaleLowerCase("ko");

    return (state.company === "all" || article.company === state.company)
      && (state.relevance === "all" || article.relevance === state.relevance)
      && includesValue(article.job_roles, state.job)
      && includesValue(article.tech_domains, state.domain)
      && includesValue(article.signal_types, state.signal)
      && withinDays(article.published_at, state.days)
      && (!query || searchable.includes(query));
  });
}

function badgeList(values, className, limit = 3) {
  return (values || []).slice(0, limit)
    .map((value) => `<span class="badge ${className}">${escapeHtml(value)}</span>`)
    .join("");
}

function confidenceLabel(value) {
  return { high: "높음", medium: "보통", low: "낮음" }[value] || "미표시";
}

function rankingList(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return '<li class="trend-empty">집계할 신호가 아직 없습니다.</li>';
  }
  const maximum = Math.max(...rows.map((row) => Number(row.count || 0)), 1);
  return rows.map((row) => {
    const count = Number(row.count || 0);
    const width = Math.max(8, Math.round((count / maximum) * 100));
    return `
      <li>
        <div class="rank-label"><span>${escapeHtml(row.name)}</span><strong>${count}건</strong></div>
        <span class="rank-bar" aria-hidden="true"><i style="width:${width}%"></i></span>
      </li>
    `;
  }).join("");
}

function momentumList(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return '<li class="trend-empty">뚜렷하게 증가한 신호가 없습니다.</li>';
  }
  return rows.map((row) => `
    <li><span>${escapeHtml(row.name)}</span><strong>+${Number(row.delta || 0)}건</strong></li>
  `).join("");
}

function profileTags(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return '<span class="profile-empty">분류 없음</span>';
  return rows.map((row) => `
    <span>${escapeHtml(row.name)} <small>${Number(row.count || 0)}</small></span>
  `).join("");
}

function renderCompanyProfiles(rows) {
  const container = document.querySelector("#company-profile-list");
  if (!Array.isArray(rows) || rows.length === 0) {
    container.innerHTML = '<p class="trend-empty">최근 30일 핵심 기업 신호가 없습니다.</p>';
    return;
  }
  container.innerHTML = rows.map((row) => `
    <button class="company-profile" type="button" data-profile-company="${escapeHtml(row.company)}">
      <span class="profile-title"><strong>${escapeHtml(row.company)}</strong><em>${Number(row.high_relevance_count || 0)}건</em></span>
      <span class="profile-label">기술</span>
      <span class="profile-tags">${profileTags(row.top_tech_domains)}</span>
      <span class="profile-label">직무</span>
      <span class="profile-tags">${profileTags(row.top_job_roles)}</span>
    </button>
  `).join("");
}

function renderMonthlyReport() {
  const payload = state.monthlyTrendReport;
  const container = document.querySelector("#monthly-ai-report");
  const report = payload?.report;
  if (!report) {
    container.hidden = true;
    return;
  }
  container.hidden = false;
  document.querySelector("#monthly-report-title").textContent = report.headline_ko || "최근 30일 공정 직무 동향";
  document.querySelector("#monthly-report-date").textContent = `분석 ${formatDate(payload.generated_at)}`;
  document.querySelector("#monthly-report-summary").textContent = report.summary_ko || "";
  const metrics = new Map((payload.evidence?.metrics || []).map((row) => [row.id, row.text_ko]));
  const articles = new Map((payload.evidence?.articles || []).map((row) => [row.id, row]));
  document.querySelector("#monthly-findings").innerHTML = (report.key_findings || []).map((row) => `
    <article>
      <strong>${escapeHtml(row.title_ko)}</strong>
      <p>${escapeHtml(row.interpretation_ko)}</p>
      <div class="evidence-chips">${(row.evidence_metric_ids || []).map((id) => `<span title="${escapeHtml(metrics.get(id) || "")}">${escapeHtml(id)}</span>`).join("")}</div>
    </article>
  `).join("");
  const processActions = (report.role_actions || []).filter((row) => row.role === "공정기술·양산기술");
  document.querySelector("#monthly-role-actions").innerHTML = processActions.map((row) => `
    <article>
      <strong>${escapeHtml(row.role)}</strong>
      <span>현업에서 볼 것</span>
      <ul>${(row.watch_points_ko || []).map((value) => `<li>${escapeHtml(value)}</li>`).join("")}</ul>
      <span>취업 준비 학습</span>
      <ul>${(row.study_points_ko || []).map((value) => `<li>${escapeHtml(value)}</li>`).join("")}</ul>
    </article>
  `).join("") || '<p class="trend-empty">공정 직무 제안이 검증되지 않아 표시하지 않습니다.</p>';
  const citedMetricIds = new Set((report.key_findings || []).flatMap((row) => row.evidence_metric_ids || []));
  const citedArticleIds = new Set((report.company_insights || []).flatMap((row) => row.evidence_article_ids || []));
  document.querySelector("#monthly-evidence-list").innerHTML = [
    ...[...citedMetricIds].map((id) => metrics.has(id) ? `<p><strong>${escapeHtml(id)}</strong> ${escapeHtml(metrics.get(id))}</p>` : ""),
    ...[...citedArticleIds].map((id) => {
      const row = articles.get(id);
      return row ? `<p><strong>${escapeHtml(id)}</strong> <a href="${escapeHtml(row.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(row.company)} — ${escapeHtml(row.title)}</a></p>` : "";
    }),
  ].join("");
  document.querySelector("#monthly-limitations").innerHTML = (report.limitations_ko || []).map((value) => `<li>${escapeHtml(value)}</li>`).join("");
}

function renderTrendSummary() {
  const summary = state.trendSummary;
  const board = document.querySelector("#trend-board");
  const windowData = summary?.windows?.[state.trendDays];
  if (!windowData) {
    board.hidden = true;
    return;
  }

  board.hidden = false;
  document.querySelector("#trend-article-count").textContent = windowData.article_count ?? 0;
  document.querySelector("#trend-high-count").textContent = windowData.high_relevance_count ?? 0;
  document.querySelector("#trend-company-count").textContent = windowData.company_count ?? 0;
  document.querySelector("#trend-tech-list").innerHTML = rankingList(windowData.top_tech_domains);
  document.querySelector("#trend-job-list").innerHTML = rankingList(windowData.top_job_roles);
  document.querySelector("#trend-company-list").innerHTML = rankingList(windowData.top_companies);
  document.querySelector("#momentum-tech-list").innerHTML = momentumList(summary.momentum_30d?.tech_domains);
  document.querySelector("#momentum-job-list").innerHTML = momentumList(summary.momentum_30d?.job_roles);
  renderCompanyProfiles(summary.company_profiles_30d);
  document.querySelector("#trend-methodology").textContent = summary.methodology || "";
}

function bindTrendPeriodTabs() {
  document.querySelector("#trend-period-tabs").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-trend-days]");
    if (!button) return;
    document.querySelectorAll("#trend-period-tabs button").forEach((item) => {
      item.classList.toggle("active", item === button);
    });
    state.trendDays = button.dataset.trendDays;
    renderTrendSummary();
  });
}

function bindCompanyProfiles() {
  document.querySelector("#company-profile-list").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-profile-company]");
    if (!button) return;
    state.company = button.dataset.profileCompany;
    state.days = "30";
    document.querySelectorAll("#company-filters button").forEach((item) => {
      item.classList.toggle("active", item.dataset.company === state.company);
    });
    document.querySelector("#days-filter").value = "30";
    render();
    document.querySelector("#result-line").scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function renderAiAnalysis(item) {
  if (!item?.analysis || item.validation_status !== "PASS") return "";
  const analysis = item.analysis;
  const roles = (analysis.role_insights || []).map((insight) => `
    <section class="role-insight">
      <h4>${escapeHtml(insight.role || "관련 직무")}</h4>
      <p>${escapeHtml(insight.why_relevant_ko || "")}</p>
      ${(insight.considerations_ko || []).length ? `
        <strong>현업에서 생각할 점</strong>
        <ul>${insight.considerations_ko.map((value) => `<li>${escapeHtml(value)}</li>`).join("")}</ul>
      ` : ""}
      ${(insight.study_points_ko || []).length ? `
        <strong>취업 준비 학습 포인트</strong>
        <ul>${insight.study_points_ko.map((value) => `<li>${escapeHtml(value)}</li>`).join("")}</ul>
      ` : ""}
    </section>
  `).join("");
  const facts = (analysis.facts || []).map((fact) => `
    <li>
      ${escapeHtml(fact.statement_ko || "")}
      ${fact.evidence_en ? `<small>원문 근거: “${escapeHtml(fact.evidence_en)}”</small>` : ""}
    </li>
  `).join("");
  const implications = (analysis.company_implications || []).map((value) => `
    <li><strong>${escapeHtml(value.target_company || "대상 기업")}</strong> — ${escapeHtml(value.inference_ko || "")}
      ${value.basis_ko ? `<small>판단 근거: ${escapeHtml(value.basis_ko)}</small>` : ""}
    </li>
  `).join("");

  return `
    <details class="ai-analysis">
      <summary>AI 직무 인사이트 보기</summary>
      <div class="analysis-body">
        <div class="analysis-notice">
          <span>공식 원문 기반 · 자동 근거검사 통과</span>
          <span>신뢰도 ${confidenceLabel(analysis.overall_confidence)}</span>
        </div>
        <p class="analysis-summary">${escapeHtml(analysis.summary_ko || "")}</p>
        ${(analysis.technology_signals || []).length ? `
          <div class="technology-signals" aria-label="핵심 기술 신호">
            ${badgeList(analysis.technology_signals, "technology", 8)}
          </div>
        ` : ""}
        ${roles ? `<div class="role-insights"><h3>직무별 인사이트</h3>${roles}</div>` : ""}
        ${implications ? `<div class="analysis-section"><h3>기업 관점의 의미</h3><ul>${implications}</ul></div>` : ""}
        ${facts ? `<details class="evidence-details"><summary>확인된 사실과 원문 근거</summary><ul>${facts}</ul></details>` : ""}
        ${(analysis.uncertainties_ko || []).length ? `
          <div class="analysis-section uncertainty"><h3>추가 확인이 필요한 부분</h3>
            <ul>${analysis.uncertainties_ko.map((value) => `<li>${escapeHtml(value)}</li>`).join("")}</ul>
          </div>
        ` : ""}
        <p class="ai-disclaimer">AI가 작성한 참고용 초안입니다. 지원서·업무 판단에 사용하기 전 공식 원문을 확인하세요.</p>
      </div>
    </details>
  `;
}

function render() {
  const rows = visibleArticles();
  resultLine.textContent = `${rows.length}개의 기술 신호를 표시합니다.`;
  empty.hidden = rows.length !== 0;
  grid.innerHTML = rows.map((article) => {
    const showKorean = state.language === "ko" && article.title_ko;
    const displayTitle = showKorean ? article.title_ko : article.title;
    const translatedSummary = showKorean ? article.summary_ko : "";
    return `
    <article class="article-card">
      <div class="card-meta">
        <span class="company">${escapeHtml(article.company)}</span>
        <time datetime="${escapeHtml(article.published_at)}">${formatDate(article.published_at)}</time>
      </div>
      <h2>${escapeHtml(displayTitle)}</h2>
      ${showKorean ? `<p class="original-title">원문: ${escapeHtml(article.title)}</p>` : ""}
      ${translatedSummary ? `<p class="translated-summary">${escapeHtml(translatedSummary)}</p>` : ""}
      <div class="classification" aria-label="직무와 기술 분류">
        <span class="badge relevance ${article.relevance === "high" ? "high" : "context"}">
          ${article.relevance === "high" ? "핵심 기술" : "참고 동향"}
        </span>
        ${badgeList(article.job_roles, "job")}
        ${badgeList(article.tech_domains, "domain")}
        ${badgeList(article.signal_types, "signal", 2)}
      </div>
      <div class="keywords" aria-label="분류 근거">
        ${((article.matched_keywords || []).length
          ? article.matched_keywords
          : [article.source_category || "공식 발표"]
        ).slice(0, 6).map((word) => `<span class="keyword">${escapeHtml(word)}</span>`).join("")}
      </div>
      ${renderAiAnalysis(article.ai_analysis)}
      <a class="source-link" href="${escapeHtml(article.url)}" target="_blank" rel="noopener noreferrer">공식 원문 보기 →</a>
    </article>
  `;
  }).join("");
}

function updateLanguageButton() {
  const button = document.querySelector("#language-toggle");
  button.disabled = state.translatedCount === 0;
  if (state.translatedCount === 0) {
    button.textContent = "한국어 번역 준비 중";
  } else if (state.language === "ko") {
    button.textContent = "영문 원문 보기";
  } else {
    button.textContent = `한국어 번역 보기 (${state.translatedCount})`;
  }
}

function createCompanyFilters(companies) {
  const container = document.querySelector("#company-filters");
  companies.forEach((company) => {
    const button = document.createElement("button");
    button.className = "filter";
    button.type = "button";
    button.dataset.company = company;
    button.textContent = company;
    container.append(button);
  });
  container.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-company]");
    if (!button) return;
    container.querySelectorAll("button").forEach((item) => item.classList.toggle("active", item === button));
    state.company = button.dataset.company;
    render();
  });
}

function fillSelect(selector, values, field) {
  const select = document.querySelector(selector);
  const counts = new Map();
  state.articles.forEach((article) => {
    (article[field] || []).forEach((value) => {
      counts.set(value, (counts.get(value) || 0) + 1);
    });
  });
  values.filter((value) => counts.has(value)).forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = `${value} (${counts.get(value)})`;
    select.append(option);
  });
}

function bindFilters() {
  document.querySelector("#importance-filters").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-relevance]");
    if (!button) return;
    document.querySelectorAll("#importance-filters button").forEach((item) => {
      item.classList.toggle("active", item === button);
    });
    state.relevance = button.dataset.relevance;
    render();
  });

  const selectBindings = {
    "#job-filter": "job",
    "#domain-filter": "domain",
    "#signal-filter": "signal",
    "#days-filter": "days",
  };
  Object.entries(selectBindings).forEach(([selector, key]) => {
    document.querySelector(selector).addEventListener("change", (event) => {
      state[key] = event.target.value;
      render();
    });
  });

  document.querySelector("#reset-filters").addEventListener("click", () => {
    state.company = "all";
    state.relevance = "all";
    state.job = "all";
    state.domain = "all";
    state.signal = "all";
    state.days = "all";
    state.query = "";
    document.querySelector("#search").value = "";
    document.querySelectorAll("#company-filters button").forEach((button) => {
      button.classList.toggle("active", button.dataset.company === "all");
    });
    document.querySelectorAll("#importance-filters button").forEach((button) => {
      button.classList.toggle("active", button.dataset.relevance === "all");
    });
    ["#job-filter", "#domain-filter", "#signal-filter", "#days-filter"].forEach((selector) => {
      document.querySelector(selector).value = "all";
    });
    render();
  });
}

async function loadData() {
  try {
    const response = await fetch("data/latest.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    state.articles = data.articles || [];
    const companies = Object.keys(data.company_counts || {});
    const options = data.filter_options || {};
    state.trendSummary = data.trend_summary || null;
    state.monthlyTrendReport = data.monthly_trend_report || null;
    state.translatedCount = Number(data.translation?.translated_count || 0);
    document.querySelector("#total-count").textContent = data.article_count ?? state.articles.length;
    document.querySelector("#company-count").textContent = companies.length;
    document.querySelector("#analysis-count").textContent = Number(data.ai_analysis?.analyzed_count || 0);
    document.querySelector("#updated").textContent = `최근 갱신 ${formatDate(data.generated_at)}`;
    createCompanyFilters(companies);
    fillSelect("#job-filter", options.job_roles || [], "job_roles");
    fillSelect("#domain-filter", options.tech_domains || [], "tech_domains");
    fillSelect("#signal-filter", options.signal_types || [], "signal_types");
    updateLanguageButton();
    renderTrendSummary();
    renderMonthlyReport();
    render();
  } catch (error) {
    resultLine.textContent = "데이터를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.";
    empty.hidden = false;
    empty.querySelector("h2").textContent = "데이터 연결을 확인하고 있습니다.";
    console.error(error);
  }
}

document.querySelector("#search").addEventListener("input", (event) => {
  state.query = event.target.value;
  render();
});

document.querySelector("#language-toggle").addEventListener("click", () => {
  state.language = state.language === "ko" ? "original" : "ko";
  updateLanguageButton();
  render();
});

bindFilters();
bindTrendPeriodTabs();
bindCompanyProfiles();
loadData();
