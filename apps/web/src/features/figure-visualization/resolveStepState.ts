import type { FigureSpec } from "shared-types";

/** 요소의 단계별 표시 상태 — `docs/FIGURE_DESIGN.md` §3.1. */
export type FigureEmphasis = "default" | "highlight" | "dim";
export type FigureElementDisplay = { visible: false } | { visible: true; emphasis: FigureEmphasis };
export type FigureStepState = ReadonlyMap<string, FigureElementDisplay>;

/** 풀이 전역 단계 위치: 1..N(`sN`의 N) 또는 최종. */
export type FigureStepPosition = number | "final";

function stepNumberOf(stepId: string): number | null {
  const match = /^s([1-9][0-9]?)$/.exec(stepId);
  return match ? Number(match[1]) : null;
}

/**
 * 전역 단계 k 기준 단계 상태(Stage 4, `docs/FIGURE_DESIGN.md` §17.5). 원래 명세에서 매번 처음부터 계산한다
 * (이동 순서와 무관하게 같은 k = 같은 그림, FIG-8·S4-3).
 *
 * - `"final"`: 모든 요소 등장, 모든 단계 `hide` 누적, 강조 없음(`docs/FIGURE_SPEC.md` §4).
 * - k: `appearAt`이 null이거나 n(appearAt) ≤ k인 요소 중, n(stepId) ≤ k인 단계들의 `hide` 누적에 들지 않은 요소를 보인다.
 *   번호가 정확히 k인 도형 단계의 `highlight`가 비어 있지 않으면 그 요소는 강조, 나머지 보이는 요소는 비강조.
 *   도형 steps에 k가 없으면 그때까지의 누적 상태이고 강조가 없다(S4-2) — 모든 보이는 요소가 기본 상태.
 */
export function resolveStepStateAt(spec: FigureSpec, position: FigureStepPosition): FigureStepState {
  const isFinal = position === "final";
  const k = isFinal ? Number.POSITIVE_INFINITY : position;

  const hidden = new Set<string>();
  let highlight: readonly string[] = [];
  for (const step of spec.steps) {
    const n = stepNumberOf(step.stepId);
    if (n === null || n > k) continue;
    for (const id of step.hide) hidden.add(id);
    if (!isFinal && n === k) highlight = step.highlight;
  }
  const highlighted = new Set(highlight);

  const state = new Map<string, FigureElementDisplay>();
  for (const element of spec.elements) {
    const appear = element.appearAt === null ? 0 : (stepNumberOf(element.appearAt) ?? Number.POSITIVE_INFINITY);
    const appeared = isFinal || appear <= k;
    if (!appeared || hidden.has(element.id)) {
      state.set(element.id, { visible: false });
      continue;
    }
    const emphasis: FigureEmphasis = highlighted.size === 0 ? "default" : highlighted.has(element.id) ? "highlight" : "dim";
    state.set(element.id, { visible: true, emphasis });
  }
  return state;
}

/**
 * 도형 자체 stepId 기준 단계 상태(Stage 2 API, `/dev/figures`·기존 호출부). `resolveStepStateAt`에 위임한다.
 *
 * - `stepId`가 없거나 steps에 없으면 **최종 상태**.
 * - 있으면 그 단계 번호 k로 `resolveStepStateAt(spec, k)`(검증된 명세는 steps가 번호 오름차순이라 이전 계산과 같다 —
 *   F01~F09 모든 단계 동일성은 `resolveStepState.test.ts`).
 */
export function resolveStepState(spec: FigureSpec, stepId?: string | null): FigureStepState {
  if (stepId == null || !spec.steps.some((step) => step.stepId === stepId)) return resolveStepStateAt(spec, "final");
  const k = stepNumberOf(stepId);
  return k === null ? resolveStepStateAt(spec, "final") : resolveStepStateAt(spec, k);
}
