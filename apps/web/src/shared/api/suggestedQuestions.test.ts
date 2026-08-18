import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/supabase/client", () => ({
  supabase: { auth: { getSession: vi.fn() } },
}));

const { supabase } = await import("../lib/supabase/client");
const { getSuggestedQuestions } = await import("./suggestedQuestions");

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

describe("getSuggestedQuestions", () => {
  it("본문 없이 POST /api/problems/:id/suggestions를 호출하고 questions 배열을 반환한다", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { questions: ["다른 방법도 있나요?", "비슷한 문제 더 풀래요"] }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getSuggestedQuestions("problem-1");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/problems/problem-1/suggestions");
    expect(init.method).toBe("POST");
    expect(init.body).toBeUndefined();
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-access-token");
    expect(result.questions).toEqual(["다른 방법도 있나요?", "비슷한 문제 더 풀래요"]);

    vi.unstubAllGlobals();
  });

  it("실패 응답이면 ApiError를 던진다", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(500, { error: { code: "internal_error", message: "예상치 못한 오류가 발생했습니다." } }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getSuggestedQuestions("problem-1")).rejects.toMatchObject({ status: 500 });

    vi.unstubAllGlobals();
  });
});
