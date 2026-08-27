import { describe, expect, it } from "vitest";
import { evaluateFamilyApproval, type FamilyApprovalInput } from "./familyApprovalWorkflow";

const APPROVABLE: FamilyApprovalInput = {
  curriculumNodesValid: true,
  hasConflictingRepresentationTypes: false,
  duplicateOfAnotherFamilyCode: null,
  goldEvidenceCount: 2,
  goldMeaningfulEvidenceCount: 2,
  silverEvidenceCount: 0,
  stage2Confidence: 0.8,
  stage2SourceItemCount: 3,
  csatRelevanceLevel: "HIGH",
  reasoningSignature: "symmetric_substitution_exponent_equation",
  difficultyMin: "D2",
  difficultyMax: "D3",
};

describe("evaluateFamilyApproval", () => {
  it("7개 게이트를 모두 통과하면 APPROVED다", () => {
    const result = evaluateFamilyApproval(APPROVABLE);
    expect(result.status).toBe("APPROVED");
    for (const gate of Object.values(result.gates)) {
      expect(gate.verdict).toBe("PASS");
    }
  });

  it("SILVER 증거가 0건이어도 GOLD DIRECT/PARTIAL 증거(goldMeaningfulEvidenceCount>=1) 단독으로 APPROVED에 도달할 수 있다", () => {
    const input: FamilyApprovalInput = {
      ...APPROVABLE,
      silverEvidenceCount: 0,
      goldEvidenceCount: 1,
      goldMeaningfulEvidenceCount: 1,
    };
    const result = evaluateFamilyApproval(input);
    expect(result.status).toBe("APPROVED");
    expect(result.gates.MEANINGFUL_EVIDENCE.verdict).toBe("PASS");
  });

  it("GOLD 증거가 없어도 Stage 2 confidence/source_item_count가 충분하면 의미있는 증거 게이트를 통과한다", () => {
    const input: FamilyApprovalInput = {
      ...APPROVABLE,
      goldEvidenceCount: 0,
      goldMeaningfulEvidenceCount: 0,
      stage2Confidence: 0.9,
      stage2SourceItemCount: 4,
    };
    const result = evaluateFamilyApproval(input);
    expect(result.gates.MEANINGFUL_EVIDENCE.verdict).toBe("PASS");
    expect(result.status).toBe("APPROVED");
  });

  it("WEAK 매치 1건뿐이고 Stage 2 폴백 조건도 약하면 의미있는 증거 게이트가 PASS가 아니다(회귀)", () => {
    const input: FamilyApprovalInput = {
      ...APPROVABLE,
      goldEvidenceCount: 1,
      goldMeaningfulEvidenceCount: 0,
      stage2Confidence: 0.1,
      stage2SourceItemCount: 1,
    };
    const result = evaluateFamilyApproval(input);
    expect(result.gates.MEANINGFUL_EVIDENCE.verdict).not.toBe("PASS");
    expect(["FAIL", "UNCERTAIN"]).toContain(result.gates.MEANINGFUL_EVIDENCE.verdict);
    expect(result.status).not.toBe("APPROVED");
  });

  it("커리큘럼 노드가 유효하지 않으면 REJECTED다(하나라도 FAIL이면 REJECTED)", () => {
    const input: FamilyApprovalInput = { ...APPROVABLE, curriculumNodesValid: false };
    const result = evaluateFamilyApproval(input);
    expect(result.status).toBe("REJECTED");
    expect(result.gates.CURRICULUM_VALID.verdict).toBe("FAIL");
  });

  it("다른 family와 중복이면 REJECTED다", () => {
    const input: FamilyApprovalInput = { ...APPROVABLE, duplicateOfAnotherFamilyCode: "FAM-ALG-EXPLOG-002" };
    const result = evaluateFamilyApproval(input);
    expect(result.status).toBe("REJECTED");
  });

  it("CSAT 관련도가 REJECT면 REJECTED다", () => {
    const input: FamilyApprovalInput = { ...APPROVABLE, csatRelevanceLevel: "REJECT" };
    const result = evaluateFamilyApproval(input);
    expect(result.status).toBe("REJECTED");
  });

  it("FAIL 없이 UNCERTAIN이 하나라도 있으면 REVIEW_REQUIRED다", () => {
    const input: FamilyApprovalInput = { ...APPROVABLE, csatRelevanceLevel: "LOW" };
    const result = evaluateFamilyApproval(input);
    expect(result.gates.CSAT_USEFULNESS.verdict).toBe("UNCERTAIN");
    expect(result.status).toBe("REVIEW_REQUIRED");
  });

  it("증거도 부족하고 GOLD도 없으면 의미있는 증거 게이트가 FAIL 또는 UNCERTAIN이다", () => {
    const input: FamilyApprovalInput = {
      ...APPROVABLE,
      goldEvidenceCount: 0,
      goldMeaningfulEvidenceCount: 0,
      stage2Confidence: 0.1,
      stage2SourceItemCount: 1,
    };
    const result = evaluateFamilyApproval(input);
    expect(["FAIL", "UNCERTAIN"]).toContain(result.gates.MEANINGFUL_EVIDENCE.verdict);
    expect(result.status).not.toBe("APPROVED");
  });

  it("난이도 범위가 둘 다 UNKNOWN이면 REJECTED다", () => {
    const input: FamilyApprovalInput = { ...APPROVABLE, difficultyMin: "UNKNOWN", difficultyMax: "UNKNOWN" };
    const result = evaluateFamilyApproval(input);
    expect(result.gates.VALID_DIFFICULTY_RANGE.verdict).toBe("FAIL");
    expect(result.status).toBe("REJECTED");
  });

  it("같은 입력엔 항상 같은 결과를 돌려준다(순수 함수)", () => {
    expect(evaluateFamilyApproval(APPROVABLE)).toEqual(evaluateFamilyApproval(APPROVABLE));
  });
});
