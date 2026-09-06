import { describe, expect, it } from "vitest";
import type { Diagnosis, WorkLine } from "shared-types";
import { deriveWorkLineJudgments } from "./deriveWorkLineJudgments";

function createWorkLines(count: number): WorkLine[] {
  return Array.from({ length: count }, (_, index) => ({
    lineNo: index + 1,
    latex: `line-${index + 1}`,
    isLowConfidence: false,
  }));
}

function createDiagnosis(overrides: Partial<Diagnosis> = {}): Diagnosis {
  return {
    lastValidLine: 0,
    stallLine: null,
    errorTypeLabel: null,
    errorDetail: null,
    relatedConcepts: [],
    reachedAnswerWithNotes: false,
    isLowConfidence: false,
    conceptExplanations: [],
    identifiedMethod: null,
    isMethodApplicable: true,
    methodApplicabilityNote: null,
    ...overrides,
  };
}

describe("deriveWorkLineJudgments", () => {
  it("lastValidLine 이하의 줄은 isValid=true로 판정한다", () => {
    const result = deriveWorkLineJudgments(createWorkLines(3), createDiagnosis({ lastValidLine: 2 }));

    expect(result).toEqual([
      { lineNo: 1, latex: "line-1", isValid: true },
      { lineNo: 2, latex: "line-2", isValid: true },
      { lineNo: 3, latex: "line-3", isValid: null },
    ]);
  });

  it("stallLine과 일치하는 줄은 isValid=false로 판정한다(오류형)", () => {
    const result = deriveWorkLineJudgments(
      createWorkLines(3),
      createDiagnosis({ lastValidLine: 1, stallLine: 2 }),
    );

    expect(result).toEqual([
      { lineNo: 1, latex: "line-1", isValid: true },
      { lineNo: 2, latex: "line-2", isValid: false },
      { lineNo: 3, latex: "line-3", isValid: null },
    ]);
  });

  it("stallLine이 null이면(중단형, DIAG-4) 막힌 지점 배지 없이 lastValidLine 이후 줄은 모두 null이다", () => {
    const result = deriveWorkLineJudgments(
      createWorkLines(2),
      createDiagnosis({ lastValidLine: 2, stallLine: null }),
    );

    expect(result).toEqual([
      { lineNo: 1, latex: "line-1", isValid: true },
      { lineNo: 2, latex: "line-2", isValid: true },
    ]);
  });

  it("lastValidLine=0(첫 줄부터 막힘)이어도 정상 동작한다", () => {
    const result = deriveWorkLineJudgments(
      createWorkLines(2),
      createDiagnosis({ lastValidLine: 0, stallLine: 1 }),
    );

    expect(result).toEqual([
      { lineNo: 1, latex: "line-1", isValid: false },
      { lineNo: 2, latex: "line-2", isValid: null },
    ]);
  });

  it("빈 workLines 배열이면 빈 배열을 반환한다", () => {
    expect(deriveWorkLineJudgments([], createDiagnosis())).toEqual([]);
  });
});
