import { describe, expect, it } from "vitest";
import { estimateExamDifficulty, type ExamDifficultyEstimateInput } from "./examDifficultyEstimate";

const BASE: ExamDifficultyEstimateInput = {
  conceptLoad: 1,
  reasoningStepCount: 1,
  conditionInterpretationLoad: "LOW",
  calculationLoad: "LOW",
  caseSplitRequired: false,
  representationConversion: false,
  nonObviousTransformation: false,
};

describe("estimateExamDifficulty", () => {
  it("필수 입력 중 하나라도 null이면 UNKNOWN을 돌려준다", () => {
    expect(estimateExamDifficulty({ ...BASE, conceptLoad: null })).toEqual({
      difficulty: "UNKNOWN",
      score: null,
      clamped: false,
    });
    expect(estimateExamDifficulty({ ...BASE, reasoningStepCount: null }).difficulty).toBe("UNKNOWN");
    expect(estimateExamDifficulty({ ...BASE, conditionInterpretationLoad: null }).difficulty).toBe("UNKNOWN");
    expect(estimateExamDifficulty({ ...BASE, calculationLoad: null }).difficulty).toBe("UNKNOWN");
  });

  it("낮은 부하의 단순 문항은 D1로 분류하고 clamp가 필요 없다", () => {
    const result = estimateExamDifficulty(BASE);
    expect(result.difficulty).toBe("D1");
    expect(result.clamped).toBe(false);
  });

  it("다른 신호가 충분히 높으면 계산 부하 없이도 D4 이상으로 분류될 수 있다(clamp 없음)", () => {
    const input: ExamDifficultyEstimateInput = {
      conceptLoad: 3,
      reasoningStepCount: 4,
      conditionInterpretationLoad: "MEDIUM",
      calculationLoad: "MEDIUM",
      caseSplitRequired: true,
      representationConversion: false,
      nonObviousTransformation: true,
    };

    const result = estimateExamDifficulty(input);

    expect(result.difficulty).toBe("D4");
    expect(result.clamped).toBe(false);
  });

  it("clamp 규칙: 다른 신호는 D2 이하 수준인데 calculation_load만 HIGH면 D3으로 상한된다", () => {
    const input: ExamDifficultyEstimateInput = {
      conceptLoad: 2,
      reasoningStepCount: 3,
      conditionInterpretationLoad: "MEDIUM",
      calculationLoad: "HIGH",
      caseSplitRequired: false,
      representationConversion: true,
      nonObviousTransformation: false,
    };

    const result = estimateExamDifficulty(input);

    expect(result.score).toBeCloseTo(13.2, 5);
    expect(result.difficulty).toBe("D3");
    expect(result.clamped).toBe(true);
  });

  it("clamp 회귀 방지: 다른 신호가 전부 최저 수준이면 calculation_load=HIGH여도 D4/D5에 절대 도달하지 않는다", () => {
    const combos: ExamDifficultyEstimateInput[] = [
      { ...BASE, calculationLoad: "HIGH" },
      { ...BASE, calculationLoad: "HIGH", conditionInterpretationLoad: "MEDIUM" },
      { ...BASE, calculationLoad: "HIGH", caseSplitRequired: true },
      { ...BASE, calculationLoad: "HIGH", representationConversion: true },
    ];

    for (const combo of combos) {
      const result = estimateExamDifficulty(combo);
      expect(["D1", "D2", "D3"]).toContain(result.difficulty);
    }
  });

  it("다른 신호가 이미 D3 이상이면 calculation_load=HIGH가 추가로 clamp 대상이 되지 않는다", () => {
    const input: ExamDifficultyEstimateInput = {
      conceptLoad: 3,
      reasoningStepCount: 4,
      conditionInterpretationLoad: "HIGH",
      calculationLoad: "HIGH",
      caseSplitRequired: true,
      representationConversion: true,
      nonObviousTransformation: true,
    };

    const result = estimateExamDifficulty(input);

    expect(result.difficulty).toBe("D5");
    expect(result.clamped).toBe(false);
  });

  it("같은 입력엔 항상 같은 결과를 돌려준다(순수 함수)", () => {
    const input: ExamDifficultyEstimateInput = {
      conceptLoad: 2,
      reasoningStepCount: 2,
      conditionInterpretationLoad: "MEDIUM",
      calculationLoad: "MEDIUM",
      caseSplitRequired: false,
      representationConversion: false,
      nonObviousTransformation: false,
    };

    expect(estimateExamDifficulty(input)).toEqual(estimateExamDifficulty(input));
  });
});
