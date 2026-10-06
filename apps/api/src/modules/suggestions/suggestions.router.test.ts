import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const getUserMock = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: getUserMock },
  })),
}));

const { createApp } = await import("../../app");
const { FakeLLMAdapter } = await import("../../infrastructure/ai/fake-adapter");
const { inMemoryProblemStore } = await import("../../infrastructure/store/inMemoryProblemStore");

const AUTH_HEADER = { Authorization: "Bearer valid-token" };
const KNOWN_PROBLEM_ID = "44444444-4444-4444-8444-444444444444";
const UNSOLVED_PROBLEM_ID = "55555555-5555-4555-8555-555555555555";
const RESUMED_PROBLEM_ID = "77777777-7777-4777-8777-777777777777";

const RESUME_SOLUTION = {
  mode: "own" as const,
  methodName: "3번째 줄부터 이어가기",
  solutionMd: "양변을 정리합니다.",
  answerMd: "x = 3 (이어풀기 답)",
  verified: false,
};

function createTestApp() {
  return createApp(new FakeLLMAdapter());
}

describe("POST /api/problems/:problemId/suggestions", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-1", user_metadata: { grade: "M2" } } },
      error: null,
    });

    inMemoryProblemStore.clear();
    inMemoryProblemStore.set({
      problemId: KNOWN_PROBLEM_ID,
      userId: "user-1",
      grade: "M2",
      problem: { recognizedText: "1+1=?", recognizedLatex: null },
      createdAt: new Date().toISOString(),
    });
    inMemoryProblemStore.setSolution(KNOWN_PROBLEM_ID, {
      conceptMd: null,
      solutionMd: null,
      answerMd: "2입니다.",
      conceptTags: ["자연수 > 덧셈"],
      aiProvider: "claude",
      aiModel: "fake-whymath-v0",
    });

    inMemoryProblemStore.set({
      problemId: UNSOLVED_PROBLEM_ID,
      userId: "user-1",
      grade: "M2",
      problem: { recognizedText: "2+2=?", recognizedLatex: null },
      createdAt: new Date().toISOString(),
    });
  });

  it("인증 헤더가 없으면 401을 응답한다", async () => {
    const res = await request(createTestApp()).post(`/api/problems/${KNOWN_PROBLEM_ID}/suggestions`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("unauthorized");
  });

  it("존재하지 않는 problemId면 404를 응답한다", async () => {
    const res = await request(createTestApp())
      .post("/api/problems/does-not-exist/suggestions")
      .set(AUTH_HEADER);

    expect(res.status).toBe(404);
  });

  it("다른 사용자의 problemId면 404를 응답한다(소유권 검증)", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-2", user_metadata: { grade: "M2" } } },
      error: null,
    });

    const res = await request(createTestApp())
      .post(`/api/problems/${KNOWN_PROBLEM_ID}/suggestions`)
      .set(AUTH_HEADER);

    expect(res.status).toBe(404);
  });

  it("풀이가 아직 없는 problemId면 400을 응답한다", async () => {
    const res = await request(createTestApp())
      .post(`/api/problems/${UNSOLVED_PROBLEM_ID}/suggestions`)
      .set(AUTH_HEADER);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("validation_error");
  });

  it("정상 요청이면 200과 함께 questions 배열을 반환한다", async () => {
    const res = await request(createTestApp())
      .post(`/api/problems/${KNOWN_PROBLEM_ID}/suggestions`)
      .set(AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.questions)).toBe(true);
    expect(res.body.questions.length).toBeGreaterThan(0);
    for (const question of res.body.questions as unknown[]) {
      expect(typeof question).toBe("string");
    }
  });

  describe("내 방법(work → diagnose → resume) 흐름 이후", () => {
    beforeEach(() => {
      inMemoryProblemStore.set({
        problemId: RESUMED_PROBLEM_ID,
        userId: "user-1",
        grade: "M2",
        problem: { recognizedText: "2x - 1 = 5", recognizedLatex: null },
        createdAt: new Date().toISOString(),
      });
      inMemoryProblemStore.setResumeSolution(RESUMED_PROBLEM_ID, RESUME_SOLUTION);
    });

    it("resumeSolution만 있는 문제(verified=false 포함)도 200과 함께 이어풀기 풀이를 컨텍스트로 쓴다", async () => {
      const adapter = new FakeLLMAdapter();
      const suggestSpy = vi.spyOn(adapter, "suggestQuestions");

      const res = await request(createApp(adapter))
        .post(`/api/problems/${RESUMED_PROBLEM_ID}/suggestions`)
        .set(AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body.questions.length).toBeGreaterThan(0);
      expect(suggestSpy).toHaveBeenCalledTimes(1);
      const solution = suggestSpy.mock.calls[0]?.[0].solution;
      expect(solution?.answerMd).toBe(RESUME_SOLUTION.answerMd);
      expect(solution?.solutionMd).toBe(RESUME_SOLUTION.solutionMd);
      expect(solution?.conceptMd).toBeNull();
      expect(solution?.conceptTags).toEqual([]);
    });

    it("solution과 resumeSolution이 모두 있으면 solution을 우선한다", async () => {
      inMemoryProblemStore.setResumeSolution(KNOWN_PROBLEM_ID, RESUME_SOLUTION);
      const adapter = new FakeLLMAdapter();
      const suggestSpy = vi.spyOn(adapter, "suggestQuestions");

      const res = await request(createApp(adapter))
        .post(`/api/problems/${KNOWN_PROBLEM_ID}/suggestions`)
        .set(AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(suggestSpy.mock.calls[0]?.[0].solution.answerMd).toBe("2입니다.");
    });
  });
});
