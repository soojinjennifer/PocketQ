import { beforeEach, describe, expect, it, vi } from "vitest";
import { problemHistoryDetailSchema } from "validation";
import { F01_TRIANGLE_ANGLE, F09_STEPWISE_AUXILIARY } from "validation/src/figures/fixtures";
import { ApiError } from "./ApiError";
import { NetworkError } from "./NetworkError";

vi.mock("../lib/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
  },
}));

const { supabase } = await import("../lib/supabase/client");
const { getProblemHistoryDetail, listProblemHistory, reopenProblemHistory, bulkDeleteProblemHistory } =
  await import("./problemHistory");

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

const DETAIL_BODY = {
  problemId: "problem-1",
  recognizedText: "x^2 - 5x + 6 = 0을 풀어라",
  recognizedLatex: null,
  createdAt: "2026-08-16T10:00:00.000Z",
  solution: {
    conceptMd: "이차방정식",
    solutionMd: "인수분해한다",
    answerMd: "x = 2 또는 x = 3",
    conceptTags: ["이차방정식"],
    aiProvider: "openai",
    aiModel: "gpt-5",
  },
  chatMessages: [{ role: "user", content: "왜 이렇게 풀어요?", createdAt: "2026-08-16T10:01:00.000Z" }],
};

beforeEach(() => {
  vi.mocked(supabase.auth.getSession).mockResolvedValue({
    // @ts-expect-error 테스트에서는 access_token만 필요하다.
    data: { session: { access_token: "test-access-token" } },
    error: null,
  });
});

describe("listProblemHistory", () => {
  it("Authorization 헤더를 담아 GET /api/problems를 호출하고 items를 반환한다", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        items: [
          {
            problemId: "problem-1",
            recognizedText: "x^2 - 5x + 6 = 0을 풀어라",
            conceptTags: ["이차방정식"],
            createdAt: "2026-08-16T10:00:00.000Z",
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await listProblemHistory();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/problems");
    expect(init.method).toBe("GET");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-access-token");
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.problemId).toBe("problem-1");

    vi.unstubAllGlobals();
  });

  it("응답이 실패하면 ApiError를 던진다", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(401, { error: { code: "unauthorized", message: "인증이 필요합니다." } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(listProblemHistory()).rejects.toMatchObject(
      new ApiError("unauthorized", "인증이 필요합니다.", 401),
    );

    vi.unstubAllGlobals();
  });
});

describe("getProblemHistoryDetail", () => {
  it("problemId를 경로에 담아 호출하고 상세를 파싱해 반환한다", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, DETAIL_BODY));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getProblemHistoryDetail("problem-1");

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/problems/problem-1");
    expect(result.solution?.answerMd).toBe("x = 2 또는 x = 3");
    expect(result.chatMessages).toHaveLength(1);

    vi.unstubAllGlobals();
  });

  it("solution이 null이어도 파싱에 성공한다(풀이가 아직 없는 문제)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { ...DETAIL_BODY, solution: null, chatMessages: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getProblemHistoryDetail("problem-1");
    expect(result.solution).toBeNull();

    vi.unstubAllGlobals();
  });

  it("404면 status 404의 ApiError를 던진다(기록 없음 또는 타인 소유)", async () => {
    // 서버가 404에 어떤 `code` 문자열을 쓰는지는 계약에 명시돼 있지 않아(shared-types의 ErrorCode에도
    // 없다) 코드값을 단언하지 않고 status/message만 확인한다.
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(404, { error: { code: "not_found", message: "기록을 찾을 수 없습니다." } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getProblemHistoryDetail("problem-x")).rejects.toMatchObject({
      name: "ApiError",
      status: 404,
      message: "기록을 찾을 수 없습니다.",
    });

    vi.unstubAllGlobals();
  });
});

describe("reopenProblemHistory", () => {
  const REOPEN_BODY = {
    problemId: "problem-2",
    recognizedText: "x^2 - 5x + 6 = 0을 풀어라",
    recognizedLatex: null,
    createdAt: "2026-08-16T11:00:00.000Z",
  };

  it("본문 없이 POST /api/problems/:id/reopen을 호출하고 recognize 응답 shape으로 파싱한다", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, REOPEN_BODY));
    vi.stubGlobal("fetch", fetchMock);

    const result = await reopenProblemHistory("problem-1");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/problems/problem-1/reopen");
    expect(init.method).toBe("POST");
    expect(init.body).toBeUndefined();
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-access-token");
    // 서버가 새로 만든 문제 레코드의 id를 돌려주므로 원본 id와 다를 수 있다.
    expect(result.problemId).toBe("problem-2");
    expect(result.recognizedText).toBe("x^2 - 5x + 6 = 0을 풀어라");

    vi.unstubAllGlobals();
  });

  it("404면 ApiError를 던진다(기록 없음 또는 타인 소유)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(404, { error: { code: "not_found", message: "기록을 찾을 수 없습니다." } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(reopenProblemHistory("problem-x")).rejects.toMatchObject({
      name: "ApiError",
      status: 404,
      message: "기록을 찾을 수 없습니다.",
    });

    vi.unstubAllGlobals();
  });

  it("서버에 도달하지 못하면(타임아웃) NetworkError(timeout)를 던진다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new DOMException("The operation timed out.", "TimeoutError")),
    );

    await expect(reopenProblemHistory("problem-1")).rejects.toMatchObject({ name: "NetworkError", kind: "timeout" });
    await expect(reopenProblemHistory("problem-1")).rejects.toBeInstanceOf(NetworkError);

    vi.unstubAllGlobals();
  });
});

describe("bulkDeleteProblemHistory", () => {
  it("problemIds를 JSON 본문에 담아 POST /api/problems/bulk-delete를 호출한다", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { deletedProblemIds: ["problem-1", "problem-2"] }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await bulkDeleteProblemHistory(["problem-1", "problem-2"]);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/problems/bulk-delete");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-access-token");
    expect(JSON.parse(init.body as string)).toEqual({ problemIds: ["problem-1", "problem-2"] });
    expect(result.deletedProblemIds).toEqual(["problem-1", "problem-2"]);

    vi.unstubAllGlobals();
  });

  it("응답이 실패하면 ApiError를 던진다", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(404, {
          error: { code: "validation_error", message: "삭제할 풀이 기록을 찾을 수 없습니다." },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(bulkDeleteProblemHistory(["problem-x"])).rejects.toMatchObject({
      name: "ApiError",
      status: 404,
      message: "삭제할 풀이 기록을 찾을 수 없습니다.",
    });

    vi.unstubAllGlobals();
  });
});

describe("getProblemHistoryDetail — 도형 시각화 필드(PRD §4.12 FIG) 하위 호환", () => {
  it("solution에 figures/stepFigureRefs가 있으면 제거하지 않고 그대로 보존한다", async () => {
    const figures = [F01_TRIANGLE_ANGLE.raw];
    const stepFigureRefs = [{ stepId: "s1", figureId: "fig-f01" }];
    const body = { ...DETAIL_BODY, solution: { ...DETAIL_BODY.solution, figures, stepFigureRefs } };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, body)));

    const result = await getProblemHistoryDetail("problem-1");

    expect(result).toEqual(body);
    expect(result.solution?.figures).toEqual(figures);
    expect(result.solution?.stepFigureRefs).toEqual(stepFigureRefs);

    vi.unstubAllGlobals();
  });

  it("figures가 없는 기존 응답은 키를 새로 만들지 않고 입력과 동일하게 파싱된다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, DETAIL_BODY)));

    const result = await getProblemHistoryDetail("problem-1");

    expect(result).toEqual(DETAIL_BODY);
    expect(JSON.stringify(result)).toBe(JSON.stringify(DETAIL_BODY));
    expect(result.solution).not.toHaveProperty("figures");
    expect(result.solution).not.toHaveProperty("stepFigureRefs");

    vi.unstubAllGlobals();
  });
});

describe("getProblemHistoryDetail — 이어풀기 저장(Stage 5, RS6) 하위 호환", () => {
  const RESUME = {
    mode: "own" as const,
    methodName: "3번째 줄부터 이어가기",
    solutionMd: "## 이어풀기\n**1단계** 정리",
    answerMd: "-1",
    verified: true,
  };

  it("resumeSolution이 있으면 그대로 파싱하고 도형 키도 보존한다(solution이 null이어도)", async () => {
    const figures = [F09_STEPWISE_AUXILIARY.raw];
    const stepFigureRefs = [{ stepId: "s1", figureId: "fig-f09" }];
    const body = { ...DETAIL_BODY, solution: null, resumeSolution: { ...RESUME, figures, stepFigureRefs } };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, body)));

    const result = await getProblemHistoryDetail("problem-1");

    expect(result).toEqual(body);
    expect(result.resumeSolution?.figures).toEqual(figures);
    vi.unstubAllGlobals();
  });

  it("resumeSolution 키가 없는 기존 응답은 키를 만들지 않는다(바이트 동일)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, DETAIL_BODY)));
    const result = await getProblemHistoryDetail("problem-1");
    expect(JSON.stringify(result)).toBe(JSON.stringify(DETAIL_BODY));
    expect(result).not.toHaveProperty("resumeSolution");
    vi.unstubAllGlobals();
  });

  it("예전 웹 스키마(resumeSolution 모름)도 새 응답을 파싱한다 — 모르는 키는 버려질 뿐 실패하지 않는다", () => {
    const legacySchema = problemHistoryDetailSchema.omit({ resumeSolution: true });
    const body = { ...DETAIL_BODY, resumeSolution: RESUME };
    const parsed = legacySchema.parse(body);
    expect(parsed).toEqual(DETAIL_BODY);
  });

  it("resumeSolution이 null이거나 모양이 틀리면 parse가 실패한다(서버는 키를 생략해야 한다 — nullable 아님)", () => {
    expect(problemHistoryDetailSchema.safeParse({ ...DETAIL_BODY, resumeSolution: null }).success).toBe(false);
    expect(problemHistoryDetailSchema.safeParse({ ...DETAIL_BODY, resumeSolution: { ...RESUME, mode: "hack" } }).success).toBe(false);
  });

  it("resumeSolution.workContext(§12.3)가 있으면 그대로, stallLine null도 파싱한다", () => {
    const workContext = { lines: [{ lineNo: 1, latex: "x=1" }], lastValidLine: 1, stallLine: null };
    const parsed = problemHistoryDetailSchema.parse({ ...DETAIL_BODY, resumeSolution: { ...RESUME, workContext } });
    expect(parsed.resumeSolution?.workContext).toEqual(workContext);
    expect(problemHistoryDetailSchema.parse({ ...DETAIL_BODY, resumeSolution: RESUME }).resumeSolution).not.toHaveProperty("workContext");
  });
});
