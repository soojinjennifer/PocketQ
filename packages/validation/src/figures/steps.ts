/**
 * 풀이 본문의 단계 분할과 도형 단계 범위 검사(Stage 3) — `docs/FIGURE_SPEC.md` §4.
 *
 * - `sN` = 풀이 섹션(최초 풀이 `## 풀이`, 이어풀기 `## 이어풀기`)에서 **줄 맨 앞**의 `**N단계**`
 *   표지로 나눈 N번째 단계. 섹션마다 s1부터 센다.
 * - 번호가 1부터 빠짐없이 이어지지 않으면 분할 실패다(단계별 표시 없이 최종 상태만 표시).
 */
import type { FigureSpec } from "shared-types";

/** stepId 패턴(`^s[1-9][0-9]?$`)이 표현할 수 있는 최대 단계 번호. */
export const MAX_SOLUTION_STEPS = 99;

/** 줄 맨 앞의 `**N단계**` 표지. N은 1~99. */
const STEP_MARKER_PATTERN = /^\*\*([1-9][0-9]?)단계\*\*/;

export type SplitSolutionStepsFailure = "empty" | "no_markers" | "non_sequential" | "too_many";

export type SplitSolutionStepsResult =
  | { ok: true; stepCount: number; steps: { stepId: string; text: string }[] }
  | { ok: false; reason: SplitSolutionStepsFailure };

/**
 * 풀이 섹션 본문을 `**N단계**` 표지 기준으로 나눈다. 표지 앞의 머리말은 어느 단계에도 넣지 않는다.
 * 줄 중간의 표지, 번호 건너뜀·중복·역순, 100 이상은 모두 실패로 처리한다. 절대 throw하지 않는다.
 */
export function splitSolutionSteps(sectionMd: string | null | undefined): SplitSolutionStepsResult {
  if (typeof sectionMd !== "string" || sectionMd.trim() === "") return { ok: false, reason: "empty" };

  const steps: { stepId: string; text: string }[] = [];
  let current: { stepId: string; lines: string[] } | null = null;
  let tooMany = false;

  for (const line of sectionMd.split(/\r?\n/)) {
    const anyNumber = /^\*\*([0-9]+)단계\*\*/.exec(line);
    if (anyNumber && !STEP_MARKER_PATTERN.test(line)) {
      // `**0단계**`(번호 오류), `**100단계**`(stepId로 표현 불가)처럼 범위를 벗어난 표지.
      if (Number(anyNumber[1]) === 0 || anyNumber[1]?.startsWith("0")) return { ok: false, reason: "non_sequential" };
      tooMany = true;
    }
    const match = STEP_MARKER_PATTERN.exec(line);
    if (match) {
      const number = Number(match[1]);
      if (number !== steps.length + (current ? 1 : 0) + 1) {
        return { ok: false, reason: "non_sequential" };
      }
      if (current) steps.push({ stepId: current.stepId, text: current.lines.join("\n").trim() });
      current = { stepId: `s${number}`, lines: [line] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) steps.push({ stepId: current.stepId, text: current.lines.join("\n").trim() });

  if (tooMany) return { ok: false, reason: "too_many" };
  if (steps.length === 0) return { ok: false, reason: "no_markers" };
  if (steps.length > MAX_SOLUTION_STEPS) return { ok: false, reason: "too_many" };
  return { ok: true, stepCount: steps.length, steps };
}

/** `sN`의 N. 형식이 틀리면 null. */
export function stepNumber(stepId: string): number | null {
  const match = /^s([1-9][0-9]?)$/.exec(stepId);
  return match ? Number(match[1]) : null;
}

export interface FigureStepRangeIssue {
  code: "step_out_of_range";
  path: (string | number)[];
}

/**
 * 도형이 참조하는 단계(`elements[].appearAt`, `steps[].stepId`)가 풀이 단계 수 안에 있는지 검사한다.
 * `stepCount`가 null(분할 실패)이면 단계 정합을 따지지 않는다 — 최종 상태만 표시하므로.
 */
export function checkFigureStepRange(figure: FigureSpec, stepCount: number | null): FigureStepRangeIssue[] {
  if (stepCount === null) return [];
  const issues: FigureStepRangeIssue[] = [];
  const outOfRange = (stepId: string): boolean => {
    const n = stepNumber(stepId);
    return n === null || n > stepCount;
  };
  figure.elements.forEach((element, index) => {
    if (element.appearAt !== null && outOfRange(element.appearAt)) {
      issues.push({ code: "step_out_of_range", path: ["elements", index, "appearAt"] });
    }
  });
  figure.steps.forEach((step, index) => {
    if (outOfRange(step.stepId)) issues.push({ code: "step_out_of_range", path: ["steps", index, "stepId"] });
  });
  return issues;
}
