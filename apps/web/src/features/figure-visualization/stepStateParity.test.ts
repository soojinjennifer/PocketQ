/**
 * Stage 5 WU4 — 서버 CHAT 요약의 단계 상태(`validation` `stepStateAt`)가 렌더러의 `resolveStepStateAt`과 같은지.
 * 학생이 보는 그림(k)과 CHAT이 받는 요약(k)이 달라지지 않게 F01~F09의 최종·1..N+1 모든 위치를 비교한다.
 */
import { describe, expect, it } from "vitest";
import type { FigureSpec } from "shared-types";
import { parseSolutionFigures, stepStateAt } from "validation";
import { VALID_FIGURE_FIXTURES } from "validation/fixtures";
import { resolveStepStateAt } from "./resolveStepState";

function spec(raw: unknown): FigureSpec {
  const figure = parseSolutionFigures({ figures: [raw] }).figures[0];
  if (!figure) throw new Error("fixture rejected");
  return figure;
}

describe("stepStateAt(validation) = resolveStepStateAt(web)", () => {
  it.each(VALID_FIGURE_FIXTURES.map((f) => [f.id, f] as const))("%s", (_id, fixture) => {
    const figure = spec(fixture.raw);
    const last = Math.max(0, ...figure.steps.map((s) => Number(s.stepId.slice(1))));
    const positions: (number | "final")[] = ["final"];
    for (let k = 1; k <= last + 1; k += 1) positions.push(k);
    for (const position of positions) {
      expect([...stepStateAt(figure, position)]).toEqual([...resolveStepStateAt(figure, position)]);
    }
  });
});
