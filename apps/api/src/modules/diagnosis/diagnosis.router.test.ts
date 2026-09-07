import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { CasStepVerification, WorkLine } from "shared-types";

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
const KNOWN_PROBLEM_ID = "33333333-3333-4333-8333-333333333333";

// 실제 AI_PROVIDER 환경변수·실제 OpenAI 호출과 무관하게 결정적으로 동작하도록
// 모든 테스트에서 FakeLLMAdapter를 명시적으로 주입한다.
function createTestApp(casClient?: import("../../infrastructure/cas/casClient").CasClient) {
  return casClient ? createApp(new FakeLLMAdapter(), casClient) : createApp(new FakeLLMAdapter());
}

/**
 * `fetch`를 모킹하지 않고, `CasClient`를 라우터(→ `createApp`)에 직접 주입해 실제 CAS 연동 지점
 * (`stubCasVerification` 호출 자리)이 `casClient.verifyWorkLines()`로 교체됐는지 검증한다.
 */
function createFakeCasClient(verifyWorkLinesResult: CasStepVerification[]) {
  const verifyWorkLines = vi.fn((_lines: WorkLine[]) => Promise.resolve(verifyWorkLinesResult));
  const verifyFinalAnswer = vi.fn(() => Promise.resolve({ verified: true }));
  return { verifyWorkLines, verifyFinalAnswer };
}

describe("POST /api/problems/:problemId/diagnose", () => {
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

  const validBody = {
    workLines: [
      { lineNo: 1, latex: "y = x^{2} - 4x + 3" },
      { lineNo: 2, latex: "y = (x - 2)^{2} - 1" },
    ],
  };

  it("인증 헤더가 없으면 401을 응답한다", async () => {
    const app = createTestApp();

    const res = await request(app)
      .post(`/api/problems/${KNOWN_PROBLEM_ID}/diagnose`)
      .send(validBody);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("unauthorized");
  });

  it("workLines가 유효하지 않으면 400 validation_error를 응답한다", async () => {
    const app = createTestApp();

    const res = await request(app)
      .post(`/api/problems/${KNOWN_PROBLEM_ID}/diagnose`)
      .set(AUTH_HEADER)
      .send({ workLines: [{ lineNo: "1", latex: "x" }] });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("validation_error");
  });

  it("존재하지 않는 problemId면 404를 응답한다", async () => {
    const app = createTestApp();

    const res = await request(app)
      .post("/api/problems/does-not-exist/diagnose")
      .set(AUTH_HEADER)
      .send(validBody);

    expect(res.status).toBe(404);
  });

  it("다른 사용자의 problemId면 404를 응답한다(소유권 검증)", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-2", user_metadata: { grade: "M2" } } },
      error: null,
    });
    const app = createTestApp();

    const res = await request(app)
      .post(`/api/problems/${KNOWN_PROBLEM_ID}/diagnose`)
      .set(AUTH_HEADER)
      .send(validBody);

    expect(res.status).toBe(404);
  });

  it("정상 요청이면 200과 함께 진단 결과 7필드를 반환하고 저장소에 저장한다", async () => {
    const app = createTestApp();

    const res = await request(app)
      .post(`/api/problems/${KNOWN_PROBLEM_ID}/diagnose`)
      .set(AUTH_HEADER)
      .send(validBody);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("lastValidLine");
    expect(res.body).toHaveProperty("stallLine");
    expect(res.body).toHaveProperty("errorTypeLabel");
    expect(res.body).toHaveProperty("errorDetail");
    expect(res.body).toHaveProperty("relatedConcepts");
    expect(res.body).toHaveProperty("reachedAnswerWithNotes");
    expect(res.body).toHaveProperty("isLowConfidence");
    expect(res.body).toHaveProperty("identifiedMethod");
    expect(res.body).toHaveProperty("isMethodApplicable");
    expect(res.body).toHaveProperty("methodApplicabilityNote");
    expect(res.body).toHaveProperty("problemAnswerLatex");

    // stubCasVerification이 모든 줄을 valid로 처리하므로 오류 없이 마지막 줄까지 유효해야 한다.
    expect(res.body.lastValidLine).toBe(2);
    expect(res.body.stallLine).toBeNull();

    const stored = inMemoryProblemStore.get(KNOWN_PROBLEM_ID);
    expect(stored?.diagnosis).toEqual(res.body);
  });

  it("주입된 CasClient.verifyWorkLines()를 호출하고, 그 결과(CAS 검증)를 그대로 반영한다(fetch 모킹 없이 검증)", async () => {
    const casClient = createFakeCasClient([
      { lineNo: 1, isValid: true },
      { lineNo: 2, isValid: false },
    ]);
    const app = createTestApp(casClient);

    const res = await request(app)
      .post(`/api/problems/${KNOWN_PROBLEM_ID}/diagnose`)
      .set(AUTH_HEADER)
      .send(validBody);

    expect(res.status).toBe(200);
    expect(casClient.verifyWorkLines).toHaveBeenCalledTimes(1);
    expect(casClient.verifyWorkLines.mock.calls[0]?.[0]).toEqual([
      { lineNo: 1, latex: "y = x^{2} - 4x + 3", isLowConfidence: false },
      { lineNo: 2, latex: "y = (x - 2)^{2} - 1", isLowConfidence: false },
    ]);
    // FakeLLMAdapter.diagnose()는 casVerification을 그대로 반영하므로, 2번째 줄이 무효면
    // lastValidLine은 1, stallLine은 2가 돼야 한다.
    expect(res.body.lastValidLine).toBe(1);
    expect(res.body.stallLine).toBe(2);
  });
});
