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
const { recognizeWork } = await import("./recognizeWork");

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

describe("recognizeWork", () => {
  it("Authorization 헤더와 image FormData를 담아 problemId 경로로 POST 요청을 보낸다", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        workLines: [{ lineNo: 1, latex: "y = x^{2}", isLowConfidence: false }],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const blob = new Blob(["fake-image"], { type: "image/jpeg" });
    const result = await recognizeWork({ problemId: "problem-1", imageBlob: blob });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/problems/problem-1/work-lines");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-access-token");

    const formData = init.body as FormData;
    expect(formData.get("image")).toBeInstanceOf(Blob);

    expect(result).toEqual({
      workLines: [{ lineNo: 1, latex: "y = x^{2}", isLowConfidence: false }],
    });

    vi.unstubAllGlobals();
  });

  it("응답이 실패(4xx/5xx)면 ApiError를 던진다", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(404, { error: { code: "validation_error", message: "문제를 찾을 수 없습니다." } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const blob = new Blob(["fake-image"], { type: "image/jpeg" });

    await expect(recognizeWork({ problemId: "problem-1", imageBlob: blob })).rejects.toMatchObject(
      new ApiError("validation_error", "문제를 찾을 수 없습니다.", 404),
    );

    vi.unstubAllGlobals();
  });
});
