import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { Diagnosis } from "shared-types";

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

const BASE_DIAGNOSIS: Diagnosis = {
  lastValidLine: 1,
  stallLine: null,
  errorTypeLabel: null,
  errorDetail: null,
  relatedConcepts: [],
  reachedAnswerWithNotes: false,
  isLowConfidence: false,
  conceptExplanations: [],
  identifiedMethod: { methodId: "perfect-square", methodName: "완전제곱식" },
  isMethodApplicable: true,
  methodApplicabilityNote: null,
};

// 실제 AI_PROVIDER 환경변수·실제 OpenAI 호출과 무관하게 결정적으로 동작하도록
// 모든 테스트에서 FakeLLMAdapter를 명시적으로 주입한다.
function createTestApp() {
  return createApp(new FakeLLMAdapter());
}

describe("POST /api/problems/:problemId/resume", () => {
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
      problem: { recognizedText: "이차함수 y = x^2 - 4x + 3의 최솟값을 구하시오.", recognizedLatex: null },
      createdAt: new Date().toISOString(),
      workLines: [{ lineNo: 1, latex: "y = x^{2} - 4x + 3", isLowConfidence: false }],
      diagnosis: BASE_DIAGNOSIS,
    });
  });

  it("인증 헤더가 없으면 401을 응답한다", async () => {
    const app = createTestApp();

    const res = await request(app)
      .post(`/api/problems/${KNOWN_PROBLEM_ID}/resume`)
      .send({ mode: "own" });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("unauthorized");
  });

  it("mode가 유효하지 않으면 400 validation_error를 응답한다", async () => {
    const app = createTestApp();

    const res = await request(app)
      .post(`/api/problems/${KNOWN_PROBLEM_ID}/resume`)
      .set(AUTH_HEADER)
      .send({ mode: "invalid" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("validation_error");
  });

  it("존재하지 않는 problemId면 404를 응답한다", async () => {
    const app = createTestApp();

    const res = await request(app)
      .post("/api/problems/does-not-exist/resume")
      .set(AUTH_HEADER)
      .send({ mode: "own" });

    expect(res.status).toBe(404);
  });

  it("다른 사용자의 problemId면 404를 응답한다(소유권 검증)", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-2", user_metadata: { grade: "M2" } } },
      error: null,
    });
    const app = createTestApp();

    const res = await request(app)
      .post(`/api/problems/${KNOWN_PROBLEM_ID}/resume`)
      .set(AUTH_HEADER)
      .send({ mode: "own" });

    expect(res.status).toBe(404);
  });

  it("적용 불가 진단(isMethodApplicable: false)에 mode: own으로 요청하면 400 validation_error를 응답한다(RESUME-4 서버 방어)", async () => {
    inMemoryProblemStore.set({
      problemId: "not-applicable",
      userId: "user-1",
      grade: "M2",
      problem: { recognizedText: "이차함수 y = x^2 - 4x + 3의 최솟값을 구하시오.", recognizedLatex: null },
      createdAt: new Date().toISOString(),
      workLines: [{ lineNo: 1, latex: "y = x^{2} - 4x + 3", isLowConfidence: false }],
      diagnosis: {
        ...BASE_DIAGNOSIS,
        isMethodApplicable: false,
        methodApplicabilityNote: "이 방법은 이 문제 유형에 적용할 수 없습니다.",
      },
    });
    const app = createTestApp();

    const res = await request(app)
      .post("/api/problems/not-applicable/resume")
      .set(AUTH_HEADER)
      .send({ mode: "own" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("validation_error");
  });

  it("적용 불가 진단(isMethodApplicable: false)이어도 mode: alternative 요청은 정상 처리된다", async () => {
    inMemoryProblemStore.set({
      problemId: "not-applicable-alt",
      userId: "user-1",
      grade: "M2",
      problem: { recognizedText: "이차함수 y = x^2 - 4x + 3의 최솟값을 구하시오.", recognizedLatex: null },
      createdAt: new Date().toISOString(),
      workLines: [{ lineNo: 1, latex: "y = x^{2} - 4x + 3", isLowConfidence: false }],
      diagnosis: {
        ...BASE_DIAGNOSIS,
        isMethodApplicable: false,
        methodApplicabilityNote: "이 방법은 이 문제 유형에 적용할 수 없습니다.",
      },
    });
    const app = createTestApp();

    const res = await request(app)
      .post("/api/problems/not-applicable-alt/resume")
      .set(AUTH_HEADER)
      .send({ mode: "alternative" });

    expect(res.status).toBe(200);
  });

  it("아직 진단(diagnose)이 끝나지 않은 문제면 404를 응답한다", async () => {
    inMemoryProblemStore.set({
      problemId: "no-diagnosis-yet",
      userId: "user-1",
      grade: "M2",
      problem: { recognizedText: "1+1=?", recognizedLatex: null },
      createdAt: new Date().toISOString(),
    });
    const app = createTestApp();

    const res = await request(app)
      .post("/api/problems/no-diagnosis-yet/resume")
      .set(AUTH_HEADER)
      .send({ mode: "own" });

    expect(res.status).toBe(404);
  });

  it("정상 요청(mode: own)이면 SSE로 chunk 이벤트들과 마지막 done 이벤트를 스트리밍하고 verified: true를 포함한다", async () => {
    const app = createTestApp();

    const res = await request(app)
      .post(`/api/problems/${KNOWN_PROBLEM_ID}/resume`)
      .set(AUTH_HEADER)
      .send({ mode: "own" });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/event-stream");
    expect(res.text).toContain("event: chunk");
    expect(res.text).toContain("event: done");

    const doneMatch = res.text.match(/event: done\ndata: (.+)\n\n/);
    expect(doneMatch).not.toBeNull();
    if (doneMatch) {
      const result = JSON.parse(doneMatch[1] ?? "{}") as {
        mode: string;
        methodName: string;
        solutionMd: string;
        answerMd: string;
        verified: boolean;
      };
      expect(result.mode).toBe("own");
      expect(result.methodName.length).toBeGreaterThan(0);
      expect(result.answerMd.length).toBeGreaterThan(0);
      // stubResumeCasCheck가 항상 true를 반환하므로 verified가 true로 덮어써져야 한다.
      expect(result.verified).toBe(true);
    }
  });

  it("mode: alternative로 요청하면 done 이벤트의 mode도 alternative다", async () => {
    const app = createTestApp();

    const res = await request(app)
      .post(`/api/problems/${KNOWN_PROBLEM_ID}/resume`)
      .set(AUTH_HEADER)
      .send({ mode: "alternative" });

    expect(res.status).toBe(200);

    const doneMatch = res.text.match(/event: done\ndata: (.+)\n\n/);
    expect(doneMatch).not.toBeNull();
    if (doneMatch) {
      const result = JSON.parse(doneMatch[1] ?? "{}") as { mode: string };
      expect(result.mode).toBe("alternative");
    }
  });

  it("done 이벤트 시점에 이어풀기 결과를 저장소에 저장한다", async () => {
    const app = createTestApp();

    expect(inMemoryProblemStore.get(KNOWN_PROBLEM_ID)?.resumeSolution).toBeUndefined();

    const res = await request(app)
      .post(`/api/problems/${KNOWN_PROBLEM_ID}/resume`)
      .set(AUTH_HEADER)
      .send({ mode: "own" });

    expect(res.status).toBe(200);

    const stored = inMemoryProblemStore.get(KNOWN_PROBLEM_ID);
    expect(stored?.resumeSolution).toBeDefined();
    expect(stored?.resumeSolution?.verified).toBe(true);
  });
});
