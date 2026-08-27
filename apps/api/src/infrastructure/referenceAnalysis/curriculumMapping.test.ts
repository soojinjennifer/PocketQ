import { describe, expect, it } from "vitest";
import type { CurriculumNodeInput } from "../curriculum/curriculumSourceSchema";
import { buildCurriculumNodeIndex, classifyCurriculumMapping } from "./curriculumMapping";

function buildNode(overrides: Partial<CurriculumNodeInput> & Pick<CurriculumNodeInput, "code" | "nodeType">): CurriculumNodeInput {
  return {
    parentCode: null,
    subject: "ALG",
    name: `이름-${overrides.code}`,
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

describe("buildCurriculumNodeIndex + classifyCurriculumMapping", () => {
  const nodesByCode = buildCurriculumNodeIndex({
    subject: "ALG",
    curriculumVersion: "2022",
    sourceId: null,
    nodes: [
      buildNode({ code: "ALG", nodeType: "SUBJECT" }),
      buildNode({ code: "ALG_UNIT", nodeType: "UNIT", parentCode: "ALG" }),
      buildNode({ code: "ALG_UNIT_SUB", nodeType: "SUBUNIT", parentCode: "ALG_UNIT" }),
      buildNode({ code: "ALG_UNIT_SUB_CONCEPT", nodeType: "CONCEPT", parentCode: "ALG_UNIT_SUB" }),
      buildNode({ code: "ALG_UNIT_SUB_SKILL", nodeType: "SKILL", parentCode: "ALG_UNIT_SUB_CONCEPT" }),
    ],
    prerequisites: [],
  });

  it("후보가 없으면 OUT_OF_SCOPE다", () => {
    expect(classifyCurriculumMapping([], nodesByCode).classification).toBe("OUT_OF_SCOPE");
  });

  it("존재하지 않는 코드만 있으면 OUT_OF_SCOPE(커리큘럼 갭 후보)다", () => {
    const result = classifyCurriculumMapping(["ALG_NOT_EXIST"], nodesByCode);
    expect(result.classification).toBe("OUT_OF_SCOPE");
    expect(result.unresolvedNodeCodes).toEqual(["ALG_NOT_EXIST"]);
  });

  it("CONCEPT/SKILL 노드 하나에 매핑되면 EXACT다", () => {
    expect(classifyCurriculumMapping(["ALG_UNIT_SUB_CONCEPT"], nodesByCode).classification).toBe("EXACT");
    expect(classifyCurriculumMapping(["ALG_UNIT_SUB_SKILL"], nodesByCode).classification).toBe("EXACT");
  });

  it("SUBUNIT처럼 거친 노드 하나에만 매핑되면 UNCERTAIN이다", () => {
    const result = classifyCurriculumMapping(["ALG_UNIT_SUB"], nodesByCode);
    expect(result.classification).toBe("UNCERTAIN");
    expect(result.resolvedNodeCodes).toEqual(["ALG_UNIT_SUB"]);
  });

  it("실존 코드가 2개 이상이면 MULTI_NODE다", () => {
    const result = classifyCurriculumMapping(["ALG_UNIT_SUB_CONCEPT", "ALG_UNIT_SUB_SKILL"], nodesByCode);
    expect(result.classification).toBe("MULTI_NODE");
  });

  it("일부만 존재하면 존재하는 코드 기준으로 분류하고 나머지는 unresolvedNodeCodes에 남긴다", () => {
    const result = classifyCurriculumMapping(["ALG_UNIT_SUB_CONCEPT", "ALG_GHOST"], nodesByCode);
    expect(result.classification).toBe("EXACT");
    expect(result.resolvedNodeCodes).toEqual(["ALG_UNIT_SUB_CONCEPT"]);
    expect(result.unresolvedNodeCodes).toEqual(["ALG_GHOST"]);
  });
});
