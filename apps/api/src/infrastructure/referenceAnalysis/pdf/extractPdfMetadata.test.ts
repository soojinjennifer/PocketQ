import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { extractPdfMetadata, PDFJS_PARSER_VERSION } from "./extractPdfMetadata";

// 합성(자체 제작) 2페이지 PDF — 저작권 없는 더미 텍스트만 담고 있다(생성 스크립트: __fixtures__/generate-synthetic-pdf.mjs).
const FIXTURE_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "__fixtures__/synthetic-two-page.pdf",
);

describe("extractPdfMetadata", () => {
  it("sha256 파일 해시와 페이지 수를 반환한다", async () => {
    const expectedHash = createHash("sha256").update(readFileSync(FIXTURE_PATH)).digest("hex");

    const metadata = await extractPdfMetadata(FIXTURE_PATH);

    expect(metadata.fileHash).toBe(expectedHash);
    expect(metadata.pageCount).toBe(2);
    expect(metadata.parserVersion).toBe(PDFJS_PARSER_VERSION);
  });
});
