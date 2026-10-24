/**
 * S3-1·S3-R1 — 도형 시각화 off 상태의 바이트 동일성.
 *
 * 기준값 `__baseline__/figuresOff.baseline.json`은 Stage 3 코드를 바꾸기 **전**(커밋 2679651 기준 작업 트리)에
 * 같은 절차로 캡처했다. 이 테스트는 현재 코드로 같은 절차를 다시 실행해 바이트 단위로 비교한다.
 * - solve SSE(옵션 4조합), resume SSE(own·alternative) — 실제 Express + supertest
 * - `buildSystemPrompt(grade)`(6학년), `buildResumePrompt(grade, mode)`(6×2)
 * - OpenAI solve/resume 요청 본문과 이벤트(openai SDK mock)
 * - off에서 generateFigures/repairFigure 호출 0회, done에 figures 키 없음, saveSolution payload 불변
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { Diagnosis, Grade, ResumeMode } from "shared-types";

const getUserMock = vi.fn();
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn(() => ({ auth: { getUser: getUserMock } })) }));
const createMock = vi.fn();
vi.mock("openai", () => {
  class MockOpenAI {
    responses = { create: createMock };
  }
  return { default: MockOpenAI, OpenAI: MockOpenAI };
});

const { createApp } = await import("../app");
const { FakeLLMAdapter } = await import("../infrastructure/ai/fake-adapter");
const { OpenAIAdapter } = await import("../infrastructure/ai/openai-adapter");
const { inMemoryProblemStore } = await import("../infrastructure/store/inMemoryProblemStore");
const { problemRepository } = await import("../infrastructure/persistence/problemRepository");
const { buildSystemPrompt, buildResumePrompt } = await import("../infrastructure/ai/prompts/system");

interface Baseline {
  solveSse: Record<string, string>;
  resumeSse: Record<string, string>;
  systemPrompts: Record<string, string>;
  resumePrompts: Record<string, string>;
  openaiRequests: unknown[];
  openaiSolveEvents: unknown[];
  openaiResumeEvents: Record<string, unknown[]>;
}

const baseline = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "__baseline__", "figuresOff.baseline.json"), "utf8"),
) as Baseline;

const PID = "55555555-5555-4555-8555-555555555555";
const DIAG: Diagnosis = {
  lastValidLine: 1,
  stallLine: 2,
  errorTypeLabel: "부호 오류",
  errorDetail: "x",
  relatedConcepts: [],
  reachedAnswerWithNotes: false,
  isLowConfidence: false,
  conceptExplanations: [],
  identifiedMethod: { methodId: "perfect-square", methodName: "완전제곱식" },
  isMethodApplicable: true,
  methodApplicabilityNote: null,
  problemAnswerLatex: "-1",
};
const GRADES: Grade[] = ["M1", "M2", "M3", "H1", "H2", "H3"];
const MODES: ResumeMode[] = ["own", "alternative"];
const SOLVE_CASES = [
  { concept: true, solution: true },
  { concept: false, solution: true },
  { concept: true, solution: false },
  { concept: false, solution: false },
];

function fakeCas() {
  return {
    verifyWorkLines: vi.fn(() => Promise.resolve([])),
    verifyFinalAnswer: vi.fn(() => Promise.resolve({ verified: true })),
  };
}

function seedSolveProblem(): void {
  inMemoryProblemStore.clear();
  inMemoryProblemStore.set({
    problemId: PID,
    userId: "user-1",
    grade: "M2",
    problem: { recognizedText: "이차함수 y = x^2 - 4x + 3의 최솟값을 구하시오.", recognizedLatex: null },
    createdAt: "2026-10-24T00:00:00.000Z",
  });
}

function seedResumeProblem(): void {
  inMemoryProblemStore.clear();
  inMemoryProblemStore.set({
    problemId: PID,
    userId: "user-1",
    grade: "M2",
    problem: { recognizedText: "이차함수 y = x^2 - 4x + 3의 최솟값을 구하시오.", recognizedLatex: null },
    createdAt: "2026-10-24T00:00:00.000Z",
    workLines: [
      { lineNo: 1, latex: "y = x^{2} - 4x + 3", isLowConfidence: false },
      { lineNo: 2, latex: "y=(x+2)^2-1", isLowConfidence: false },
    ],
    diagnosis: DIAG,
  });
}

beforeEach(() => {
  getUserMock.mockReset();
  getUserMock.mockResolvedValue({ data: { user: { id: "user-1", user_metadata: { grade: "M2" } } }, error: null });
});

describe("S3-1 solve off — 바이트 동일", () => {
  it("SSE 전체가 기준값과 같고 도형 호출 0회, done에 figures 키 없음, saveSolution payload 불변", async () => {
    const saveSpy = vi.spyOn(problemRepository, "saveSolution");
    for (const options of SOLVE_CASES) {
      seedSolveProblem();
      saveSpy.mockClear();
      const adapter = new FakeLLMAdapter();
      const generateSpy = vi.spyOn(adapter, "generateFigures");
      const repairSpy = vi.spyOn(adapter, "repairFigure");
      const res = await request(createApp(adapter, fakeCas()))
        .post(`/api/problems/${PID}/solve`)
        .set({ Authorization: "Bearer t" })
        .send({ options });

      const key = `${options.concept}-${options.solution}`;
      expect(res.text).toBe(baseline.solveSse[key]);
      expect(generateSpy).not.toHaveBeenCalled();
      expect(repairSpy).not.toHaveBeenCalled();
      expect(res.text).not.toContain("event: figures");
      expect(res.text).not.toContain(": keep-alive");

      const done = /event: done\ndata: (.+)\n\n/.exec(res.text);
      const payload = JSON.parse(done?.[1] ?? "null") as Record<string, unknown>;
      expect(Object.keys(payload)).not.toContain("figures");
      expect(Object.keys(payload)).not.toContain("stepFigureRefs");
      expect(saveSpy).toHaveBeenCalledTimes(1);
      expect(saveSpy).toHaveBeenCalledWith({ problemId: PID, solution: payload });
    }
    saveSpy.mockRestore();
  });

  it("buildSystemPrompt(grade)가 기준값과 같다(옵션 생략·stepMarkers false 모두)", () => {
    for (const grade of GRADES) {
      expect(buildSystemPrompt(grade)).toBe(baseline.systemPrompts[grade]);
      expect(buildSystemPrompt(grade, { stepMarkers: false })).toBe(baseline.systemPrompts[grade]);
    }
  });
});

describe("S3-R1 resume off — 바이트 동일", () => {
  it("own·alternative SSE가 기준값과 같고 도형 호출 0회", async () => {
    for (const mode of MODES) {
      seedResumeProblem();
      const adapter = new FakeLLMAdapter();
      const generateSpy = vi.spyOn(adapter, "generateFigures");
      const res = await request(createApp(adapter, fakeCas()))
        .post(`/api/problems/${PID}/resume`)
        .set({ Authorization: "Bearer t" })
        .send({ mode });
      expect(res.text).toBe(baseline.resumeSse[mode]);
      expect(generateSpy).not.toHaveBeenCalled();
      expect(res.text).not.toContain("event: figures");
    }
  });

  it("buildResumePrompt(grade, mode)가 기준값과 같다", () => {
    for (const grade of GRADES) {
      for (const mode of MODES) {
        expect(buildResumePrompt(grade, mode)).toBe(baseline.resumePrompts[`${grade}-${mode}`]);
        expect(buildResumePrompt(grade, mode, { stepMarkers: false })).toBe(baseline.resumePrompts[`${grade}-${mode}`]);
      }
    }
  });
});

describe("S3-1·S3-R1 OpenAI 요청 본문(off)", () => {
  it("solve/resume 요청 본문과 이벤트가 기준값과 같다", async () => {
    async function* fakeStream() {
      await Promise.resolve();
      yield { type: "response.output_text.delta", delta: "## 풀이\n1. a\n\n## 최종 답\n-1" };
      yield { type: "response.completed" };
    }
    const adapter = new OpenAIAdapter("test-model", "test-key");
    createMock.mockReset();
    createMock.mockImplementation(() => Promise.resolve(fakeStream()));
    const solveEvents: unknown[] = [];
    for await (const e of adapter.solve({
      problem: { recognizedText: "문제", recognizedLatex: "x^2" },
      options: { concept: true, solution: true },
      grade: "H1",
    })) {
      solveEvents.push(e);
    }
    const resumeEvents: Record<string, unknown[]> = {};
    for (const m of MODES) {
      const events: unknown[] = [];
      for await (const e of adapter.resume({
        problem: "문제",
        workLines: [{ lineNo: 1, latex: "a", isLowConfidence: false }],
        diagnosis: DIAG,
        mode: m,
        grade: "H1",
      })) {
        events.push(e);
      }
      resumeEvents[m] = events;
    }
    expect(createMock.mock.calls.map((c: unknown[]) => c[0])).toEqual(baseline.openaiRequests);
    // 요청별 옵션(2번째 인자)도 기존처럼 없다.
    expect(createMock.mock.calls.every((c: unknown[]) => c.length === 1)).toBe(true);
    expect(solveEvents).toEqual(baseline.openaiSolveEvents);
    expect(resumeEvents).toEqual(baseline.openaiResumeEvents);
  });
});
