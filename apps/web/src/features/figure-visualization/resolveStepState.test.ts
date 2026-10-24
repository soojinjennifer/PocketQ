import { describe, expect, it } from "vitest";
import { F02_FOOT_OF_PERPENDICULAR, F09_STEPWISE_AUXILIARY } from "validation/fixtures";
import { resolveStepState } from "./resolveStepState";
import { loadFixture } from "./testFixtures";

describe("resolveStepState", () => {
  const { spec } = loadFixture(F09_STEPWISE_AUXILIARY.raw);

  it("s1: appearAt null 요소만 보이고, 강조 목록 밖은 비강조", () => {
    const state = resolveStepState(spec, "s1");
    expect(state.get("H")).toEqual({ visible: false });
    expect(state.get("segAB")).toEqual({ visible: true, emphasis: "highlight" });
    expect(state.get("A")).toEqual({ visible: true, emphasis: "dim" });
  });

  it("s2: H·segAH·angAHC 등장 + 강조, 이전 보조선 유지", () => {
    const state = resolveStepState(spec, "s2");
    expect(state.get("angAHC")).toEqual({ visible: true, emphasis: "highlight" });
    expect(state.get("segBC")).toEqual({ visible: true, emphasis: "dim" });
    expect(state.get("M")).toEqual({ visible: false });
  });

  it("s3: hide는 그 단계부터 적용(angAHC 숨김), H는 유지", () => {
    const state = resolveStepState(spec, "s3");
    expect(state.get("angAHC")).toEqual({ visible: false });
    expect(state.get("H")).toEqual({ visible: true, emphasis: "dim" });
    expect(state.get("M")).toEqual({ visible: true, emphasis: "highlight" });
  });

  it("최종 상태(stepId 없음·모르는 stepId): 모두 등장, 모든 hide 누적, 강조 없음", () => {
    for (const stepId of [undefined, null, "s9"]) {
      const state = resolveStepState(spec, stepId);
      expect(state.get("angAHC")).toEqual({ visible: false });
      expect(state.get("M")).toEqual({ visible: true, emphasis: "default" });
      expect(state.get("A")).toEqual({ visible: true, emphasis: "default" });
    }
  });

  it("이동 순서와 무관하게 같은 단계는 같은 상태(FIG-8)", () => {
    const direct = resolveStepState(spec, "s2");
    resolveStepState(spec, "s3");
    expect(resolveStepState(spec, "s2")).toEqual(direct);
  });

  it("강조 목록이 빈 단계는 보이는 요소 전부 기본 상태", () => {
    const { spec: f02 } = loadFixture(F02_FOOT_OF_PERPENDICULAR.raw);
    const empty = { ...f02, steps: [{ stepId: "s1", highlight: [], hide: [] }, { stepId: "s2", highlight: [], hide: [] }] };
    expect(resolveStepState(empty, "s1").get("A")).toEqual({ visible: true, emphasis: "default" });
  });
});
