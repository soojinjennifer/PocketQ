import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./ApiError";

vi.mock("../lib/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
  },
}));

const { supabase } = await import("../lib/supabase/client");
const { diagnoseProblem } = await import("./diagnoseProblem");

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

beforeEach(() => {
  vi.mocked(supabase.auth.getSession).mockResolvedValue({
    // @ts-expect-error 테스트에서는 access_token만 필요하다.
    data: { session: { access_token: "test-access-token" } },
    error: null,
  });
});

const DIAGNOSIS_BODY = {
  lastValidLine: 1,
  stallLine: 2,
  errorTypeLabel: "부호 오류",
  errorDetail: "2번째 줄을 다시 확인하세요.",
  relatedConcepts: ["이차함수 > 완전제곱식"],
  reachedAnswerWithNotes: false,
  isLowConfidence: false,
  conceptExplanations: [],
  identifiedMethod: null,
  isMethodApplicable: true,
  methodApplicabilityNote: null,
  problemAnswerLatex: "-1",
};

describe("diagnoseProblem", () => {
  it("Authorization 헤더와 workLines를 JSON body로 담아 POST 요청을 보낸다", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, DIAGNOSIS_BODY));
    vi.stubGlobal("fetch", fetchMock);

    const result = await diagnoseProblem({
      problemId: "problem-1",
      workLines: [
        { lineNo: 1, latex: "y = x^{2}" },
        { lineNo: 2, latex: "y = 1" },
      ],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/problems/problem-1/diagnose");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-access-token");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");

    const body = JSON.parse(init.body as string) as { workLines: unknown };
    expect(body.workLines).toEqual([
      { lineNo: 1, latex: "y = x^{2}" },
      { lineNo: 2, latex: "y = 1" },
    ]);

    expect(result).toEqual(DIAGNOSIS_BODY);

    vi.unstubAllGlobals();
  });

  it("응답이 실패(4xx/5xx)면 ApiError를 던진다", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(404, { error: { code: "validation_error", message: "문제를 찾을 수 없습니다." } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      diagnoseProblem({ problemId: "problem-1", workLines: [{ lineNo: 1, latex: "x" }] }),
    ).rejects.toMatchObject(new ApiError("validation_error", "문제를 찾을 수 없습니다.", 404));

    vi.unstubAllGlobals();
  });
});
