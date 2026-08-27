import { describe, expect, it } from "vitest";
import { buildFamilySignature, type FamilyGroupingItemInput, groupItemsIntoFamilies } from "./familyGrouping";

function buildItem(overrides: Partial<FamilyGroupingItemInput> & Pick<FamilyGroupingItemInput, "localItemKey">): FamilyGroupingItemInput {
  return {
    primaryConcept: "합성 개념 A",
    reasoningPattern: "case_split_then_sum",
    representationType: "equation",
    requiredSkills: ["skill-a", "skill-b"],
    conditionCount: 2,
    ...overrides,
  };
}

describe("buildFamilySignature", () => {
  it("required_skills 순서와 무관하게 동일한 서명을 만든다", () => {
    const a = buildItem({ localItemKey: "k1", requiredSkills: ["skill-b", "skill-a"] });
    const b = buildItem({ localItemKey: "k2", requiredSkills: ["skill-a", "skill-b"] });

    expect(buildFamilySignature(a)).toBe(buildFamilySignature(b));
  });

  it("conditionCount는 구간(bucket)으로 뭉뚱그려 사소한 차이로 서명이 갈리지 않게 한다", () => {
    const a = buildItem({ localItemKey: "k1", conditionCount: 2 });
    const b = buildItem({ localItemKey: "k2", conditionCount: 3 });

    expect(buildFamilySignature(a)).toBe(buildFamilySignature(b));
  });

  it("reasoningPattern이 다르면 서명이 달라진다(표면 유사성만으로 묶지 않음)", () => {
    const a = buildItem({ localItemKey: "k1", reasoningPattern: "case_split_then_sum" });
    const b = buildItem({ localItemKey: "k2", reasoningPattern: "direct_substitution" });

    expect(buildFamilySignature(a)).not.toBe(buildFamilySignature(b));
  });
});

describe("groupItemsIntoFamilies", () => {
  it("같은 family_signature를 가진 문항들을 하나의 그룹으로 묶는다", () => {
    const items = [
      buildItem({ localItemKey: "k1" }),
      buildItem({ localItemKey: "k2" }),
      buildItem({ localItemKey: "k3", reasoningPattern: "direct_substitution" }),
    ];

    const groups = groupItemsIntoFamilies(items);

    expect(groups).toHaveLength(2);
    expect(groups[0]!.items.map((i) => i.localItemKey)).toEqual(["k1", "k2"]);
    expect(groups[1]!.items.map((i) => i.localItemKey)).toEqual(["k3"]);
  });

  it("빈 배열은 빈 그룹 목록을 반환한다", () => {
    expect(groupItemsIntoFamilies([])).toEqual([]);
  });
});
