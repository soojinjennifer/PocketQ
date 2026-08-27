import { writeFileSync } from "node:fs";

function buildPdf(pagesText) {
  // pagesText: array of array-of-lines (per page)
  const objects = [];
  const catalogIdx = 1;
  const pagesIdx = 2;
  const fontIdx = 3;
  const firstPageIdx = 4; // pages start here, one content stream obj follows each page obj

  const pageCount = pagesText.length;
  const pageObjNums = [];
  const contentObjNums = [];
  let nextNum = 4;
  for (let i = 0; i < pageCount; i++) {
    pageObjNums.push(nextNum++);
    contentObjNums.push(nextNum++);
  }

  const kids = pageObjNums.map((n) => `${n} 0 R`).join(" ");

  const objStrings = {};
  objStrings[catalogIdx] = `<< /Type /Catalog /Pages ${pagesIdx} 0 R >>`;
  objStrings[pagesIdx] = `<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>`;
  objStrings[fontIdx] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`;

  for (let i = 0; i < pageCount; i++) {
    const pageNum = pageObjNums[i];
    const contentNum = contentObjNums[i];
    objStrings[pageNum] = `<< /Type /Page /Parent ${pagesIdx} 0 R /Resources << /Font << /F1 ${fontIdx} 0 R >> >> /MediaBox [0 0 612 792] /Contents ${contentNum} 0 R >>`;

    let y = 720;
    const lines = pagesText[i];
    const streamLines = lines.map((line) => {
      const escaped = line.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
      const s = `BT /F1 12 Tf 72 ${y} Td (${escaped}) Tj ET`;
      y -= 20;
      return s;
    });
    const streamContent = streamLines.join("\n");
    objStrings[contentNum] = { stream: streamContent };
  }

  const maxObjNum = nextNum - 1;

  let pdf = "%PDF-1.4\n";
  const offsets = new Array(maxObjNum + 1).fill(0);

  for (let num = 1; num <= maxObjNum; num++) {
    offsets[num] = Buffer.byteLength(pdf, "latin1");
    const val = objStrings[num];
    if (typeof val === "string") {
      pdf += `${num} 0 obj\n${val}\nendobj\n`;
    } else if (val && typeof val === "object" && "stream" in val) {
      const len = Buffer.byteLength(val.stream, "latin1");
      pdf += `${num} 0 obj\n<< /Length ${len} >>\nstream\n${val.stream}\nendstream\nendobj\n`;
    }
  }

  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${maxObjNum + 1}\n`;
  pdf += `0000000000 65535 f \n`;
  for (let num = 1; num <= maxObjNum; num++) {
    pdf += `${String(offsets[num]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${maxObjNum + 1} /Root ${catalogIdx} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, "latin1");
}

// Page 1: two numbered items
const page1 = [
  "1. 2x+3=7 equation. Solve for x.",
  "2. Solve for y: 3y-5=10",
];
// Page 2: one numbered item with circled-number-like marker (use plain text marker since
// synthetic fixture keeps ASCII-only content for hand-built PDF simplicity)
const page2 = [
  "3. If f(x)=x^2, find f(3).",
];

const buf = buildPdf([page1, page2]);
writeFileSync(process.argv[2], buf);
console.log("wrote", process.argv[2], buf.length, "bytes");
