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
const KNOWN_PROBLEM_ID = "22222222-2222-4222-8222-222222222222";
const UNSOLVED_PROBLEM_ID = "33333333-3333-4333-8333-333333333333";

// 실제 AI_PROVIDER 환경변수·실제 OpenAI 호출과 무관하게 결정적으로 동작하도록
// 모든 테스트에서 FakeLLMAdapter를 명시적으로 주입한다.
function createTestApp() {
  return createApp(new FakeLLMAdapter());
}

describe("POST /api/problems/:problemId/chat", () => {
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
    const app = createTestApp();

    const res = await request(app)
      .post(`/api/problems/${KNOWN_PROBLEM_ID}/chat`)
      .send({ question: "왜 2인가요?", history: [] });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("unauthorized");
  });

  it("question이 비어 있으면 400 validation_error를 응답한다", async () => {
    const app = createTestApp();

    const res = await request(app)
      .post(`/api/problems/${KNOWN_PROBLEM_ID}/chat`)
      .set(AUTH_HEADER)
      .send({ question: "", history: [] });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("validation_error");
  });

  it("history의 role이 유효하지 않으면 400 validation_error를 응답한다", async () => {
    const app = createTestApp();

    const res = await request(app)
      .post(`/api/problems/${KNOWN_PROBLEM_ID}/chat`)
      .set(AUTH_HEADER)
      .send({ question: "왜 2인가요?", history: [{ role: "system", content: "hi" }] });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("validation_error");
  });

  it("history를 생략하면 빈 배열로 기본 처리되어 정상 동작한다", async () => {
    const app = createTestApp();

    const res = await request(app)
      .post(`/api/problems/${KNOWN_PROBLEM_ID}/chat`)
      .set(AUTH_HEADER)
      .send({ question: "왜 2인가요?" });

    expect(res.status).toBe(200);
  });

  it("존재하지 않는 problemId면 404를 응답한다", async () => {
    const app = createTestApp();

    const res = await request(app)
      .post("/api/problems/does-not-exist/chat")
      .set(AUTH_HEADER)
      .send({ question: "왜 2인가요?", history: [] });

    expect(res.status).toBe(404);
  });

  it("다른 사용자의 problemId면 404를 응답한다(소유권 검증, Final QA BLOCKER-1)", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-2", user_metadata: { grade: "M2" } } },
      error: null,
    });
    const app = createTestApp();

    const res = await request(app)
      .post(`/api/problems/${KNOWN_PROBLEM_ID}/chat`)
      .set(AUTH_HEADER)
      .send({ question: "왜 2인가요?", history: [] });

    expect(res.status).toBe(404);
  });

  it("풀이가 아직 없는 problemId면 400을 응답한다", async () => {
    const app = createTestApp();

    const res = await request(app)
      .post(`/api/problems/${UNSOLVED_PROBLEM_ID}/chat`)
      .set(AUTH_HEADER)
      .send({ question: "왜 4인가요?", history: [] });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("validation_error");
  });

  it("정상 요청이면 200과 함께 answerMd를 반환한다(일반 JSON, SSE 아님)", async () => {
    const app = createTestApp();

    const res = await request(app)
      .post(`/api/problems/${KNOWN_PROBLEM_ID}/chat`)
      .set(AUTH_HEADER)
      .send({
        question: "왜 답이 2인가요?",
        history: [
          { role: "user", content: "1+1은 뭐예요?" },
          { role: "assistant", content: "2입니다." },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/json");
    expect(typeof res.body.answerMd).toBe("string");
    expect(res.body.answerMd.length).toBeGreaterThan(0);
  });
});
