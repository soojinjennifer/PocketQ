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

// 실제 AI_PROVIDER 환경변수·실제 OpenAI 호출과 무관하게 결정적으로 동작하도록
// 모든 테스트에서 FakeLLMAdapter를 명시적으로 주입한다.
function createTestApp() {
  return createApp(new FakeLLMAdapter());
}

describe("POST /api/problems/:problemId/work-lines", () => {
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

    const res = await request(app).post(`/api/problems/${KNOWN_PROBLEM_ID}/work-lines`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("unauthorized");
  });

  it("이미지 파일이 없으면 400 validation_error를 응답한다", async () => {
    const app = createTestApp();

    const res = await request(app)
      .post(`/api/problems/${KNOWN_PROBLEM_ID}/work-lines`)
      .set(AUTH_HEADER);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("validation_error");
  });

  it("허용되지 않은 이미지 MIME 타입이면 400을 응답한다", async () => {
    const app = createTestApp();

    const res = await request(app)
      .post(`/api/problems/${KNOWN_PROBLEM_ID}/work-lines`)
      .set(AUTH_HEADER)
      .attach("image", Buffer.from("not-a-real-gif"), {
        filename: "test.gif",
        contentType: "image/gif",
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("validation_error");
  });

  it("존재하지 않는 problemId면 404를 응답한다", async () => {
    const app = createTestApp();

    const res = await request(app)
      .post("/api/problems/does-not-exist/work-lines")
      .set(AUTH_HEADER)
      .attach("image", Buffer.from("fake-jpeg-bytes"), {
        filename: "test.jpg",
        contentType: "image/jpeg",
      });

    expect(res.status).toBe(404);
  });

  it("다른 사용자의 problemId면 404를 응답한다(소유권 검증)", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-2", user_metadata: { grade: "M2" } } },
      error: null,
    });
    const app = createTestApp();

    const res = await request(app)
      .post(`/api/problems/${KNOWN_PROBLEM_ID}/work-lines`)
      .set(AUTH_HEADER)
      .attach("image", Buffer.from("fake-jpeg-bytes"), {
        filename: "test.jpg",
        contentType: "image/jpeg",
      });

    expect(res.status).toBe(404);
  });

  it("정상 요청이면 200과 함께 줄 단위 인식 결과를 반환하고 저장소에 저장한다", async () => {
    const app = createTestApp();

    const res = await request(app)
      .post(`/api/problems/${KNOWN_PROBLEM_ID}/work-lines`)
      .set(AUTH_HEADER)
      .attach("image", Buffer.from("fake-jpeg-bytes"), {
        filename: "test.jpg",
        contentType: "image/jpeg",
      });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.workLines)).toBe(true);
    expect(res.body.workLines.length).toBeGreaterThan(0);
    for (const line of res.body.workLines) {
      expect(typeof line.lineNo).toBe("number");
      expect(typeof line.latex).toBe("string");
      expect(typeof line.isLowConfidence).toBe("boolean");
    }

    const stored = inMemoryProblemStore.get(KNOWN_PROBLEM_ID);
    expect(stored?.workLines).toEqual(res.body.workLines);
  });
});
