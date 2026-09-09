import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const getUserMock = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: getUserMock },
  })),
}));

// 소프트 캡(하루 10회, 오너 확정) 테스트를 위해 problemRepository 전체를 모킹한다 — 실제 supabase
// 쿼리 흐름과 분리해서 `countProblemsCreatedToday`가 반환하는 값만 결정적으로 통제하기 위함이다.
// `saveProblem`은 이 라우터가 호출하는 유일한 다른 메서드라 no-op으로만 채운다.
const saveProblemMock = vi.fn().mockResolvedValue(undefined);
const countProblemsCreatedTodayMock = vi.fn().mockResolvedValue(0);

vi.mock("../../infrastructure/persistence/problemRepository", () => ({
  problemRepository: {
    saveProblem: saveProblemMock,
    countProblemsCreatedToday: countProblemsCreatedTodayMock,
  },
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
    saveProblemMock.mockReset().mockResolvedValue(undefined);
    countProblemsCreatedTodayMock.mockReset().mockResolvedValue(0);
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

  describe("소프트 캡(하루 10회) 안내", () => {
    function attachRecognizeRequest(app: ReturnType<typeof createTestApp>) {
      return request(app)
        .post("/api/problems/recognize")
        .set(AUTH_HEADER)
        .field("inputType", "photo")
        .field("grade", "M2")
        .attach("image", Buffer.from("fake-jpeg-bytes"), {
          filename: "test.jpg",
          contentType: "image/jpeg",
        });
    }

    it("오늘 누적 횟수가 한도 이하면 dailyUsageCount/dailyUsageLimit을 그대로 응답한다", async () => {
      countProblemsCreatedTodayMock.mockResolvedValueOnce(3);
      const app = createTestApp();

      const res = await attachRecognizeRequest(app);

      expect(res.status).toBe(200);
      expect(res.body.dailyUsageCount).toBe(3);
      expect(res.body.dailyUsageLimit).toBe(10);
    });

    it("오늘 누적 횟수가 11회째(한도 초과)여도 인식을 차단하지 않고 카운트만 그대로 응답한다", async () => {
      countProblemsCreatedTodayMock.mockResolvedValueOnce(11);
      const app = createTestApp();

      const res = await attachRecognizeRequest(app);

      expect(res.status).toBe(200);
      expect(res.body.dailyUsageCount).toBe(11);
      expect(res.body.dailyUsageLimit).toBe(10);
    });

    it("카운트 조회가 실패해도 인식 응답 자체는 200으로 성공하고 카운트 필드는 생략된다", async () => {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      countProblemsCreatedTodayMock.mockRejectedValueOnce(new Error("count 조회 실패"));
      const app = createTestApp();

      const res = await attachRecognizeRequest(app);

      expect(res.status).toBe(200);
      expect(res.body.dailyUsageCount).toBeUndefined();
      expect(res.body.dailyUsageLimit).toBeUndefined();
    });
  });
});
