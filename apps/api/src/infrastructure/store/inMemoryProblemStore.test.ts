/**
 * Stage 5 WU3 — 메모리 도형 연결 규칙(같은 결과 객체일 때만)과 CHAT 맥락 조회(`resolveSolutionContext`).
 */
import { beforeEach, describe, expect, it } from "vitest";
import type { ResumeSolution, Solution } from "shared-types";
import { parseSolutionFigures } from "validation";
import { F01_TRIANGLE_ANGLE, F09_STEPWISE_AUXILIARY } from "validation/fixtures";
import { inMemoryProblemStore } from "./inMemoryProblemStore";
import { resolveSolutionContext } from "./resolveSolutionContext";

const PID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1";

function solution(answerMd: string): Solution {
  return { conceptMd: null, solutionMd: "## 풀이\n**1단계** a", answerMd, conceptTags: [], aiProvider: "openai", aiModel: "m" };
}

function resumeSolution(answerMd: string): ResumeSolution {
  return { mode: "own", methodName: "2번째 줄부터 이어가기", solutionMd: "## 이어풀기\n**1단계** b", answerMd, verified: true };
}

const F09 = (() => {
  const parsed = parseSolutionFigures({ figures: [F09_STEPWISE_AUXILIARY.raw], stepFigureRefs: [{ stepId: "s1", figureId: "fig-f09" }] });
  return { figures: parsed.figures, stepFigureRefs: parsed.stepFigureRefs };
})();
const F01 = (() => {
  const parsed = parseSolutionFigures({ figures: [F01_TRIANGLE_ANGLE.raw] });
  return { figures: parsed.figures, stepFigureRefs: parsed.stepFigureRefs };
})();

beforeEach(() => {
  inMemoryProblemStore.clear();
  inMemoryProblemStore.set({
    problemId: PID,
    userId: "user-1",
    grade: "H1",
    problem: { recognizedText: "삼각형", recognizedLatex: null },
    createdAt: "2026-10-25T00:00:00.000Z",
  });
});

describe("attachSolutionFigures", () => {
  it("저장된 solution과 같은 객체면 연결하고, solution 객체 자체는 바꾸지 않는다", () => {
    const s = solution("1");
    inMemoryProblemStore.setSolution(PID, s);
    expect(inMemoryProblemStore.attachSolutionFigures(PID, s, F09)).toBe(true);
    expect(inMemoryProblemStore.getSolutionFigures(PID)).toEqual(F09);
    expect(Object.keys(inMemoryProblemStore.get(PID)?.solution ?? {})).not.toContain("figures");
    expect(inMemoryProblemStore.get(PID)?.solution).toBe(s);
  });

  it("재풀이로 solution이 바뀐 뒤 이전 실행의 연결은 무시되고, 새 풀이에는 이전 도형이 보이지 않는다", () => {
    const first = solution("1");
    inMemoryProblemStore.setSolution(PID, first);
    inMemoryProblemStore.attachSolutionFigures(PID, first, F01);
    const second = solution("2");
    inMemoryProblemStore.setSolution(PID, second);
    expect(inMemoryProblemStore.getSolutionFigures(PID)).toBeUndefined();
    expect(inMemoryProblemStore.attachSolutionFigures(PID, first, F09)).toBe(false);
    expect(inMemoryProblemStore.getSolutionFigures(PID)).toBeUndefined();
    expect(inMemoryProblemStore.attachSolutionFigures(PID, second, F09)).toBe(true);
    expect(inMemoryProblemStore.getSolutionFigures(PID)).toEqual(F09);
  });

  it("도형 0개·없는 문제·풀이 전이면 연결하지 않는다", () => {
    const s = solution("1");
    expect(inMemoryProblemStore.attachSolutionFigures(PID, s, F09)).toBe(false);
    inMemoryProblemStore.setSolution(PID, s);
    expect(inMemoryProblemStore.attachSolutionFigures(PID, s, { figures: [], stepFigureRefs: [] })).toBe(false);
    expect(inMemoryProblemStore.attachSolutionFigures("missing", s, F09)).toBe(false);
  });
});

describe("attachResumeFigures + resolveSolutionContext(S5-7)", () => {
  it("resume 결과에 연결된 도형이 CHAT 맥락으로 옮겨지고 solutionSource=resume", () => {
    const r = resumeSolution("-1");
    inMemoryProblemStore.setResumeSolution(PID, r);
    expect(inMemoryProblemStore.attachResumeFigures(PID, r, F09)).toBe(true);
    const context = resolveSolutionContext(PID, "user-1");
    expect(context.solutionSource).toBe("resume");
    expect(context.figures).toEqual(F09.figures);
    expect(context.stepFigureRefs).toEqual(F09.stepFigureRefs);
    expect(Object.keys(context.solution)).not.toContain("figures");
  });

  it("solve 풀이가 있으면 solve 도형(resume 도형 아님), 도형이 없으면 키 자체가 없다", () => {
    const r = resumeSolution("-1");
    inMemoryProblemStore.setResumeSolution(PID, r);
    inMemoryProblemStore.attachResumeFigures(PID, r, F09);
    const s = solution("1");
    inMemoryProblemStore.setSolution(PID, s);
    const without = resolveSolutionContext(PID, "user-1");
    expect(without.solutionSource).toBe("solve");
    expect(Object.keys(without)).toEqual(["problem", "solution", "grade", "solutionSource"]);
    inMemoryProblemStore.attachSolutionFigures(PID, s, F01);
    expect(resolveSolutionContext(PID, "user-1").figures).toEqual(F01.figures);
  });

  it("clear()는 연결도 지운다", () => {
    const s = solution("1");
    inMemoryProblemStore.setSolution(PID, s);
    inMemoryProblemStore.attachSolutionFigures(PID, s, F09);
    inMemoryProblemStore.clear();
    inMemoryProblemStore.set({ problemId: PID, userId: "user-1", grade: "H1", problem: { recognizedText: "x", recognizedLatex: null }, createdAt: "" });
    inMemoryProblemStore.setSolution(PID, s);
    expect(inMemoryProblemStore.getSolutionFigures(PID)).toBeUndefined();
  });
});
