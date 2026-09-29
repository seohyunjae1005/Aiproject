const form = document.querySelector("#tester-form");
const result = document.querySelector("#tester-result");
const output = document.querySelector("#feedback-output");
const copyButton = document.querySelector("#copy-feedback");
const copyStatus = document.querySelector("#copy-status");

function buildSummary(data) {
  const tasks = [1, 2, 3, 4, 5].map((number) => `${number}:${data.get(`task${number}`)}`);
  const successes = tasks.filter((task) => task.endsWith(":성공")).length;
  return [
    `[반도체 산업 동향 사용성 테스트]`,
    `구분: ${data.get("testerCode")}`,
    `기능 수행: ${successes}/5개 성공 (${tasks.join(", ")})`,
    `찾기 쉬움: ${data.get("ease")}/5`,
    `취업 준비 도움: ${data.get("usefulness")}/5`,
    `근거 신뢰도: ${data.get("trust")}/5`,
    `개선 의견: ${String(data.get("note")).trim()}`,
  ].join("\n");
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  output.textContent = buildSummary(new FormData(form));
  result.hidden = false;
  copyStatus.textContent = "";
  result.scrollIntoView({ behavior: "smooth", block: "start" });
});

copyButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(output.textContent);
    copyStatus.textContent = "복사되었습니다. 담당자에게 붙여넣어 보내 주세요.";
  } catch (error) {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(output);
    selection.removeAllRanges();
    selection.addRange(range);
    copyStatus.textContent = "자동 복사가 차단되었습니다. 선택된 문장을 직접 복사해 주세요.";
    console.error(error);
  }
});
