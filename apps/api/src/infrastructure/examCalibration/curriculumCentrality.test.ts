import { describe, expect, it } from "vitest";
import { computeCurriculumCentrality } from "./curriculumCentrality";
import type { CurriculumNodeInput, CurriculumPrerequisiteInput } from "../curriculum/curriculumSourceSchema";

function makeNode(overrides: Partial<CurriculumNodeInput> & { code: string }): CurriculumNodeInput {
  return {
    nodeType: "CONCEPT",
    parentCode: null,
    subject: "ALG",
    name: overrides.code,
    description: null,
    curriculumVersion: "2022",
    csatImportance: null,
    difficultyBase: null,
    allowedScope: null,
    forbiddenScope: null,
    isActive: true,
    ...overrides,
  };
}

describe("computeCurriculumCentrality", () => {
  it("csatImportance가 있는 노드가 하나라도 있으면 그 최댓값/5를 CSAT_IMPORTANCE로 돌려준다", () => {
    const nodesByCode = new Map<string, CurriculumNodeInput>([
      ["A", makeNode({ code: "A", csatImportance: 3 })],
      ["B", makeNode({ code: "B", csatImportance: 5 })],
    ]);

    const result = computeCurriculumCentrality(["A", "B"], nodesByCode, []);

    expect(result).toEqual({ value: 1, source: "CSAT_IMPORTANCE" });
  });

  it("csatImportance가 전혀 없으면 curriculum_prerequisites 그래프 degree를 전체 최대 degree로 정규화한다", () => {
    const nodesByCode = new Map<string, CurriculumNodeInput>([
      ["A", makeNode({ code: "A" })],
      ["B", makeNode({ code: "B" })],
      ["C", makeNode({ code: "C" })],
    ]);
    const prerequisites: CurriculumPrerequisiteInput[] = [
      { nodeCode: "A", prerequisiteNodeCode: "B", strength: "required", notes: null },
      { nodeCode: "A", prerequisiteNodeCode: "C", strength: "required", notes: null },
      { nodeCode: "B", prerequisiteNodeCode: "C", strength: "optional", notes: null },
    ];
    // degree(A)=2(두 관계에 nodeCode로 등장), degree(B)=2(한 번 nodeCode, 한 번 prerequisiteNodeCode),
    // degree(C)=2(두 관계에 prerequisiteNodeCode로 등장) → 전체 최대 degree=2.
    const result = computeCurriculumCentrality(["A"], nodesByCode, prerequisites);

    expect(result).toEqual({ value: 1, source: "PREREQUISITE_DEGREE" });
  });

  it("degree가 최대치보다 낮은 노드는 그 비율만큼만 반영된다", () => {
    const nodesByCode = new Map<string, CurriculumNodeInput>([
      ["A", makeNode({ code: "A" })],
      ["B", makeNode({ code: "B" })],
      ["C", makeNode({ code: "C" })],
      ["D", makeNode({ code: "D" })],
    ]);
    const prerequisites: CurriculumPrerequisiteInput[] = [
      { nodeCode: "A", prerequisiteNodeCode: "B", strength: "required", notes: null },
      { nodeCode: "A", prerequisiteNodeCode: "C", strength: "required", notes: null },
      { nodeCode: "A", prerequisiteNodeCode: "D", strength: "required", notes: null },
    ];
    // degree(A)=3(전체 최대), degree(B)=1.
    const result = computeCurriculumCentrality(["B"], nodesByCode, prerequisites);

    expect(result).toEqual({ value: 1 / 3, source: "PREREQUISITE_DEGREE" });
  });

  it("csatImportance도 없고 선수관계 그래프도 비어있으면(전체 최대 degree=0) 중립값 0.5를 NEUTRAL_FALLBACK으로 돌려준다", () => {
    const nodesByCode = new Map<string, CurriculumNodeInput>([["A", makeNode({ code: "A" })]]);

    const result = computeCurriculumCentrality(["A"], nodesByCode, []);

    expect(result).toEqual({ value: 0.5, source: "NEUTRAL_FALLBACK" });
  });

  it("nodeCodes가 nodesByCode/prerequisites 어디에도 없어도 안전하게 NEUTRAL_FALLBACK을 돌려준다", () => {
    const result = computeCurriculumCentrality(["UNKNOWN_CODE"], new Map(), []);

    expect(result).toEqual({ value: 0.5, source: "NEUTRAL_FALLBACK" });
  });
});
