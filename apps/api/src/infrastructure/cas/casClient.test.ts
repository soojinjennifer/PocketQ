import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpCasClient } from "./casClient";

/**
 * `HttpCasClient`는 `services/cas/`(Python FastAPI) 서비스의 HTTP 계약을 아는 유일한 파일이라,
 * 이 계약(요청 바디 형태/응답 파싱/오류 변환)을 검증하려면 여기서 `fetch`를 직접 모킹하는 수밖에
 * 없다(실제 네트워크 호출 없이 결정적으로 테스트하기 위함) — `diagnosis.router.test.ts`/
 * `resume.router.test.ts`는 대신 `CasClient`를 라우터 팩토리에 주입해 `fetch`를 모킹하지 않는다.
 */
const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("HttpCasClient.verifyWorkLines", () => {
  it("baseUrl + /verify-work-lines로 POST하고, lineNo/latex만 담은 body를 보낸다", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results: [{ lineNo: 1, isValid: true }] }),
    });

    const client = new HttpCasClient("http://localhost:8000");
    const result = await client.verifyWorkLines([
      { lineNo: 1, latex: "y = x^{2} - 4x + 3", isLowConfidence: false },
    ]);

    expect(result).toEqual([{ lineNo: 1, isValid: true }]);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8000/verify-work-lines");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      lines: [{ lineNo: 1, latex: "y = x^{2} - 4x + 3" }],
    });
  });

  it("응답이 ok:false면 provider_error(502)를 던진다", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: () => Promise.resolve({}) });

    const client = new HttpCasClient("http://localhost:8000");

    await expect(
      client.verifyWorkLines([{ lineNo: 1, latex: "x", isLowConfidence: false }]),
    ).rejects.toMatchObject({ code: "provider_error", status: 502 });
  });

  it("fetch 자체가 실패하면(네트워크 오류) provider_error(502)를 던진다", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));

    const client = new HttpCasClient("http://localhost:8000");

    await expect(
      client.verifyWorkLines([{ lineNo: 1, latex: "x", isLowConfidence: false }]),
    ).rejects.toMatchObject({ code: "provider_error", status: 502 });
  });

  it("응답 본문이 JSON으로 파싱되지 않으면 provider_error(502)를 던진다", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.reject(new Error("invalid json")),
    });

    const client = new HttpCasClient("http://localhost:8000");

    await expect(
      client.verifyWorkLines([{ lineNo: 1, latex: "x", isLowConfidence: false }]),
    ).rejects.toMatchObject({ code: "provider_error", status: 502 });
  });
});

describe("HttpCasClient.verifyFinalAnswer", () => {
  it("baseUrl + /verify-final-answer로 POST하고, 응답의 verified를 그대로 반환한다", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({ verified: true }) });

    const client = new HttpCasClient("http://localhost:8000");
    const result = await client.verifyFinalAnswer("-1", "최솟값은 -1입니다.");

    expect(result).toEqual({ verified: true });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8000/verify-final-answer");
    expect(JSON.parse(init.body as string)).toEqual({
      problemAnswerLatex: "-1",
      solutionAnswerLatex: "최솟값은 -1입니다.",
    });
  });

  it("응답이 ok:false면 provider_error(502)를 던진다", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503, json: () => Promise.resolve({}) });

    const client = new HttpCasClient("http://localhost:8000");

    await expect(client.verifyFinalAnswer("-1", "-1")).rejects.toMatchObject({
      code: "provider_error",
      status: 502,
    });
  });
});
