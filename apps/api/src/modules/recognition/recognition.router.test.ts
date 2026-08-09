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

const AUTH_HEADER = { Authorization: "Bearer valid-token" };

// 실제 AI_PROVIDER 환경변수·실제 OpenAI 호출과 무관하게 결정적으로 동작하도록
// 모든 테스트에서 FakeLLMAdapter를 명시적으로 주입한다.
function createTestApp() {
  return createApp(new FakeLLMAdapter());
}

describe("POST /api/problems/recognize", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-1", user_metadata: { grade: "M2" } } },
      error: null,
    });
  });

  it("인증 헤더가 없으면 401을 응답한다", async () => {
    const app = createTestApp();

    const res = await request(app)
      .post("/api/problems/recognize")
      .field("inputType", "photo")
      .field("grade", "M2");

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("unauthorized");
  });

  it("이미지 파일이 없으면 400 validation_error를 응답한다", async () => {
    const app = createTestApp();

    const res = await request(app)
      .post("/api/problems/recognize")
      .set(AUTH_HEADER)
      .field("inputType", "photo")
      .field("grade", "M2");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("validation_error");
  });

  it("허용되지 않은 이미지 MIME 타입이면 400을 응답한다", async () => {
    const app = createTestApp();

    const res = await request(app)
      .post("/api/problems/recognize")
      .set(AUTH_HEADER)
      .field("inputType", "photo")
      .field("grade", "M2")
      .attach("image", Buffer.from("not-a-real-gif"), {
        filename: "test.gif",
        contentType: "image/gif",
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("validation_error");
  });

  it("grade가 유효하지 않으면 400 validation_error를 응답한다", async () => {
    const app = createTestApp();

    const res = await request(app)
      .post("/api/problems/recognize")
      .set(AUTH_HEADER)
      .field("inputType", "photo")
      .field("grade", "not-a-grade")
      .attach("image", Buffer.from("fake-jpeg-bytes"), {
        filename: "test.jpg",
        contentType: "image/jpeg",
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("validation_error");
  });

  it("정상 요청이면 200과 함께 문제 인식 결과를 반환한다", async () => {
    const app = createTestApp();

    const res = await request(app)
      .post("/api/problems/recognize")
      .set(AUTH_HEADER)
      .field("inputType", "photo")
      .field("grade", "M2")
      .attach("image", Buffer.from("fake-jpeg-bytes"), {
        filename: "test.jpg",
        contentType: "image/jpeg",
      });

    expect(res.status).toBe(200);
    expect(typeof res.body.problemId).toBe("string");
    expect(typeof res.body.recognizedText).toBe("string");
    expect(res.body).toHaveProperty("recognizedLatex");
    expect(typeof res.body.createdAt).toBe("string");
  });
});
