import { describe, expect, it } from "vitest";
import {
  isIncompatibleWithCurrentCurriculum,
  selectCompatibleExamItems,
  type HistoricalCompatibilityGuardInput,
} from "./historicalCompatibilityGuard";

describe("selectCompatibleExamItems", () => {
  it("INCOMPATIBLE 항목만 제외하고 나머지는 순서를 보존한다", () => {
    const items: Array<HistoricalCompatibilityGuardInput & { key: string }> = [
      { key: "a", curriculumCompatibility: "DIRECT_COMPATIBLE" },
      { key: "b", curriculumCompatibility: "INCOMPATIBLE" },
      { key: "c", curriculumCompatibility: "PARTIAL_COMPATIBLE" },
      { key: "d", curriculumCompatibility: "UNCERTAIN" },
    ];

    expect(selectCompatibleExamItems(items).map((item) => item.key)).toEqual(["a", "c", "d"]);
  });

  it("curriculumCompatibility가 null인 항목(OUT_OF_CURRENT_SCOPE 등)은 통과시킨다", () => {
    const items: Array<HistoricalCompatibilityGuardInput & { key: string }> = [
      { key: "a", curriculumCompatibility: null },
      { key: "b", curriculumCompatibility: "INCOMPATIBLE" },
    ];

    expect(selectCompatibleExamItems(items).map((item) => item.key)).toEqual(["a"]);
  });

  it("입력 배열을 변형하지 않는다", () => {
    const items: HistoricalCompatibilityGuardInput[] = [{ curriculumCompatibility: "INCOMPATIBLE" }];
    selectCompatibleExamItems(items);
    expect(items).toEqual([{ curriculumCompatibility: "INCOMPATIBLE" }]);
  });

  it("모두 INCOMPATIBLE이면 빈 배열을 돌려준다", () => {
    const items: HistoricalCompatibilityGuardInput[] = [
      { curriculumCompatibility: "INCOMPATIBLE" },
      { curriculumCompatibility: "INCOMPATIBLE" },
    ];
    expect(selectCompatibleExamItems(items)).toEqual([]);
  });
});

describe("isIncompatibleWithCurrentCurriculum", () => {
  it("INCOMPATIBLE이면 true를 돌려준다", () => {
    expect(isIncompatibleWithCurrentCurriculum("INCOMPATIBLE")).toBe(true);
  });

  it("그 외 값과 null이면 false를 돌려준다", () => {
    expect(isIncompatibleWithCurrentCurriculum("DIRECT_COMPATIBLE")).toBe(false);
    expect(isIncompatibleWithCurrentCurriculum("PARTIAL_COMPATIBLE")).toBe(false);
    expect(isIncompatibleWithCurrentCurriculum("UNCERTAIN")).toBe(false);
    expect(isIncompatibleWithCurrentCurriculum(null)).toBe(false);
  });
});
