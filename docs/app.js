const state = { articles: [], company: "all", query: "" };

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
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "short", day: "numeric" }).format(new Date(value));
}

function visibleArticles() {
  const query = state.query.trim().toLocaleLowerCase("ko");
  return state.articles.filter((article) => {
    const companyMatch = state.company === "all" || article.company === state.company;
    const text = [article.title, article.company, ...(article.matched_keywords || [])].join(" ").toLocaleLowerCase("ko");
    return companyMatch && (!query || text.includes(query));
  });
}

function render() {
  const rows = visibleArticles();
  resultLine.textContent = `${rows.length}개의 기술 신호를 표시합니다.`;
  empty.hidden = rows.length !== 0;
  grid.innerHTML = rows.map((article) => `
    <article class="article-card">
      <div class="card-meta">
        <span class="company">${escapeHtml(article.company)}</span>
        <time datetime="${escapeHtml(article.published_at)}">${formatDate(article.published_at)}</time>
      </div>
      <h2>${escapeHtml(article.title)}</h2>
      <div class="keywords" aria-label="선별 근거">
        ${(article.matched_keywords || []).map((word) => `<span class="keyword">${escapeHtml(word)}</span>`).join("")}
      </div>
      <a class="source-link" href="${escapeHtml(article.url)}" target="_blank" rel="noopener noreferrer">공식 원문 보기 →</a>
    </article>
  `).join("");
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

async function loadData() {
  try {
    const response = await fetch("data/latest.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    state.articles = data.articles || [];
    const companies = Object.keys(data.company_counts || {});
    document.querySelector("#total-count").textContent = data.article_count ?? state.articles.length;
    document.querySelector("#company-count").textContent = companies.length;
    document.querySelector("#updated").textContent = `최근 갱신 ${formatDate(data.generated_at)}`;
    createCompanyFilters(companies);
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

loadData();
