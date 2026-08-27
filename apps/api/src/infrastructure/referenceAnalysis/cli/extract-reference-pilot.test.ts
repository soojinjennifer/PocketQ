import { describe, expect, it } from "vitest";
import type { CurriculumMappingResult } from "../curriculumMapping";
import { groupItemsIntoFamilies, type FamilyGroupingItemInput } from "../familyGrouping";
import { selectInScopeItems } from "./extract-reference-pilot";

/**
 * Stage 2 회귀 테스트: `extract-reference-pilot.ts`가 OUT_OF_SCOPE로 분류된 아이템을
 * family candidate 생성에서 반드시 제외하는지 검증한다. 합성 fixture만 사용한다
 * (MathJK 원문 미사용).
 */
function buildClassification(
  classification: CurriculumMappingResult["classification"],
): CurriculumMappingResult {
  return {
    classification,
    resolvedNodeCodes: classification === "OUT_OF_SCOPE" ? [] : ["FIXTURE_NODE"],
    unresolvedNodeCodes: [],
    reason: `fixture-${classification}`,
  };
}

describe("selectInScopeItems", () => {
  it("OUT_OF_SCOPE로 분류된 아이템을 제외하고 나머지는 순서를 보존한다", () => {
    const items = ["item-a", "item-b", "item-c", "item-d"];
    const classifications = [
      buildClassification("EXACT"),
      buildClassification("OUT_OF_SCOPE"),
      buildClassification("MULTI_NODE"),
      buildClassification("UNCERTAIN"),
    ];

    expect(selectInScopeItems(items, classifications)).toEqual(["item-a", "item-c", "item-d"]);
  });

  it("모든 아이템이 OUT_OF_SCOPE면 빈 배열을 돌려준다", () => {
    const items = ["item-a", "item-b"];
    const classifications = [buildClassification("OUT_OF_SCOPE"), buildClassification("OUT_OF_SCOPE")];

    expect(selectInScopeItems(items, classifications)).toEqual([]);
  });

  it("입력 배열을 변형하지 않는다", () => {
    const items = ["item-a", "item-b"];
    const classifications = [buildClassification("OUT_OF_SCOPE"), buildClassification("EXACT")];

    selectInScopeItems(items, classifications);

    expect(items).toEqual(["item-a", "item-b"]);
  });

  it("회귀 방지: OUT_OF_SCOPE 아이템은 필터링 후 groupItemsIntoFamilies에 절대 전달되지 않는다", () => {
    const rawItems: FamilyGroupingItemInput[] = [
      {
        localItemKey: "doc#p1-1",
        primaryConcept: "지수함수",
        reasoningPattern: "직접계산",
        representationType: "TEXT",
        requiredSkills: ["skill-a"],
        conditionCount: 1,
      },
      {
        // 커리큘럼 노드 매핑이 전혀 없어 OUT_OF_SCOPE로 분류된 합성 아이템.
        localItemKey: "doc#p1-2-out-of-scope",
        primaryConcept: "지수함수",
        reasoningPattern: "직접계산",
        representationType: "TEXT",
        requiredSkills: ["skill-a"],
        conditionCount: 1,
      },
      {
        localItemKey: "doc#p2-1",
        primaryConcept: "로그함수",
        reasoningPattern: "역함수변형",
        representationType: "GRAPH",
        requiredSkills: ["skill-b"],
        conditionCount: 2,
      },
    ];
    const classifications = [
      buildClassification("EXACT"),
      buildClassification("OUT_OF_SCOPE"),
      buildClassification("MULTI_NODE"),
    ];

    const inScopeItems = selectInScopeItems(rawItems, classifications);
    const families = groupItemsIntoFamilies(inScopeItems);

    const allFamilyMemberKeys = families.flatMap((family) => family.items.map((item) => item.localItemKey));
    expect(allFamilyMemberKeys).not.toContain("doc#p1-2-out-of-scope");
    expect(allFamilyMemberKeys).toEqual(["doc#p1-1", "doc#p2-1"]);
  });
});
