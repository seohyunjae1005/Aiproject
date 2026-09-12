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
    state.translatedCount = Number(data.translation?.translated_count || 0);
    document.querySelector("#total-count").textContent = data.article_count ?? state.articles.length;
    document.querySelector("#company-count").textContent = companies.length;
    document.querySelector("#updated").textContent = `최근 갱신 ${formatDate(data.generated_at)}`;
    createCompanyFilters(companies);
    fillSelect("#job-filter", options.job_roles || [], "job_roles");
    fillSelect("#domain-filter", options.tech_domains || [], "tech_domains");
    fillSelect("#signal-filter", options.signal_types || [], "signal_types");
    updateLanguageButton();
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
loadData();
