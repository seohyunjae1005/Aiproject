const assert = require("node:assert/strict");
const pdfImport = require("../docs/pdf-import.js");

const text = pdfImport.textFromItems([
  { str: "수행업무", transform: [1, 0, 0, 1, 10, 700], hasEOL: true },
  { str: "공정", transform: [1, 0, 0, 1, 10, 680] },
  { str: "데이터를", transform: [1, 0, 0, 1, 45, 680] },
  { str: "분석합니다.", transform: [1, 0, 0, 1, 100, 680], hasEOL: true },
  { str: "지원자격", transform: [1, 0, 0, 1, 10, 650], hasEOL: true },
]);

assert.equal(text, "수행업무\n공정 데이터를 분석합니다.\n지원자격");
assert.equal(pdfImport.MAX_BYTES, 20 * 1024 * 1024);
assert.equal(pdfImport.MAX_PAGES, 150);
console.log("PDF import tests passed");
