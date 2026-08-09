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
const KNOWN_PROBLEM_ID = "11111111-1111-4111-8111-111111111111";

// 실제 AI_PROVIDER 환경변수·실제 OpenAI 호출과 무관하게 결정적으로 동작하도록
// 모든 테스트에서 FakeLLMAdapter를 명시적으로 주입한다.
function createTestApp() {
  return createApp(new FakeLLMAdapter());
}

describe("POST /api/problems/:problemId/solve", () => {
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
  });

  it("인증 헤더가 없으면 401을 응답한다", async () => {
    const app = createTestApp();

    const res = await request(app)
      .post(`/api/problems/${KNOWN_PROBLEM_ID}/solve`)
      .send({ options: { concept: true, solution: true } });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("unauthorized");
  });

  it("options가 유효하지 않으면 400 validation_error를 응답한다", async () => {
    const app = createTestApp();

    const res = await request(app)
      .post(`/api/problems/${KNOWN_PROBLEM_ID}/solve`)
      .set(AUTH_HEADER)
      .send({ options: { concept: "yes" } });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("validation_error");
  });

  it("존재하지 않는 problemId면 404를 응답한다", async () => {
    const app = createTestApp();

    const res = await request(app)
      .post("/api/problems/does-not-exist/solve")
      .set(AUTH_HEADER)
      .send({ options: { concept: true, solution: true } });

    expect(res.status).toBe(404);
  });

  it("정상 요청이면 SSE로 chunk 이벤트들과 마지막 done 이벤트를 스트리밍한다", async () => {
    const app = createTestApp();

    const res = await request(app)
      .post(`/api/problems/${KNOWN_PROBLEM_ID}/solve`)
      .set(AUTH_HEADER)
      .send({ options: { concept: true, solution: true } });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/event-stream");
    expect(res.text).toContain("event: chunk");
    expect(res.text).toContain("event: done");

    const doneMatch = res.text.match(/event: done\ndata: (.+)\n\n/);
    expect(doneMatch).not.toBeNull();
    if (doneMatch) {
      const result = JSON.parse(doneMatch[1] ?? "{}") as { aiProvider: string; answerMd: string };
      expect(["openai", "claude"]).toContain(result.aiProvider);
      expect(result.answerMd.length).toBeGreaterThan(0);
    }
  });

  it("confirmedText가 있으면 그 텍스트를 문제로 사용해 풀이한다", async () => {
    const app = createTestApp();

    const res = await request(app)
      .post(`/api/problems/${KNOWN_PROBLEM_ID}/solve`)
      .set(AUTH_HEADER)
      .send({ options: { concept: false, solution: true }, confirmedText: "2+2=?" });

    expect(res.status).toBe(200);
    expect(res.text).toContain("event: done");
  });
});
