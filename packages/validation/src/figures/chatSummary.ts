/**
 * CHAT용 검증 도형 요약(Stage 5, `docs/FIGURE_SPEC.md` §17). 순수·결정적 함수 — 같은 입력이면 같은 출력.
 *
 * - 입력은 서버 메모리의 **검증을 통과한** `FigureSpec`만이다(클라이언트가 보낸 도형은 받지 않는다).
 *   그래도 방어적으로 라벨을 다시 확인해 안전하지 않으면 null로 바꾼다.
 * - 단계 k(1..99) 또는 null(최종) 기준의 요소 표시·강조는 `stepStateAt`로 계산한다 — 웹 렌더러의
 *   `resolveStepStateAt`(apps/web `features/figure-visualization/resolveStepState.ts`)과 **같은 규칙**이며,
 *   두 구현의 F01~F09 모든 단계 일치는 웹 테스트가 확인한다.
 * - 파생점(중점·수선의 발·교점·접점·그래프 위 점) 좌표는 의미 검증기(`resolveFigure`)가 계산한 값을 소수 셋째 자리로 반올림한다.
 * - 길이 상한: 도형 하나의 JSON이 `CHAT_FIGURE_SUMMARY_MAX_CHARS`를 넘으면 요소·제약 목록을 빼고 description만 남긴다.
 *   여러 도형의 합계가 `CHAT_FIGURES_TOTAL_MAX_CHARS`를 넘으면 뒤 도형부터 같은 방식으로 줄인다.
 *
 * 이 요약은 "명세가 서로 모순되지 않는다"는 검증 결과일 뿐 풀이가 옳다는 보증이 아니다(FIG-10).
 */
import type {
  ChatFigureConstraintSummary,
  ChatFigureElementSummary,
  ChatFigureEmphasis,
  ChatFigureSummary,
  FigureSpec,
} from "shared-types";
import { isSafeLabelText } from "../figures";
import { elementDependencies, resolveFigure } from "./semantics";
import { stepNumber } from "./steps";

/** 도형 하나의 요약 JSON 문자 수 상한. **결정 필요(임시값, S5-D6).** */
export const CHAT_FIGURE_SUMMARY_MAX_CHARS = 3_000;
/** 한 요청의 도형 요약 JSON 합계 문자 수 상한. **결정 필요(임시값, S5-D6).** */
export const CHAT_FIGURES_TOTAL_MAX_CHARS = 6_000;

/** 풀이 전역 단계 위치: 1..N 또는 최종. */
export type ChatFigureStepPosition = number | "final";
export type ChatFigureElementDisplay = { visible: false } | { visible: true; emphasis: ChatFigureEmphasis };

function stepNumberOf(stepId: string): number | null {
  return stepNumber(stepId);
}

/**
 * 전역 단계 k(또는 최종) 기준 요소 표시 상태 — 웹 `resolveStepStateAt`과 같은 규칙.
 * - "final": 모든 요소 등장, 모든 단계 `hide` 누적, 강조 없음.
 * - k: appearAt이 null이거나 n(appearAt) ≤ k인 요소 중 n(stepId) ≤ k 단계들의 hide 누적에 없는 요소를 보인다.
 *   번호가 정확히 k인 도형 단계의 highlight가 비어 있지 않으면 그 요소는 강조, 나머지 보이는 요소는 비강조.
 */
export function stepStateAt(spec: FigureSpec, position: ChatFigureStepPosition): Map<string, ChatFigureElementDisplay> {
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
  const state = new Map<string, ChatFigureElementDisplay>();
  for (const element of spec.elements) {
    const appear = element.appearAt === null ? 0 : (stepNumberOf(element.appearAt) ?? Number.POSITIVE_INFINITY);
    if (!(isFinal || appear <= k) || hidden.has(element.id)) {
      state.set(element.id, { visible: false });
      continue;
    }
    const emphasis: ChatFigureEmphasis =
      highlighted.size === 0 ? "default" : highlighted.has(element.id) ? "highlight" : "dim";
    state.set(element.id, { visible: true, emphasis });
  }
  return state;
}

function round3(value: number): number {
  const rounded = Math.round(value * 1000) / 1000;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function constraintSummary(constraint: FigureSpec["constraints"][number]): ChatFigureConstraintSummary {
  const base = { type: constraint.type, source: constraint.source };
  switch (constraint.type) {
    case "perpendicular":
    case "parallel":
    case "equalLength":
      return { ...base, targets: [constraint.a, constraint.b] };
    case "length":
      return { ...base, targets: [constraint.segment], value: constraint.value };
    case "angleMeasure":
      return { ...base, targets: [constraint.angle], value: constraint.degrees };
    case "pointOnCircle":
      return { ...base, targets: [constraint.point, constraint.circle] };
    case "pointOnLine":
      return { ...base, targets: [constraint.point, constraint.line] };
    case "tangent":
      return { ...base, targets: [constraint.line, constraint.circle] };
    case "collinear":
      return { ...base, targets: [...constraint.points] };
    default: {
      const unreachable: never = constraint;
      void unreachable;
      return { ...base, targets: [] };
    }
  }
}

function safeLabel(label: string | null): string | null {
  return label !== null && isSafeLabelText(label) ? label : null;
}

/** 검증된 도형 하나를 단계 `step`(null = 최종) 기준으로 요약한다. 상한을 넘으면 description만 남긴다. */
export function buildFigureChatSummary(spec: FigureSpec, step: number | null): ChatFigureSummary {
  const position: ChatFigureStepPosition = step === null ? "final" : step;
  const head = { figureId: spec.figureId, kind: spec.kind, description: spec.description, step: position };
  const state = stepStateAt(spec, position);
  const resolved = resolveFigure(spec);

  const elements: ChatFigureElementSummary[] = spec.elements.map((element) => {
    const display = state.get(element.id) ?? { visible: false };
    const computed = resolved?.elements.get(element.id);
    return {
      id: element.id,
      type: element.type,
      label: safeLabel(element.label),
      role: element.role,
      refs: elementDependencies(element),
      visible: display.visible,
      emphasis: display.visible ? display.emphasis : null,
      ...(computed?.kind === "point" ? { point: { x: round3(computed.xy.x), y: round3(computed.xy.y) } } : {}),
    };
  });
  const full: ChatFigureSummary = { ...head, elements, constraints: spec.constraints.map(constraintSummary) };
  return JSON.stringify(full).length <= CHAT_FIGURE_SUMMARY_MAX_CHARS ? full : { ...head, truncated: true };
}

/** 여러 도형 요약(서버 CHAT 맥락용). 합계 상한을 넘으면 뒤 도형부터 description만 남긴다. */
export function buildFigureChatSummaries(figures: readonly FigureSpec[], step: number | null): ChatFigureSummary[] {
  const summaries = figures.map((figure) => buildFigureChatSummary(figure, step));
  for (let index = summaries.length - 1; index >= 0; index -= 1) {
    if (JSON.stringify(summaries).length <= CHAT_FIGURES_TOTAL_MAX_CHARS) break;
    const current = summaries[index];
    if (current && !current.truncated) {
      summaries[index] = {
        figureId: current.figureId,
        kind: current.kind,
        description: current.description,
        step: current.step,
        truncated: true,
      };
    }
  }
  return summaries;
}
