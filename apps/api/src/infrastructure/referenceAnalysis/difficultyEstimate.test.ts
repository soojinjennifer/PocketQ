import { describe, expect, it } from "vitest";
import { type DifficultyEstimateInput, estimateReferenceDifficulty } from "./difficultyEstimate";

function buildInput(overrides: Partial<DifficultyEstimateInput> = {}): DifficultyEstimateInput {
  return {
    conceptLoad: 1,
    reasoningStepCount: 1,
    conditionCount: 1,
    calculationLoad: "LOW",
    caseSplitRequired: false,
    nontrivialTransformationRequired: false,
    ...overrides,
  };
}

describe("estimateReferenceDifficulty", () => {
  it.each([
    ["conceptLoad", { conceptLoad: null }],
    ["reasoningStepCount", { reasoningStepCount: null }],
    ["conditionCount", { conditionCount: null }],
    ["calculationLoad", { calculationLoad: null }],
  ] as const)("%s가 null이면 UNKNOWN을 반환한다", (_label, overrides) => {
    const result = estimateReferenceDifficulty(buildInput(overrides));
    expect(result.difficulty).toBe("UNKNOWN");
    expect(result.score).toBeNull();
  });

  it("낮은 부담 조합은 D1로 분류한다", () => {
    const result = estimateReferenceDifficulty(
      buildInput({ conceptLoad: 0, reasoningStepCount: 1, conditionCount: 1, calculationLoad: "LOW" }),
    );
    expect(result.difficulty).toBe("D1");
  });

  it("케이스 분류 + 비자명한 변환이 모두 필요하면 난이도가 올라간다", () => {
    const base = estimateReferenceDifficulty(
      buildInput({ conceptLoad: 2, reasoningStepCount: 3, conditionCount: 2, calculationLoad: "MEDIUM" }),
    );
    const harder = estimateReferenceDifficulty(
      buildInput({
        conceptLoad: 2,
        reasoningStepCount: 3,
        conditionCount: 2,
        calculationLoad: "MEDIUM",
        caseSplitRequired: true,
        nontrivialTransformationRequired: true,
      }),
    );

    expect(harder.score!).toBeGreaterThan(base.score!);
  });

  it("매우 높은 부담 조합은 D5로 분류한다", () => {
    const result = estimateReferenceDifficulty(
      buildInput({
        conceptLoad: 5,
        reasoningStepCount: 6,
        conditionCount: 5,
        calculationLoad: "HIGH",
        caseSplitRequired: true,
        nontrivialTransformationRequired: true,
      }),
    );
    expect(result.difficulty).toBe("D5");
  });

  it("같은 입력엔 항상 같은 결과를 반환한다(순수 함수)", () => {
    const input = buildInput({ conceptLoad: 3, reasoningStepCount: 2, conditionCount: 2, calculationLoad: "MEDIUM" });
    expect(estimateReferenceDifficulty(input)).toEqual(estimateReferenceDifficulty(input));
  });
});
