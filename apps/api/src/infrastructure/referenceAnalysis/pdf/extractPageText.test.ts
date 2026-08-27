import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { extractPageText } from "./extractPageText";

// 합성(자체 제작) 2페이지 PDF — 저작권 없는 더미 텍스트만 담고 있다(생성 스크립트: __fixtures__/generate-synthetic-pdf.mjs).
const FIXTURE_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "__fixtures__/synthetic-two-page.pdf",
);

describe("extractPageText", () => {
  it("페이지별 텍스트를 순서대로 추출한다", async () => {
    const pages = await extractPageText(FIXTURE_PATH);

    expect(pages).toHaveLength(2);
    expect(pages[0]).toMatchObject({ pageNumber: 1 });
    expect(pages[0]!.text).toContain("1. 2x+3=7 equation. Solve for x.");
    expect(pages[0]!.text).toContain("2. Solve for y: 3y-5=10");
    expect(pages[1]).toMatchObject({ pageNumber: 2 });
    expect(pages[1]!.text).toContain("3. If f(x)=x^2, find f(3).");
  });

  it("fromPage/toPage로 범위를 제한할 수 있다", async () => {
    const pages = await extractPageText(FIXTURE_PATH, { fromPage: 2, toPage: 2 });

    expect(pages).toHaveLength(1);
    expect(pages[0]!.pageNumber).toBe(2);
  });
});
