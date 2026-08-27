import { describe, expect, it } from "vitest";
import type { ProblemFamilyCandidateInput } from "../../referenceAnalysis/problemFamilyCandidateSchema";
import {
  buildMergeProposalInputs,
  buildSplitProposalInputs,
  computeCoverageMetrics,
  computeFamilyCalibration,
  detectConflictingRepresentationTypes,
  mergeDifficultyBand,
  type CalibrationExamItemInput,
  type ComputeFamilyCalibrationOptions,
} from "./calibrateProblemFamilies.core";

const FAMILY: ProblemFamilyCandidateInput = {
  candidateCode: "FAM-ALG-EXPLOG-001",
  subject: "ALG",
  unit: "지수함수와 로그함수",
  curriculumNodeCodes: ["ALG_EXP_LOG_EXP"],
  familyName: "대칭 지수식 치환",
  coreConcept: "대칭 지수식 치환",
  requiredSkills: ["symmetric_substitution", "exponent_equation_solving"],
  reasoningSignature: "대칭적인_지수식|symmetric_substitution_exponent_equation|equation|skill_a+skill_b|cond:0-1",
  canonicalReasoningSteps: ["치환한다", "값을 구한다"],
  representationTypes: ["equation"],
  prerequisiteNodes: null,
  approximateDifficultyMin: "D2",
  approximateDifficultyMax: "D2",
  sourceItemCount: 3,
  evidenceItemKeys: ["doc#p001-i01", "doc#p002-i01", "doc#p003-i01"],
  confidence: 0.8,
  status: "CANDIDATE",
};

const GOLD_DIRECT_ITEM: CalibrationExamItemInput = {
  examItemId: "gold-item-1",
  itemNumber: 21,
  evidenceTier: "GOLD_2028_SAMPLE",
  curriculumNodeCodes: ["ALG_EXP_LOG_EXP"],
  requiredSkills: ["symmetric_substitution", "exponent_equation_solving"],
  reasoningSignature: "symmetric_substitution_exponent_equation",
  representationType: "equation",
  curriculumCompatibility: "DIRECT_COMPATIBLE",
  conceptLoad: 2,
  reasoningStepCount: 3,
  conditionInterpretationLoad: "MEDIUM",
  calculationLoad: "MEDIUM",
  caseSplitRequired: false,
  representationConversion: false,
  nonObviousTransformation: true,
};

/** FAMILY와 커리큘럼 노드/추론 서명이 겹치지만 representationType이 "graph"라 family의
 * "equation"과 모순 그룹(VISUAL vs SYMBOLIC)에 속하는 exam item. */
const GOLD_GRAPH_ITEM: CalibrationExamItemInput = {
  examItemId: "gold-item-3",
  itemNumber: 30,
  evidenceTier: "GOLD_2028_SAMPLE",
  curriculumNodeCodes: ["ALG_EXP_LOG_EXP"],
  requiredSkills: ["symmetric_substitution"],
  reasoningSignature: "symmetric_substitution_exponent_equation",
  representationType: "graph",
  curriculumCompatibility: "DIRECT_COMPATIBLE",
  conceptLoad: 3,
  reasoningStepCount: 4,
  conditionInterpretationLoad: "HIGH",
  calculationLoad: "HIGH",
  caseSplitRequired: true,
  representationConversion: true,
  nonObviousTransformation: true,
};

const UNRELATED_GOLD_ITEM: CalibrationExamItemInput = {
  examItemId: "gold-item-2",
  itemNumber: 5,
  evidenceTier: "GOLD_2028_SAMPLE",
  curriculumNodeCodes: ["CALC1_DERIV_DEF_RULES"],
  requiredSkills: ["product_rule_differentiation"],
  reasoningSignature: "product_rule_then_point_evaluation",
  representationType: "expression",
  curriculumCompatibility: "DIRECT_COMPATIBLE",
  conceptLoad: 2,
  reasoningStepCount: 2,
  conditionInterpretationLoad: "LOW",
  calculationLoad: "MEDIUM",
  caseSplitRequired: false,
  representationConversion: false,
  nonObviousTransformation: false,
};

const BASE_OPTIONS: ComputeFamilyCalibrationOptions = {
  curriculumNodesValid: true,
  duplicateOfAnotherFamilyCode: null,
  curriculumCentrality: 0.8,
  referenceCoverageRatio: 0.5,
  hasAnySilverEvidenceInCorpus: false,
  hasReliableReasoningReusabilitySignal: false,
};

describe("mergeDifficultyBand", () => {
  it("Gold 증거가 없으면 Stage 2 범위를 그대로 쓴다(center는 범위의 중간값)", () => {
    expect(mergeDifficultyBand("D2", "D3", [])).toEqual({ min: "D2", max: "D3", center: "D3" });
    expect(mergeDifficultyBand("D1", "D3", [])).toEqual({ min: "D1", max: "D3", center: "D2" });
  });

  it("둘 다 없으면 UNKNOWN이다", () => {
    expect(mergeDifficultyBand(null, null, [])).toEqual({ min: "UNKNOWN", max: "UNKNOWN", center: "UNKNOWN" });
  });

  it("Gold 증거가 Stage 2 범위 밖이면 범위를 확장한다(Gold를 무시하지 않음)", () => {
    const result = mergeDifficultyBand("D1", "D2", ["D4"]);
    expect(result.min).toBe("D1");
    expect(result.max).toBe("D4");
    expect(result.center).toBe("D4");
  });

  it("Gold 증거가 여러 개면 평균에 가까운 값을 center로 잡는다", () => {
    const result = mergeDifficultyBand("D1", "D5", ["D2", "D3", "D4"]);
    expect(result.center).toBe("D3");
  });
});

describe("computeFamilyCalibration", () => {
  it("DIRECT 매치되는 Gold 문항이 있으면 goldEvidenceCount가 1 이상이고 APPROVED에 도달할 수 있다", () => {
    const result = computeFamilyCalibration(FAMILY, [GOLD_DIRECT_ITEM], BASE_OPTIONS);

    expect(result.goldEvidenceCount).toBeGreaterThanOrEqual(1);
    expect(result.silverEvidenceCount).toBe(0);
    expect(result.evidence.some((e) => e.result.matchType === "DIRECT")).toBe(true);
    expect(result.approval.status).toBe("APPROVED");
  });

  it("커리큘럼이 전혀 겹치지 않는 exam item은 증거로 집계되지 않는다", () => {
    const result = computeFamilyCalibration(FAMILY, [UNRELATED_GOLD_ITEM], BASE_OPTIONS);

    expect(result.evidence).toHaveLength(0);
    expect(result.goldEvidenceCount).toBe(0);
  });

  it("INCOMPATIBLE exam item은 증거 매칭 후보에서 하드 필터링된다", () => {
    const incompatibleItem: CalibrationExamItemInput = { ...GOLD_DIRECT_ITEM, curriculumCompatibility: "INCOMPATIBLE" };
    const result = computeFamilyCalibration(FAMILY, [incompatibleItem], BASE_OPTIONS);

    expect(result.evidence).toHaveLength(0);
  });

  it("SILVER 증거가 코퍼스에 없어도 Gold 증거만으로 CSAT 관련도가 REJECT 이상으로 계산된다", () => {
    const result = computeFamilyCalibration(FAMILY, [GOLD_DIRECT_ITEM], BASE_OPTIONS);
    expect(result.csat.score).toBeGreaterThan(0);
  });

  it("Gold DIRECT 매치가 있으면 난이도 밴드가 Gold 문항의 난이도를 반영해 확장된다", () => {
    const result = computeFamilyCalibration(FAMILY, [GOLD_DIRECT_ITEM], BASE_OPTIONS);
    expect(result.difficultyBand.min).not.toBe("UNKNOWN");
    expect(result.difficultyBand.max).not.toBe("UNKNOWN");
  });

  it("같은 family에 매칭된 증거들의 representationType이 서로 모순 그룹(equation vs graph)에 걸치면 MATHEMATICAL_CONSISTENCY 게이트가 FAIL하고 REJECTED로 판정된다", () => {
    const result = computeFamilyCalibration(FAMILY, [GOLD_DIRECT_ITEM, GOLD_GRAPH_ITEM], BASE_OPTIONS);

    expect(result.evidence.length).toBeGreaterThanOrEqual(2);
    expect(result.hasConflictingRepresentationTypes).toBe(true);
    expect(result.approval.gates.MATHEMATICAL_CONSISTENCY.verdict).toBe("FAIL");
    expect(result.approval.status).toBe("REJECTED");
  });

  it("매칭된 증거가 전부 같은 representationType이면(또는 하나뿐이면) MATHEMATICAL_CONSISTENCY 게이트는 계속 PASS한다", () => {
    const result = computeFamilyCalibration(FAMILY, [GOLD_DIRECT_ITEM], BASE_OPTIONS);

    expect(result.hasConflictingRepresentationTypes).toBe(false);
    expect(result.approval.gates.MATHEMATICAL_CONSISTENCY.verdict).toBe("PASS");
  });
});

describe("detectConflictingRepresentationTypes", () => {
  it("모두 같은 그룹(symbolic)이면 모순이 아니다", () => {
    expect(detectConflictingRepresentationTypes(["equation", "expression", "inequality"])).toBe(false);
  });

  it("graph와 equation처럼 서로 다른 그룹이 섞이면 모순이다", () => {
    expect(detectConflictingRepresentationTypes(["equation", "graph"])).toBe(true);
  });

  it("word_situation과 graph도 서로 다른 그룹이라 모순이다", () => {
    expect(detectConflictingRepresentationTypes(["word_situation", "graph"])).toBe(true);
  });

  it("function_relation/mixed는 중립이라 다른 그룹과 섞여도 모순으로 치지 않는다", () => {
    expect(detectConflictingRepresentationTypes(["equation", "function_relation", "mixed"])).toBe(false);
  });

  it("null이나 빈 배열은 모순이 아니다", () => {
    expect(detectConflictingRepresentationTypes([])).toBe(false);
    expect(detectConflictingRepresentationTypes([null, null])).toBe(false);
  });
});

describe("computeCoverageMetrics", () => {
  it("모든 Gold 문항이 매칭되면 Gold Family Coverage가 100%다", () => {
    const calibration = computeFamilyCalibration(FAMILY, [GOLD_DIRECT_ITEM], BASE_OPTIONS);
    const coverage = computeCoverageMetrics([FAMILY], [calibration], [GOLD_DIRECT_ITEM]);

    expect(coverage.goldFamilyCoveragePercent).toBe(100);
    expect(coverage.familyGapCount).toBe(0);
  });

  it("매칭되지 않은 Gold 문항은 Family Gap Count에 집계된다", () => {
    const calibration = computeFamilyCalibration(FAMILY, [GOLD_DIRECT_ITEM, UNRELATED_GOLD_ITEM], BASE_OPTIONS);
    const coverage = computeCoverageMetrics([FAMILY], [calibration], [GOLD_DIRECT_ITEM, UNRELATED_GOLD_ITEM]);

    expect(coverage.familyGapCount).toBe(1);
    expect(coverage.goldFamilyCoveragePercent).toBe(50);
  });

  it("증거가 전혀 없는 family는 Unsupported Family Rate에 집계된다", () => {
    const calibration = computeFamilyCalibration(FAMILY, [UNRELATED_GOLD_ITEM], BASE_OPTIONS);
    const coverage = computeCoverageMetrics([FAMILY], [calibration], [UNRELATED_GOLD_ITEM]);

    expect(coverage.unsupportedFamilyRatePercent).toBe(100);
  });
});

describe("buildMergeProposalInputs / buildSplitProposalInputs", () => {
  it("DIRECT 매치 레코드만 merge 후보 입력으로 만든다", () => {
    const calibration = computeFamilyCalibration(FAMILY, [GOLD_DIRECT_ITEM], BASE_OPTIONS);
    const records = buildMergeProposalInputs([FAMILY], [calibration]);

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ familyCode: "FAM-ALG-EXPLOG-001", examItemId: "gold-item-1" });
  });

  it("split 후보 입력은 evidence의 커리큘럼 노드/케이스분류 정보를 담는다", () => {
    const calibration = computeFamilyCalibration(FAMILY, [GOLD_DIRECT_ITEM], BASE_OPTIONS);
    const examItemsById = new Map([[GOLD_DIRECT_ITEM.examItemId, GOLD_DIRECT_ITEM]]);
    const records = buildSplitProposalInputs([FAMILY], [calibration], examItemsById);

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ familyCode: "FAM-ALG-EXPLOG-001", curriculumNodeCodes: ["ALG_EXP_LOG_EXP"] });
  });
});
