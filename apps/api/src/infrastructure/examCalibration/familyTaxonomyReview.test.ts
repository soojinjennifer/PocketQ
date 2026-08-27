import { describe, expect, it } from "vitest";
import {
  detectMergeProposals,
  detectSplitProposals,
  type FamilyDirectMatchRecord,
  type FamilyInternalEvidenceRecord,
} from "./familyTaxonomyReview";

describe("detectMergeProposals", () => {
  it("같은 Gold 항목에 DIRECT 매치된 두 family의 스킬이 충분히 겹치면 MergeProposal을 만든다", () => {
    const records: FamilyDirectMatchRecord[] = [
      { familyCode: "FAM-A", examItemId: "exam-item-1", requiredSkills: ["skill_a", "skill_b"] },
      { familyCode: "FAM-B", examItemId: "exam-item-1", requiredSkills: ["skill_a", "skill_b", "skill_c"] },
    ];

    const proposals = detectMergeProposals(records);

    expect(proposals).toHaveLength(1);
    expect(proposals[0]).toMatchObject({ familyCodeA: "FAM-A", familyCodeB: "FAM-B", sharedExamItemIds: ["exam-item-1"] });
    expect(proposals[0]!.skillOverlap).toBeCloseTo(2 / 3, 5);
  });

  it("스킬이 거의 겹치지 않으면 MergeProposal을 만들지 않는다", () => {
    const records: FamilyDirectMatchRecord[] = [
      { familyCode: "FAM-A", examItemId: "exam-item-1", requiredSkills: ["skill_a"] },
      { familyCode: "FAM-B", examItemId: "exam-item-1", requiredSkills: ["skill_z"] },
    ];

    expect(detectMergeProposals(records)).toEqual([]);
  });

  it("같은 Gold 항목에 매치된 family가 하나뿐이면 제안하지 않는다", () => {
    const records: FamilyDirectMatchRecord[] = [
      { familyCode: "FAM-A", examItemId: "exam-item-1", requiredSkills: ["skill_a"] },
    ];

    expect(detectMergeProposals(records)).toEqual([]);
  });

  it("어떤 problem_family_candidates 행도 수정하지 않는다(순수 리포트 데이터만 반환)", () => {
    const records: FamilyDirectMatchRecord[] = [
      { familyCode: "FAM-A", examItemId: "exam-item-1", requiredSkills: ["skill_a", "skill_b"] },
      { familyCode: "FAM-B", examItemId: "exam-item-1", requiredSkills: ["skill_a", "skill_b"] },
    ];

    const proposals = detectMergeProposals(records);
    expect(proposals[0]).not.toHaveProperty("applied");
    expect(records).toHaveLength(2);
  });
});

describe("detectSplitProposals", () => {
  it("family 내부 evidence가 커리큘럼 노드로 뚜렷이 갈리면 SplitProposal을 만든다", () => {
    const records: FamilyInternalEvidenceRecord[] = [
      { familyCode: "FAM-A", examItemId: "item-1", curriculumNodeCodes: ["ALG_EXP_LOG_EXP"], caseSplitRequired: false },
      { familyCode: "FAM-A", examItemId: "item-2", curriculumNodeCodes: ["ALG_EXP_LOG_EXP"], caseSplitRequired: false },
      { familyCode: "FAM-A", examItemId: "item-3", curriculumNodeCodes: ["ALG_EXP_LOG_LOG"], caseSplitRequired: false },
      { familyCode: "FAM-A", examItemId: "item-4", curriculumNodeCodes: ["ALG_EXP_LOG_LOG"], caseSplitRequired: false },
    ];

    const proposals = detectSplitProposals(records);

    expect(proposals).toHaveLength(1);
    expect(proposals[0]!.familyCode).toBe("FAM-A");
    expect(proposals[0]!.groups).toHaveLength(2);
  });

  it("그룹 중 하나라도 최소 크기 미만이면 제안하지 않는다(우연한 소수 사례 방지)", () => {
    const records: FamilyInternalEvidenceRecord[] = [
      { familyCode: "FAM-A", examItemId: "item-1", curriculumNodeCodes: ["ALG_EXP_LOG_EXP"], caseSplitRequired: false },
      { familyCode: "FAM-A", examItemId: "item-2", curriculumNodeCodes: ["ALG_EXP_LOG_EXP"], caseSplitRequired: false },
      { familyCode: "FAM-A", examItemId: "item-3", curriculumNodeCodes: ["ALG_EXP_LOG_LOG"], caseSplitRequired: false },
    ];

    expect(detectSplitProposals(records)).toEqual([]);
  });

  it("모든 evidence가 같은 그룹이면 제안하지 않는다", () => {
    const records: FamilyInternalEvidenceRecord[] = [
      { familyCode: "FAM-A", examItemId: "item-1", curriculumNodeCodes: ["ALG_EXP_LOG_EXP"], caseSplitRequired: false },
      { familyCode: "FAM-A", examItemId: "item-2", curriculumNodeCodes: ["ALG_EXP_LOG_EXP"], caseSplitRequired: false },
    ];

    expect(detectSplitProposals(records)).toEqual([]);
  });
});
