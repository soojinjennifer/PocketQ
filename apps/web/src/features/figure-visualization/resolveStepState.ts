import type { FigureSpec } from "shared-types";

/** 요소의 단계별 표시 상태 — `docs/FIGURE_DESIGN.md` §3.1. */
export type FigureEmphasis = "default" | "highlight" | "dim";
export type FigureElementDisplay = { visible: false } | { visible: true; emphasis: FigureEmphasis };
export type FigureStepState = ReadonlyMap<string, FigureElementDisplay>;

/**
 * 단계 상태를 원래 명세에서 처음부터 다시 계산한다(이동 순서와 무관하게 같은 단계 = 같은 그림, FIG-8).
 *
 * - `stepId`가 없거나 steps에 없으면 **최종 상태**: 모든 요소를 등장시키고 모든 단계의 `hide`를
 *   누적 적용, 강조 없음(`docs/FIGURE_SPEC.md` §4).
 * - 있으면 그 단계까지 등장한 요소 중, 그 단계까지(포함) 누적 `hide`되지 않은 요소를 보인다(D6).
 * - 그 단계 `highlight`가 비어 있지 않으면 목록의 요소는 강조, 나머지 보이는 요소는 비강조.
 */
export function resolveStepState(spec: FigureSpec, stepId?: string | null): FigureStepState {
  const stepIndex = stepId == null ? -1 : spec.steps.findIndex((step) => step.stepId === stepId);
  const isFinal = stepIndex < 0;
  const lastIndex = isFinal ? spec.steps.length - 1 : stepIndex;

  const order = new Map<string, number>();
  spec.steps.forEach((step, index) => {
    if (!order.has(step.stepId)) order.set(step.stepId, index);
  });

  const hidden = new Set<string>();
  for (let index = 0; index <= lastIndex; index += 1) {
    for (const id of spec.steps[index]?.hide ?? []) hidden.add(id);
  }
  const highlight = new Set(isFinal ? [] : (spec.steps[stepIndex]?.highlight ?? []));

  const state = new Map<string, FigureElementDisplay>();
  for (const element of spec.elements) {
    const appear = element.appearAt === null ? -1 : (order.get(element.appearAt) ?? Number.POSITIVE_INFINITY);
    const appeared = isFinal ? true : appear <= stepIndex;
    if (!appeared || hidden.has(element.id)) {
      state.set(element.id, { visible: false });
      continue;
    }
    const emphasis: FigureEmphasis = highlight.size === 0 ? "default" : highlight.has(element.id) ? "highlight" : "dim";
    state.set(element.id, { visible: true, emphasis });
  }
  return state;
}
