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
const { resumeProblemStream } = await import("./resumeProblem");

function streamFrom(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
}

async function collect<T>(iterable: AsyncGenerator<T>): Promise<T[]> {
  const results: T[] = [];
  for await (const item of iterable) {
    results.push(item);
  }
  return results;
}

beforeEach(() => {
  vi.mocked(supabase.auth.getSession).mockResolvedValue({
    // @ts-expect-error 테스트에서는 access_token만 필요하다.
    data: { session: { access_token: "test-access-token" } },
    error: null,
  });
});

describe("resumeProblemStream", () => {
  it("chunk 이벤트들과 마지막 done 이벤트를 순서대로 산출하고, mode를 body에 담아 요청한다", async () => {
    const sse =
      'event: chunk\ndata: {"delta":"## 이어풀기\\n"}\n\n' +
      'event: chunk\ndata: {"delta":"3번째 줄부터 이어서 진행합니다."}\n\n' +
      'event: done\ndata: {"mode":"own","methodName":"3번째 줄부터 이어가기","solutionMd":"이어풀기","answerMd":"답","verified":true}\n\n';

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: streamFrom(sse),
      json: () => Promise.resolve(null),
    });
    vi.stubGlobal("fetch", fetchMock);

    const events = await collect(resumeProblemStream({ problemId: "problem-1", mode: "own" }));

    expect(events[0]).toEqual({ type: "chunk", delta: "## 이어풀기\n" });
    expect(events[1]).toEqual({ type: "chunk", delta: "3번째 줄부터 이어서 진행합니다." });
    expect(events[2]).toMatchObject({ type: "done", result: { mode: "own", verified: true } });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/problems/problem-1/resume");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-access-token");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body as string)).toEqual({ mode: "own" });

    vi.unstubAllGlobals();
  });

  it("스트림 중 error 이벤트가 오면 error 타입으로 산출한다", async () => {
    const sse = 'event: error\ndata: {"code":"provider_error","message":"이어풀기 생성 중 오류가 발생했습니다."}\n\n';

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        body: streamFrom(sse),
        json: () => Promise.resolve(null),
      }),
    );

    const events = await collect(resumeProblemStream({ problemId: "problem-1", mode: "alternative" }));

    expect(events).toEqual([
      { type: "error", code: "provider_error", message: "이어풀기 생성 중 오류가 발생했습니다." },
    ]);

    vi.unstubAllGlobals();
  });

  it("HTTP 응답 자체가 실패면 ApiError를 던진다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        body: null,
        json: () => Promise.resolve({ error: { code: "validation_error", message: "문제를 찾을 수 없습니다." } }),
      }),
    );

    const iterable = resumeProblemStream({ problemId: "does-not-exist", mode: "own" });

    await expect(collect(iterable)).rejects.toMatchObject(
      new ApiError("validation_error", "문제를 찾을 수 없습니다.", 404),
    );

    vi.unstubAllGlobals();
  });
});
