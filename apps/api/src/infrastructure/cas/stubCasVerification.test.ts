import { describe, expect, it } from "vitest";
import { stubCasVerification } from "./stubCasVerification";

describe("stubCasVerification", () => {
  it("빈 배열이 들어오면 빈 배열을 반환한다", () => {
    expect(stubCasVerification([])).toEqual([]);
  });

  it("어떤 latex 내용이든 관계없이 모든 줄을 isValid: true로 반환한다", () => {
    const result = stubCasVerification([
      { lineNo: 1, latex: "y = x^{2} - 4x + 3", isLowConfidence: false },
      { lineNo: 2, latex: "\\text{말이 안 되는 줄}", isLowConfidence: true },
      { lineNo: 3, latex: "1 = 2", isLowConfidence: false },
    ]);

    expect(result).toEqual([
      { lineNo: 1, isValid: true },
      { lineNo: 2, isValid: true },
      { lineNo: 3, isValid: true },
    ]);
  });

  it("lineNo 순서를 그대로 보존한다(재정렬하지 않는다)", () => {
    const result = stubCasVerification([
      { lineNo: 3, latex: "c", isLowConfidence: false },
      { lineNo: 1, latex: "a", isLowConfidence: false },
    ]);

    expect(result.map((r) => r.lineNo)).toEqual([3, 1]);
  });
});
