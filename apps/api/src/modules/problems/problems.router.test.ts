import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const getUserMock = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: getUserMock },
  })),
}));

// 이 라우터는 AI 어댑터를 쓰지 않으므로 repository 계층 자체를 모듈 mock으로 대체한다.
// vi.mock 팩토리는 호이스팅되므로 mock 함수도 vi.hoisted로 함께 끌어올린다.
const { listProblemsMock, getProblemDetailMock, saveProblemMock, deleteProblemsMock } = vi.hoisted(
  () => ({
    listProblemsMock: vi.fn(),
    getProblemDetailMock: vi.fn(),
    saveProblemMock: vi.fn(),
    deleteProblemsMock: vi.fn(),
  }),
);

vi.mock("../../infrastructure/persistence/problemRepository", () => ({
  problemRepository: {
    listProblems: listProblemsMock,
    getProblemDetail: getProblemDetailMock,
    saveProblem: saveProblemMock,
    saveSolution: vi.fn(),
    saveChatTurn: vi.fn(),
    deleteProblems: deleteProblemsMock,
  },
}));

// reopen 라우트가 메모리 저장소를 다시 채우는지 확인하기 위해 저장소도 모듈 mock으로 대체한다.
const { storeSetMock } = vi.hoisted(() => ({ storeSetMock: vi.fn() }));

vi.mock("../../infrastructure/store/inMemoryProblemStore", () => ({
  inMemoryProblemStore: {
    set: storeSetMock,
    get: vi.fn(),
    setSolution: vi.fn(),
    clear: vi.fn(),
  },
}));

const { createApp } = await import("../../app");
const { FakeLLMAdapter } = await import("../../infrastructure/ai/fake-adapter");

const AUTH_HEADER = { Authorization: "Bearer valid-token" };

function createTestApp() {
  return createApp(new FakeLLMAdapter());
}

describe("GET /api/problems", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-1", user_metadata: { grade: "M2" } } },
      error: null,
    });
    listProblemsMock.mockReset();
    getProblemDetailMock.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("인증 헤더가 없으면 401을 응답한다", async () => {
    const res = await request(createTestApp()).get("/api/problems");

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("unauthorized");
    expect(listProblemsMock).not.toHaveBeenCalled();
  });

  it("로그인 사용자의 풀이 이력 목록을 200으로 응답한다", async () => {
    listProblemsMock.mockResolvedValue([
      {
        problemId: "problem-1",
        recognizedText: "2x + 1 = 5",
        conceptTags: ["일차방정식"],
        createdAt: "2026-08-16T00:00:00.000Z",
      },
    ]);

    const res = await request(createTestApp()).get("/api/problems").set(AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      items: [
        {
          problemId: "problem-1",
          recognizedText: "2x + 1 = 5",
          conceptTags: ["일차방정식"],
          createdAt: "2026-08-16T00:00:00.000Z",
        },
      ],
    });
    expect(listProblemsMock).toHaveBeenCalledWith("user-1");
  });

  it("조회가 실패하면 원본 에러 메시지를 노출하지 않고 500을 응답한다", async () => {
    listProblemsMock.mockRejectedValue(new Error("permission denied for table problems"));

    const res = await request(createTestApp()).get("/api/problems").set(AUTH_HEADER);

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("internal_error");
    expect(res.body.error.message).toBe("풀이 기록을 불러오지 못했습니다.");
    expect(JSON.stringify(res.body)).not.toContain("permission denied");
  });
});

describe("GET /api/problems/:problemId", () => {
  const DETAIL = {
    problemId: "problem-1",
    recognizedText: "2x + 1 = 5",
    recognizedLatex: "2x+1=5",
    createdAt: "2026-08-16T00:00:00.000Z",
    solution: {
      conceptMd: "개념 설명",
      solutionMd: "풀이 과정",
      answerMd: "42",
      conceptTags: ["일차방정식"],
      aiProvider: "openai",
      aiModel: "gpt-test",
    },
    chatMessages: [
      { role: "user", content: "왜요?", createdAt: "2026-08-16T00:01:00.000Z" },
      { role: "assistant", content: "이항했어요.", createdAt: "2026-08-16T00:02:00.000Z" },
    ],
  };

  beforeEach(() => {
    getUserMock.mockReset();
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-1", user_metadata: { grade: "M2" } } },
      error: null,
    });
    listProblemsMock.mockReset();
    getProblemDetailMock.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("인증 헤더가 없으면 401을 응답한다", async () => {
    const res = await request(createTestApp()).get("/api/problems/problem-1");

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("unauthorized");
    expect(getProblemDetailMock).not.toHaveBeenCalled();
  });

  it("풀이 이력 상세를 200으로 응답한다", async () => {
    getProblemDetailMock.mockResolvedValue(DETAIL);

    const res = await request(createTestApp()).get("/api/problems/problem-1").set(AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(DETAIL);
    expect(getProblemDetailMock).toHaveBeenCalledWith("user-1", "problem-1");
  });

  it("repository가 null을 반환하면(없거나 타인 소유) 404를 응답한다", async () => {
    getProblemDetailMock.mockResolvedValue(null);

    const res = await request(createTestApp()).get("/api/problems/problem-9").set(AUTH_HEADER);

    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe("풀이 기록을 찾을 수 없습니다.");
  });

  it("조회가 실패하면 원본 에러 메시지를 노출하지 않고 500을 응답한다", async () => {
    getProblemDetailMock.mockRejectedValue(new Error("connection reset by peer"));

    const res = await request(createTestApp()).get("/api/problems/problem-1").set(AUTH_HEADER);

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("internal_error");
    expect(JSON.stringify(res.body)).not.toContain("connection reset");
  });
});

describe("POST /api/problems/:problemId/reopen", () => {
  const DETAIL = {
    problemId: "problem-1",
    recognizedText: "2x + 1 = 5",
    recognizedLatex: "2x+1=5",
    createdAt: "2026-08-16T00:00:00.000Z",
    solution: {
      conceptMd: "개념 설명",
      solutionMd: "풀이 과정",
      answerMd: "42",
      conceptTags: ["일차방정식"],
      aiProvider: "openai",
      aiModel: "gpt-test",
    },
    chatMessages: [],
  };

  beforeEach(() => {
    getUserMock.mockReset();
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-1", user_metadata: { grade: "M2" } } },
      error: null,
    });
    getProblemDetailMock.mockReset();
    storeSetMock.mockReset();
    saveProblemMock.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("인증 헤더가 없으면 401을 응답한다", async () => {
    const res = await request(createTestApp()).post("/api/problems/problem-1/reopen");

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("unauthorized");
    expect(getProblemDetailMock).not.toHaveBeenCalled();
    expect(storeSetMock).not.toHaveBeenCalled();
  });

  it("새 problemId를 발급해 메모리 저장소/DB에 새 문제로 등록하고 200으로 응답한다(원본 기록 보존, Final QA HIGH-1)", async () => {
    getProblemDetailMock.mockResolvedValue(DETAIL);

    const res = await request(createTestApp())
      .post("/api/problems/problem-1/reopen")
      .set(AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(getProblemDetailMock).toHaveBeenCalledWith("user-1", "problem-1");
    // 원본 problemId를 재사용하지 않는다 — 재사용하면 solve 완료 시 saveSolution이 원본 풀이를
    // 덮어써 버린다(HIGH-1). 새 id가 발급됐는지만 확인하고(형태는 uuid), 값 자체는 검증하지 않는다.
    expect(typeof res.body.problemId).toBe("string");
    expect(res.body.problemId).not.toBe("problem-1");
    expect(res.body.recognizedText).toBe("2x + 1 = 5");
    expect(res.body.recognizedLatex).toBe("2x+1=5");
    // 저장 당시가 아니라 재수화 시점의 createdAt을 새로 부여한다.
    expect(typeof res.body.createdAt).toBe("string");
    expect(res.body.createdAt).not.toBe(DETAIL.createdAt);

    expect(storeSetMock).toHaveBeenCalledTimes(1);
    expect(storeSetMock).toHaveBeenCalledWith({
      problemId: res.body.problemId,
      userId: "user-1",
      // 저장 당시 학년이 아니라 현재 로그인 사용자의 학년을 쓴다.
      grade: "M2",
      problem: { recognizedText: "2x + 1 = 5", recognizedLatex: "2x+1=5" },
      createdAt: res.body.createdAt,
    });

    // solve 완료 시 saveSolution이 FK 위반으로 조용히 실패하지 않도록 새 problems 행도 저장한다.
    expect(saveProblemMock).toHaveBeenCalledTimes(1);
    expect(saveProblemMock).toHaveBeenCalledWith({
      problemId: res.body.problemId,
      userId: "user-1",
      grade: "M2",
      inputType: "handwriting",
      problem: { recognizedText: "2x + 1 = 5", recognizedLatex: "2x+1=5" },
      createdAt: res.body.createdAt,
    });
  });

  it("repository가 null을 반환하면(없거나 타인 소유) 404를 응답한다", async () => {
    getProblemDetailMock.mockResolvedValue(null);

    const res = await request(createTestApp())
      .post("/api/problems/problem-9/reopen")
      .set(AUTH_HEADER);

    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe("풀이 기록을 찾을 수 없습니다.");
    expect(storeSetMock).not.toHaveBeenCalled();
  });

  it("조회가 실패하면 원본 에러 메시지를 노출하지 않고 500을 응답한다", async () => {
    getProblemDetailMock.mockRejectedValue(new Error("connection reset by peer"));

    const res = await request(createTestApp())
      .post("/api/problems/problem-1/reopen")
      .set(AUTH_HEADER);

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("internal_error");
    expect(JSON.stringify(res.body)).not.toContain("connection reset");
    expect(storeSetMock).not.toHaveBeenCalled();
  });

  it("학년 정보가 없으면 400을 응답한다", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-1", user_metadata: {} } },
      error: null,
    });

    const res = await request(createTestApp())
      .post("/api/problems/problem-1/reopen")
      .set(AUTH_HEADER);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("validation_error");
    expect(res.body.error.message).toBe("학년 정보가 필요합니다.");
    expect(getProblemDetailMock).not.toHaveBeenCalled();
    expect(storeSetMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/problems/bulk-delete", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-1", user_metadata: { grade: "M2" } } },
      error: null,
    });
    deleteProblemsMock.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("인증 헤더가 없으면 401을 응답한다", async () => {
    const res = await request(createTestApp())
      .post("/api/problems/bulk-delete")
      .send({ problemIds: ["problem-1"] });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("unauthorized");
    expect(deleteProblemsMock).not.toHaveBeenCalled();
  });

  it("problemIds가 빈 배열이면 400을 응답한다", async () => {
    const res = await request(createTestApp())
      .post("/api/problems/bulk-delete")
      .set(AUTH_HEADER)
      .send({ problemIds: [] });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("validation_error");
    expect(deleteProblemsMock).not.toHaveBeenCalled();
  });

  it("본인 소유 문제를 정상 삭제하면 삭제된 problemId 목록을 200으로 응답한다", async () => {
    deleteProblemsMock.mockResolvedValue(["problem-1", "problem-2"]);

    const res = await request(createTestApp())
      .post("/api/problems/bulk-delete")
      .set(AUTH_HEADER)
      .send({ problemIds: ["problem-1", "problem-2"] });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ deletedProblemIds: ["problem-1", "problem-2"] });
    expect(deleteProblemsMock).toHaveBeenCalledWith("user-1", ["problem-1", "problem-2"]);
  });

  it("존재하지 않는 problemId만 요청하면(삭제된 것이 없으면) 404를 응답한다", async () => {
    deleteProblemsMock.mockResolvedValue([]);

    const res = await request(createTestApp())
      .post("/api/problems/bulk-delete")
      .set(AUTH_HEADER)
      .send({ problemIds: ["problem-nonexistent"] });

    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe("삭제할 풀이 기록을 찾을 수 없습니다.");
  });

  it("타인 소유 problemId만 요청하면(삭제된 것이 없으면) 존재하지 않는 경우와 동일하게 404를 응답한다", async () => {
    // 저장소가 본인 소유가 아닌 행은 삭제하지 않고 빈 배열을 돌려준다 — 없음/타인 소유를 구분하지 않는다.
    deleteProblemsMock.mockResolvedValue([]);

    const res = await request(createTestApp())
      .post("/api/problems/bulk-delete")
      .set(AUTH_HEADER)
      .send({ problemIds: ["problem-owned-by-someone-else"] });

    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe("삭제할 풀이 기록을 찾을 수 없습니다.");
    expect(deleteProblemsMock).toHaveBeenCalledWith("user-1", ["problem-owned-by-someone-else"]);
  });

  it("일부만 삭제돼도(존재하지 않는 id 일부 포함) 실제로 삭제된 id만 담아 200을 응답한다", async () => {
    deleteProblemsMock.mockResolvedValue(["problem-1"]);

    const res = await request(createTestApp())
      .post("/api/problems/bulk-delete")
      .set(AUTH_HEADER)
      .send({ problemIds: ["problem-1", "problem-nonexistent"] });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ deletedProblemIds: ["problem-1"] });
  });

  it("삭제가 실패하면 원본 에러 메시지를 노출하지 않고 500을 응답한다", async () => {
    deleteProblemsMock.mockRejectedValue(new Error("connection reset by peer"));

    const res = await request(createTestApp())
      .post("/api/problems/bulk-delete")
      .set(AUTH_HEADER)
      .send({ problemIds: ["problem-1"] });

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("internal_error");
    expect(JSON.stringify(res.body)).not.toContain("connection reset");
  });
});
