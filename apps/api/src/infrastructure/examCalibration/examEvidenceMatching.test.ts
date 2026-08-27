import { describe, expect, it } from "vitest";
import {
  computeEvidenceWeight,
  matchFamilyToExamItem,
  passesCurriculumOverlapGate,
  type EvidenceMatchingExamItemInput,
  type EvidenceMatchingFamilyInput,
} from "./examEvidenceMatching";

const FAMILY: EvidenceMatchingFamilyInput = {
  curriculumNodeCodes: ["ALG_EXP_LOG_EXP"],
  requiredSkills: ["symmetric_substitution", "exponent_equation_solving"],
  reasoningSignature: "지수식_치환|symmetric_substitution_exponent_equation|equation|skill_a+skill_b|cond:0-1",
  representationTypes: ["equation"],
};

describe("passesCurriculumOverlapGate", () => {
  it("커리큘럼 노드가 하나도 안 겹치면 false를 돌려준다", () => {
    expect(passesCurriculumOverlapGate(["ALG_EXP_LOG_EXP"], ["CALC1_DERIV"])).toBe(false);
  });

  it("커리큘럼 노드가 하나라도 겹치면 true를 돌려준다", () => {
    expect(passesCurriculumOverlapGate(["ALG_EXP_LOG_EXP", "ALG_EXP_LOG_LOG"], ["ALG_EXP_LOG_LOG"])).toBe(true);
  });
});

describe("matchFamilyToExamItem", () => {
  it("커리큘럼 노드가 하나도 안 겹치면 다른 유사도를 계산하지 않고 NONE을 돌려준다", () => {
    const examItem: EvidenceMatchingExamItemInput = {
      curriculumNodeCodes: ["CALC1_DERIV_APPLY"],
      requiredSkills: ["symmetric_substitution", "exponent_equation_solving"],
      reasoningSignature: "symmetric_substitution_exponent_equation",
      representationType: "equation",
      evidenceTier: "GOLD_2028_SAMPLE",
    };

    const result = matchFamilyToExamItem(FAMILY, examItem);

    expect(result).toEqual({
      matchType: "NONE",
      structuralSimilarity: 0,
      skillOverlap: 0,
      reasoningOverlap: 0,
      evidenceWeight: 0,
    });
  });

  it("스킬/추론/표현형태가 모두 강하게 겹치면 DIRECT로 분류하고 GOLD 가중치를 최대로 준다", () => {
    const examItem: EvidenceMatchingExamItemInput = {
      curriculumNodeCodes: ["ALG_EXP_LOG_EXP"],
      requiredSkills: ["symmetric_substitution", "exponent_equation_solving"],
      reasoningSignature: "symmetric_substitution_exponent_equation",
      representationType: "equation",
      evidenceTier: "GOLD_2028_SAMPLE",
    };

    const result = matchFamilyToExamItem(FAMILY, examItem);

    expect(result.matchType).toBe("DIRECT");
    expect(result.evidenceWeight).toBe(1);
  });

  it("동일한 matchType이어도 SILVER는 GOLD보다 evidenceWeight가 낮다", () => {
    const examItem: EvidenceMatchingExamItemInput = {
      curriculumNodeCodes: ["ALG_EXP_LOG_EXP"],
      requiredSkills: ["symmetric_substitution", "exponent_equation_solving"],
      reasoningSignature: "symmetric_substitution_exponent_equation",
      representationType: "equation",
      evidenceTier: "SILVER_KICE",
    };

    const result = matchFamilyToExamItem(FAMILY, examItem);

    expect(result.matchType).toBe("DIRECT");
    expect(result.evidenceWeight).toBeLessThan(1);
    expect(result.evidenceWeight).toBeGreaterThan(0);
  });

  it("스킬/추론이 전혀 겹치지 않으면(노드만 겹침) WEAK 또는 NONE으로 낮게 분류한다", () => {
    const examItem: EvidenceMatchingExamItemInput = {
      curriculumNodeCodes: ["ALG_EXP_LOG_EXP"],
      requiredSkills: ["completely_unrelated_skill"],
      reasoningSignature: "completely_unrelated_reasoning",
      representationType: "graph",
      evidenceTier: "GOLD_2028_SAMPLE",
    };

    const result = matchFamilyToExamItem(FAMILY, examItem);

    expect(["WEAK", "NONE"]).toContain(result.matchType);
  });

  it("skillOverlap=0이고 reasoningOverlap=0이면 representationMatch(구조적 유사성)가 1이어도 NONE으로 분류한다(회귀)", () => {
    const examItem: EvidenceMatchingExamItemInput = {
      curriculumNodeCodes: ["ALG_EXP_LOG_EXP"],
      requiredSkills: ["completely_unrelated_skill"],
      reasoningSignature: "completely_unrelated_reasoning",
      // FAMILY.representationTypes = ["equation"]과 동일하게 맞춰 representationMatch=1이
      // 되도록 구성한다 — 이 경우에도 skillOverlap/reasoningOverlap이 0이면 NONE이어야 한다.
      representationType: "equation",
      evidenceTier: "GOLD_2028_SAMPLE",
    };

    const result = matchFamilyToExamItem(FAMILY, examItem);

    expect(result.skillOverlap).toBe(0);
    expect(result.reasoningOverlap).toBe(0);
    expect(result.structuralSimilarity).toBe(1);
    expect(result.matchType).toBe("NONE");
    expect(result.evidenceWeight).toBe(0);
  });
});

describe("computeEvidenceWeight", () => {
  it("NONE이면 tier와 무관하게 항상 0이다", () => {
    expect(computeEvidenceWeight("NONE", "GOLD_2028_SAMPLE")).toBe(0);
    expect(computeEvidenceWeight("NONE", "SILVER_KICE")).toBe(0);
  });

  it("같은 matchType 기준 GOLD의 가중치 상한이 SILVER보다 항상 높다", () => {
    for (const matchType of ["DIRECT", "PARTIAL", "COMPOSITE", "WEAK"] as const) {
      const goldWeight = computeEvidenceWeight(matchType, "GOLD_2028_SAMPLE");
      const silverWeight = computeEvidenceWeight(matchType, "SILVER_KICE");
      expect(goldWeight).toBeGreaterThan(silverWeight);
    }
  });

  it("반환값은 항상 0~1 사이다", () => {
    for (const matchType of ["DIRECT", "PARTIAL", "COMPOSITE", "WEAK", "NONE"] as const) {
      for (const tier of ["GOLD_2028_SAMPLE", "SILVER_KICE", "REFERENCE_OTHER"] as const) {
        const weight = computeEvidenceWeight(matchType, tier);
        expect(weight).toBeGreaterThanOrEqual(0);
        expect(weight).toBeLessThanOrEqual(1);
      }
    }
  });
});
