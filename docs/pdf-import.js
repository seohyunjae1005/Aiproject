(function (root) {
  "use strict";

  const PDFJS_VERSION = "5.4.624";
  const MODULE_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.min.mjs`;
  const WORKER_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;
  const MAX_BYTES = 20 * 1024 * 1024;
  const MAX_PAGES = 150;

  function textFromItems(items) {
    const lines = [];
    let current = [];
    let previousY = null;

    (items || []).forEach((item) => {
      const value = String(item?.str || "").replace(/\s+/g, " ").trim();
      const y = Number(item?.transform?.[5]);
      const changedLine = previousY !== null && Number.isFinite(y) && Math.abs(y - previousY) > 2;
      if (changedLine && current.length) {
        lines.push(current.join(" ").replace(/\s+([,.;:!?])/g, "$1"));
        current = [];
      }
      if (value) current.push(value);
      if (item?.hasEOL && current.length) {
        lines.push(current.join(" ").replace(/\s+([,.;:!?])/g, "$1"));
        current = [];
      }
      if (Number.isFinite(y)) previousY = y;
    });
    if (current.length) lines.push(current.join(" ").replace(/\s+([,.;:!?])/g, "$1"));
    return lines.map((line) => line.trim()).filter(Boolean).join("\n");
  }

  async function extract(file, onProgress) {
    if (!file) throw new Error("PDF 파일을 선택해 주세요.");
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name || "");
    if (!isPdf) throw new Error("PDF 형식의 파일만 사용할 수 있습니다.");
    if (file.size > MAX_BYTES) throw new Error("PDF는 20MB 이하만 사용할 수 있습니다.");

    onProgress?.("PDF 분석 도구를 준비하고 있습니다.");
    const pdfjs = await import(MODULE_URL);
    pdfjs.GlobalWorkerOptions.workerSrc = WORKER_URL;
    const data = new Uint8Array(await file.arrayBuffer());
    const loadingTask = pdfjs.getDocument({ data, isEvalSupported: false });
    const pdf = await loadingTask.promise;
    const pageCount = pdf.numPages;
    if (pageCount > MAX_PAGES) throw new Error(`페이지가 너무 많습니다. ${MAX_PAGES}쪽 이하의 직무소개서만 사용해 주세요.`);

    const pages = [];
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      onProgress?.(`${pageCount}쪽 중 ${pageNumber}쪽에서 글자를 읽고 있습니다.`);
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = textFromItems(content.items);
      if (text) pages.push(`[${pageNumber}쪽]\n${text}`);
      page.cleanup();
    }
    await pdf.destroy();
    const fullText = pages.join("\n\n").trim();
    if (fullText.replace(/\s/g, "").length < 80) {
      throw new Error("글자를 거의 찾지 못했습니다. 이미지로 스캔한 PDF는 아직 지원하지 않습니다.");
    }
    return { text: fullText, pages: pageCount, characters: fullText.length, fileName: file.name };
  }

  root.JDPdfImport = { PDFJS_VERSION, MAX_BYTES, MAX_PAGES, textFromItems, extract };
  if (typeof module !== "undefined" && module.exports) module.exports = root.JDPdfImport;
})(typeof window !== "undefined" ? window : globalThis);
