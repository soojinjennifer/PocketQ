/**
 * Stage 3 — FakeLLMAdapter 단계 표지 모드와 도형 시나리오.
 * S3-R7: 표지 on에서 `## 최종 답`이 순수 LaTeX로 유지되고 parseResumeOutput 섹션 분리가 정확하다.
 */
import { describe, expect, it } from "vitest";
import type { Diagnosis, ResumeSolution, Solution } from "shared-types";
import { splitSolutionSteps } from "validation";
import { FakeLLMAdapter } from "./fake-adapter";
import { parseResumeOutput } from "./parseResumeOutput";
import { parseSolveOutput } from "./parseSolveOutput";

const DIAG: Diagnosis = {
  lastValidLine: 2,
  stallLine: 3,
  errorTypeLabel: null,
  errorDetail: null,
  relatedConcepts: [],
  reachedAnswerWithNotes: false,
  isLowConfidence: false,
  conceptExplanations: [],
  identifiedMethod: null,
  isMethodApplicable: true,
  methodApplicabilityNote: null,
  problemAnswerLatex: "-1",
};

async function collectSolve(adapter: FakeLLMAdapter, stepMarkers: boolean): Promise<{ text: string; result: Solution | null }> {
  let text = "";
  let result: Solution | null = null;
  for await (const event of adapter.solve({
    problem: { recognizedText: "문제", recognizedLatex: null },
    options: { concept: true, solution: true },
    grade: "M2",
    stepMarkers,
  })) {
    if ("delta" in event) text += event.delta;
    else result = event.result;
  }
  return { text, result };
}

async function collectResume(mode: "own" | "alternative"): Promise<{ text: string; result: ResumeSolution | null }> {
  let text = "";
  let result: ResumeSolution | null = null;
  for await (const event of new FakeLLMAdapter().resume({
    problem: "문제",
    workLines: [],
    diagnosis: DIAG,
    mode,
    grade: "M2",
    stepMarkers: true,
  })) {
    if ("delta" in event) text += event.delta;
    else if ("done" in event) result = event.result;
  }
  return { text, result };
}

describe("solve stepMarkers", () => {
  it("on: ## 풀이에 **1~3단계**, 결과는 parseSolveOutput과 일치하고 3단계로 분할된다", async () => {
    const { text, result } = await collectSolve(new FakeLLMAdapter(), true);
    const parsed = parseSolveOutput(text);
    expect(result?.solutionMd).toBe(parsed.solutionMd);
    expect(result?.answerMd).toBe(parsed.answerMd);
    expect(result?.conceptTags).toEqual(["이차함수 > 최대·최소"]);
    const split = splitSolutionSteps(result?.solutionMd);
    expect(split.ok && split.stepCount).toBe(3);
    expect(result?.answerMd).not.toContain("단계**");
    expect(result?.conceptMd).not.toContain("단계**");
  });

  it("off: 표지가 없다(기존 청크)", async () => {
    const { text } = await collectSolve(new FakeLLMAdapter(), false);
    expect(text).not.toContain("단계**");
  });
});

describe("S3-R7 resume stepMarkers", () => {
  for (const mode of ["own", "alternative"] as const) {
    it(`${mode}: 최종 답은 순수 LaTeX "-1", 섹션 분리 정확, s1부터 3단계`, async () => {
      const { text, result } = await collectResume(mode);
      expect(result?.answerMd).toBe("-1");
      expect(parseResumeOutput(text)).toEqual({
        methodName: result?.methodName,
        solutionMd: result?.solutionMd,
        answerMd: "-1",
      });
      expect(result?.methodName).not.toContain("단계**");
      expect(result?.solutionMd.startsWith("**1단계**")).toBe(true);
      const split = splitSolutionSteps(result?.solutionMd);
      expect(split.ok && split.steps.map((s) => s.stepId)).toEqual(["s1", "s2", "s3"]);
    });
  }

  it("S3-R5 own의 s1은 학생 lineNo와 무관(lastValidLine 2여도 이어 쓴 첫 단계가 s1)", async () => {
    const { result } = await collectResume("own");
    expect(result?.methodName).toBe("3번째 줄부터 이어가기");
    expect(result?.solutionMd.split("\n")[0]).toContain("**1단계**");
  });
});

describe("도형 시나리오", () => {
  const request = { source: "solve" as const, mode: null, grade: "M2" as const, problemText: "p", priorWork: null, solutionMd: null, answerMd: "a", stepCount: 3 };

  it("hang: signal이 취소될 때까지 응답하지 않는다", async () => {
    const controller = new AbortController();
    const pending = new FakeLLMAdapter("claude", "fake", { figureScenario: "hang" }).generateFigures({ ...request, signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toThrow("aborted");
  });

  it("malformed: figures가 배열이 아니다", async () => {
    const result = await new FakeLLMAdapter("claude", "fake", { figureScenario: "malformed" }).generateFigures({
      ...request,
      signal: new AbortController().signal,
    });
    expect(Array.isArray((result.raw as { figures: unknown }).figures)).toBe(false);
  });
});
