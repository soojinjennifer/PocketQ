import { afterEach, describe, expect, it, vi } from "vitest";
import { NetworkError, isNetworkError } from "./NetworkError";

vi.mock("../lib/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
  },
}));

const { fetchWithNetworkError } = await import("./httpClient");

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchWithNetworkError", () => {
  it("fetch가 TypeError로 reject하면(네트워크 단절/CORS/TLS/잘못된 IP) NetworkError(unreachable)로 바꾼다", async () => {
    const cause = new TypeError("Failed to fetch");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(cause));

    const error: unknown = await fetchWithNetworkError("/api/x").catch((e: unknown) => e);

    expect(isNetworkError(error)).toBe(true);
    expect(error).toBeInstanceOf(NetworkError);
    expect((error as NetworkError).kind).toBe("unreachable");
    expect((error as NetworkError).cause).toBe(cause);
  });

  it("AbortSignal.timeout의 TimeoutError는 NetworkError(timeout)로 바꾼다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new DOMException("The operation timed out.", "TimeoutError")),
    );

    const error: unknown = await fetchWithNetworkError("/api/x").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(NetworkError);
    expect((error as NetworkError).kind).toBe("timeout");
  });

  it("사용자 취소(AbortError)는 연결 오류가 아니므로 그대로 다시 던진다", async () => {
    const abortError = new DOMException("The operation was aborted.", "AbortError");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abortError));

    const error: unknown = await fetchWithNetworkError("/api/x").catch((e: unknown) => e);

    expect(error).toBe(abortError);
    expect(isNetworkError(error)).toBe(false);
  });

  it("서버가 응답한 경우(500 포함)는 감싸지 않고 Response를 그대로 돌려준다", async () => {
    const response = { ok: false, status: 500 } as Response;
    const fetchMock = vi.fn().mockResolvedValue(response);
    vi.stubGlobal("fetch", fetchMock);
    const init: RequestInit = { method: "POST" };

    await expect(fetchWithNetworkError("/api/x", init)).resolves.toBe(response);
    expect(fetchMock).toHaveBeenCalledWith("/api/x", init);
  });
});
