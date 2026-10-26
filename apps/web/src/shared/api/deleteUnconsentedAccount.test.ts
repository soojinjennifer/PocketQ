import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./ApiError";

vi.mock("../lib/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
  },
}));

const { supabase } = await import("../lib/supabase/client");
const { deleteUnconsentedAccount } = await import("./deleteUnconsentedAccount");

function response(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => (body === undefined ? Promise.reject(new SyntaxError("empty")) : Promise.resolve(body)),
  } as Response;
}

beforeEach(() => {
  vi.mocked(supabase.auth.getSession).mockResolvedValue({
    // @ts-expect-error 테스트에서는 access_token만 필요하다.
    data: { session: { access_token: "test-access-token" } },
    error: null,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("deleteUnconsentedAccount", () => {
  it("Authorization 헤더를 담아 DELETE /api/account/unconsented를 호출하고 204면 deleted를 돌려준다", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(204, undefined));
    vi.stubGlobal("fetch", fetchMock);

    await expect(deleteUnconsentedAccount()).resolves.toBe("deleted");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/api\/account\/unconsented$/);
    expect(init.method).toBe("DELETE");
    expect(init.headers).toEqual({ Authorization: "Bearer test-access-token" });
  });

  it("409면 already-consented를 돌려준다(삭제되지 않음)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(response(409, { error: { code: "conflict", message: "이미 동의" } })),
    );

    await expect(deleteUnconsentedAccount()).resolves.toBe("already-consented");
  });

  it("그 밖의 실패는 ApiError로 던진다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(response(500, { error: { code: "internal_error", message: "boom" } })),
    );

    const error: unknown = await deleteUnconsentedAccount().catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(500);
  });
});
