import { describe, expect, it } from "vitest";
import { F02_FOOT_OF_PERPENDICULAR, F09_STEPWISE_AUXILIARY, VALID_FIGURE_FIXTURES } from "validation/fixtures";
import { resolveStepState, resolveStepStateAt } from "./resolveStepState";
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

/** Stage 4 WU6 이전 `resolveStepState` 구현(인덱스 기반) — 위임 후 결과 동일성 비교용 참조 구현. */
function legacyResolveStepState(spec: import("shared-types").FigureSpec, stepId?: string | null) {
  const stepIndex = stepId == null ? -1 : spec.steps.findIndex((step) => step.stepId === stepId);
  const isFinal = stepIndex < 0;
  const lastIndex = isFinal ? spec.steps.length - 1 : stepIndex;
  const order = new Map<string, number>();
  spec.steps.forEach((step, index) => {
    if (!order.has(step.stepId)) order.set(step.stepId, index);
  });
  const hidden = new Set<string>();
  for (let index = 0; index <= lastIndex; index += 1) for (const id of spec.steps[index]?.hide ?? []) hidden.add(id);
  const highlight = new Set(isFinal ? [] : (spec.steps[stepIndex]?.highlight ?? []));
  const state = new Map<string, { visible: false } | { visible: true; emphasis: string }>();
  for (const element of spec.elements) {
    const appear = element.appearAt === null ? -1 : (order.get(element.appearAt) ?? Number.POSITIVE_INFINITY);
    const appeared = isFinal ? true : appear <= stepIndex;
    if (!appeared || hidden.has(element.id)) {
      state.set(element.id, { visible: false });
      continue;
    }
    state.set(element.id, { visible: true, emphasis: highlight.size === 0 ? "default" : highlight.has(element.id) ? "highlight" : "dim" });
  }
  return state;
}

describe("Stage 4 resolveStepStateAt(S4-1·S4-2·S4-4)", () => {
  it("S4-1: F01~F09 모든 단계와 최종에서 resolveStepStateAt = 이전 resolveStepState = 위임된 resolveStepState", () => {
    let compared = 0;
    for (const fixture of VALID_FIGURE_FIXTURES) {
      const { spec: figure } = loadFixture(fixture.raw);
      for (const step of figure.steps) {
        const k = Number(step.stepId.slice(1));
        const legacy = legacyResolveStepState(figure, step.stepId);
        expect(resolveStepStateAt(figure, k)).toEqual(legacy);
        expect(resolveStepState(figure, step.stepId)).toEqual(legacy);
        compared += 1;
      }
      expect(resolveStepStateAt(figure, "final")).toEqual(legacyResolveStepState(figure, null));
      expect(resolveStepState(figure, null)).toEqual(legacyResolveStepState(figure, null));
    }
    expect(compared).toBeGreaterThanOrEqual(15);
  });

  it("S4-2: 도형 steps에 없는 전역 k → 그때까지 누적 상태(최종 아님), 강조 없음", () => {
    // F09 steps s1·s2·s3를 s1·s3·s5로 바꾼 사본: k=2·4는 도형 단계에 없다.
    const { spec: f09 } = loadFixture(F09_STEPWISE_AUXILIARY.raw);
    const sparse = {
      ...f09,
      elements: f09.elements.map((e) => (e.appearAt === "s2" ? { ...e, appearAt: "s3" } : e.appearAt === "s3" ? { ...e, appearAt: "s5" } : e)),
      steps: [
        { stepId: "s1", highlight: ["segAB"], hide: [] },
        { stepId: "s3", highlight: ["H"], hide: [] },
        { stepId: "s5", highlight: ["M"], hide: ["angAHC"] },
      ],
    };
    const at4 = resolveStepStateAt(sparse, 4);
    expect(at4.get("H")).toEqual({ visible: true, emphasis: "default" });
    expect(at4.get("angAHC")).toEqual({ visible: true, emphasis: "default" });
    expect(at4.get("M")).toEqual({ visible: false });
    const at2 = resolveStepStateAt(sparse, 2);
    expect(at2.get("H")).toEqual({ visible: false });
    expect(at2.get("A")).toEqual({ visible: true, emphasis: "default" });
    // 최종과 다르다(M 미등장).
    expect(at4).not.toEqual(resolveStepStateAt(sparse, "final"));
  });

  it("S4-4: 숨김 지시가 없으면 이전 보조선 유지 — F09 s3에서 AH 유지, angAHC만 숨김", () => {
    const { spec: f09 } = loadFixture(F09_STEPWISE_AUXILIARY.raw);
    const s3 = resolveStepStateAt(f09, 3);
    expect(s3.get("segAH")).toEqual({ visible: true, emphasis: "dim" });
    expect(s3.get("H")).toEqual({ visible: true, emphasis: "dim" });
    expect(s3.get("angAHC")).toEqual({ visible: false });
  });

  it("임의 순서 이동(1→3→2→1→최종→2)에서 같은 k = 같은 상태", () => {
    const { spec: f09 } = loadFixture(F09_STEPWISE_AUXILIARY.raw);
    const seen = new Map<string, unknown>();
    for (const position of [1, 3, 2, 1, "final", 2] as const) {
      const state = resolveStepStateAt(f09, position);
      const key = String(position);
      if (seen.has(key)) expect(state).toEqual(seen.get(key));
      seen.set(key, state);
    }
  });
});
