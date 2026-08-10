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
const { recognizeProblem } = await import("./recognizeProblem");

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

describe("recognizeProblem", () => {
  it("Authorization 헤더와 image/inputType/grade FormData를 담아 POST 요청을 보낸다", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        problemId: "problem-1",
        recognizedText: "1+1=?",
        recognizedLatex: null,
        createdAt: "2026-08-01T00:00:00.000Z",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const blob = new Blob(["fake-image"], { type: "image/jpeg" });
    const result = await recognizeProblem({ imageBlob: blob, inputType: "photo", grade: "M2" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/problems/recognize");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-access-token");

    const formData = init.body as FormData;
    expect(formData.get("inputType")).toBe("photo");
    expect(formData.get("grade")).toBe("M2");
    expect(formData.get("image")).toBeInstanceOf(Blob);

    expect(result).toEqual({
      problemId: "problem-1",
      recognizedText: "1+1=?",
      recognizedLatex: null,
      createdAt: "2026-08-01T00:00:00.000Z",
    });

    vi.unstubAllGlobals();
  });

  it("응답이 실패(4xx/5xx)면 ApiError를 던진다", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(400, { error: { code: "validation_error", message: "이미지가 필요합니다." } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const blob = new Blob(["fake-image"], { type: "image/jpeg" });

    await expect(recognizeProblem({ imageBlob: blob, inputType: "photo", grade: "M2" })).rejects.toMatchObject(
      new ApiError("validation_error", "이미지가 필요합니다.", 400),
    );

    vi.unstubAllGlobals();
  });
});
