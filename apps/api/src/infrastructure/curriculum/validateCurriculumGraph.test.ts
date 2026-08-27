import { describe, expect, it } from "vitest";
import type { CurriculumNodeInput, CurriculumPrerequisiteInput } from "./curriculumSourceSchema";
import { validateCurriculumGraph } from "./validateCurriculumGraph";

/** 테스트마다 반복되는 필드를 채운 노드 팩토리. 필요한 필드만 override한다. */
function node(
  overrides: Pick<CurriculumNodeInput, "code" | "nodeType" | "parentCode"> &
    Partial<CurriculumNodeInput>,
): CurriculumNodeInput {
  return {
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

/** SUBJECT > UNIT > SUBUNIT > CONCEPT 4단계로 이어지는 정상 그래프. */
function buildValidNodes(): CurriculumNodeInput[] {
  return [
    node({ code: "ALG", nodeType: "SUBJECT", parentCode: null }),
    node({ code: "ALG_UNIT", nodeType: "UNIT", parentCode: "ALG" }),
    node({ code: "ALG_SUBUNIT", nodeType: "SUBUNIT", parentCode: "ALG_UNIT" }),
    node({ code: "ALG_CONCEPT", nodeType: "CONCEPT", parentCode: "ALG_SUBUNIT" }),
  ];
}

function prerequisite(overrides: Partial<CurriculumPrerequisiteInput> = {}): CurriculumPrerequisiteInput {
  return {
    nodeCode: "ALG_UNIT",
    prerequisiteNodeCode: "ALG_SUBUNIT",
    strength: "required",
    notes: null,
    ...overrides,
  };
}

describe("validateCurriculumGraph", () => {
  it("정상 그래프는 에러 없이 PASS한다", () => {
    const result = validateCurriculumGraph({
      subject: "ALG",
      nodes: buildValidNodes(),
      prerequisites: [],
    });

    expect(result.errors).toEqual([]);
  });

  it("중복 code를 에러로 잡는다", () => {
    const nodes = buildValidNodes();
    nodes.push(node({ code: "ALG_UNIT", nodeType: "UNIT", parentCode: "ALG" }));

    const result = validateCurriculumGraph({ subject: "ALG", nodes, prerequisites: [] });

    expect(result.errors.some((message) => message.includes("중복 code"))).toBe(true);
  });

  it("존재하지 않는 parentCode를 부모 누락 에러로 잡는다", () => {
    const nodes = [
      node({ code: "ALG", nodeType: "SUBJECT", parentCode: null }),
      node({ code: "ALG_UNIT", nodeType: "UNIT", parentCode: "NOT_EXISTS" }),
    ];

    const result = validateCurriculumGraph({ subject: "ALG", nodes, prerequisites: [] });

    expect(result.errors.some((message) => message.includes("부모 누락"))).toBe(true);
  });

  it("SUBJECT가 아닌데 parentCode가 없으면 부모 누락 에러로 잡는다", () => {
    const nodes = [
      node({ code: "ALG", nodeType: "SUBJECT", parentCode: null }),
      node({ code: "ALG_UNIT", nodeType: "UNIT", parentCode: null }),
    ];

    const result = validateCurriculumGraph({ subject: "ALG", nodes, prerequisites: [] });

    expect(result.errors.some((message) => message.includes("부모 누락"))).toBe(true);
  });

  it("서로를 부모로 참조해 루트에서 도달 불가능한 orphan 노드를 잡는다", () => {
    const nodes = [
      node({ code: "ALG", nodeType: "SUBJECT", parentCode: null }),
      node({ code: "ALG_UNIT", nodeType: "UNIT", parentCode: "ALG" }),
      node({ code: "ISLAND_A", nodeType: "UNIT", parentCode: "ISLAND_B" }),
      node({ code: "ISLAND_B", nodeType: "UNIT", parentCode: "ISLAND_A" }),
    ];

    const result = validateCurriculumGraph({ subject: "ALG", nodes, prerequisites: [] });

    expect(result.errors.some((message) => message.includes("orphan 노드"))).toBe(true);
  });

  it("단계를 건너뛴 부모(계층 순서 위반)를 잡는다", () => {
    const nodes = [
      node({ code: "ALG", nodeType: "SUBJECT", parentCode: null }),
      node({ code: "ALG_UNIT", nodeType: "UNIT", parentCode: "ALG" }),
      // SUBUNIT을 건너뛰고 UNIT 바로 아래 CONCEPT을 둠
      node({ code: "ALG_CONCEPT", nodeType: "CONCEPT", parentCode: "ALG_UNIT" }),
    ];

    const result = validateCurriculumGraph({ subject: "ALG", nodes, prerequisites: [] });

    expect(result.errors.some((message) => message.includes("계층 순서 위반"))).toBe(true);
  });

  it("과목 경계가 다른 부모-자식을 잡는다", () => {
    const nodes = [
      node({ code: "ALG", nodeType: "SUBJECT", parentCode: null }),
      node({ code: "ALG_UNIT", nodeType: "UNIT", parentCode: "ALG", subject: "CALC1" }),
    ];

    const result = validateCurriculumGraph({ subject: "ALG", nodes, prerequisites: [] });

    expect(result.errors.some((message) => message.includes("과목 경계 불일치"))).toBe(true);
  });

  it("csatImportance/difficultyBase가 1~5 범위를 벗어나면 잡는다", () => {
    const nodes = buildValidNodes();
    const target = nodes[3];
    if (!target) throw new Error("test setup error");
    target.csatImportance = 9;
    target.difficultyBase = 0;

    const result = validateCurriculumGraph({ subject: "ALG", nodes, prerequisites: [] });

    expect(result.errors.filter((message) => message.includes("범위 밖 값"))).toHaveLength(2);
  });

  it("필수 필드(name)가 비어있으면 잡는다", () => {
    const nodes = buildValidNodes();
    const target = nodes[3];
    if (!target) throw new Error("test setup error");
    target.name = "";

    const result = validateCurriculumGraph({ subject: "ALG", nodes, prerequisites: [] });

    expect(result.errors.some((message) => message.includes("필수 필드 누락"))).toBe(true);
  });

  it("선수관계 자기참조를 잡는다", () => {
    const nodes = buildValidNodes();
    const prerequisites = [prerequisite({ nodeCode: "ALG_UNIT", prerequisiteNodeCode: "ALG_UNIT" })];

    const result = validateCurriculumGraph({ subject: "ALG", nodes, prerequisites });

    expect(result.errors.some((message) => message.includes("자기참조 선수관계"))).toBe(true);
  });

  it("중복 선수관계 쌍을 잡는다", () => {
    const nodes = buildValidNodes();
    const prerequisites = [prerequisite(), prerequisite()];

    const result = validateCurriculumGraph({ subject: "ALG", nodes, prerequisites });

    expect(result.errors.some((message) => message.includes("중복 선수관계"))).toBe(true);
  });

  it("정의되지 않은 노드를 참조하는 선수관계를 잡는다", () => {
    const nodes = buildValidNodes();
    const prerequisites = [prerequisite({ prerequisiteNodeCode: "NOT_EXISTS" })];

    const result = validateCurriculumGraph({ subject: "ALG", nodes, prerequisites });

    expect(result.errors.some((message) => message.includes("정의되지 않은 노드 참조"))).toBe(true);
  });

  it("3노드 순환 선수관계(A→B→C→A)를 DFS로 잡는다", () => {
    const nodes = [
      node({ code: "ALG", nodeType: "SUBJECT", parentCode: null }),
      node({ code: "ALG_A", nodeType: "UNIT", parentCode: "ALG" }),
      node({ code: "ALG_B", nodeType: "UNIT", parentCode: "ALG" }),
      node({ code: "ALG_C", nodeType: "UNIT", parentCode: "ALG" }),
    ];
    const prerequisites = [
      prerequisite({ nodeCode: "ALG_A", prerequisiteNodeCode: "ALG_B" }),
      prerequisite({ nodeCode: "ALG_B", prerequisiteNodeCode: "ALG_C" }),
      prerequisite({ nodeCode: "ALG_C", prerequisiteNodeCode: "ALG_A" }),
    ];

    const result = validateCurriculumGraph({ subject: "ALG", nodes, prerequisites });

    expect(result.errors.some((message) => message.includes("순환 선수관계"))).toBe(true);
  });
});
