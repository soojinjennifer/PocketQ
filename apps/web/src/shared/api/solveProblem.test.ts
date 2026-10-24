import { beforeEach, describe, expect, it, vi } from "vitest";
import { F01_TRIANGLE_ANGLE } from "validation/src/figures/fixtures";
import { ApiError } from "./ApiError";

vi.mock("../lib/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
  },
}));

const { supabase } = await import("../lib/supabase/client");
const { solveProblemStream } = await import("./solveProblem");

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

describe("solveProblemStream", () => {
  it("chunk 이벤트들과 마지막 done 이벤트를 순서대로 산출한다", async () => {
    const sse =
      'event: chunk\ndata: {"delta":"안녕"}\n\n' +
      'event: chunk\ndata: {"delta":"하세요"}\n\n' +
      'event: done\ndata: {"conceptMd":null,"solutionMd":"풀이","answerMd":"답","conceptTags":[],"aiProvider":"openai","aiModel":"gpt-5.6-terra"}\n\n';

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: streamFrom(sse),
      json: () => Promise.resolve(null),
    });
    vi.stubGlobal("fetch", fetchMock);

    const events = await collect(
      solveProblemStream({ problemId: "problem-1", options: { concept: true, solution: true } }),
    );

    expect(events[0]).toEqual({ type: "chunk", delta: "안녕" });
    expect(events[1]).toEqual({ type: "chunk", delta: "하세요" });
    expect(events[2]).toMatchObject({ type: "done", result: { answerMd: "답" } });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/problems/problem-1/solve");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-access-token");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body as string)).toEqual({ options: { concept: true, solution: true } });

    vi.unstubAllGlobals();
  });

  it("스트림 중 error 이벤트가 오면 error 타입으로 산출한다", async () => {
    const sse = 'event: error\ndata: {"code":"provider_error","message":"풀이 생성 중 오류가 발생했습니다."}\n\n';

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        body: streamFrom(sse),
        json: () => Promise.resolve(null),
      }),
    );

    const events = await collect(
      solveProblemStream({ problemId: "problem-1", options: { concept: true, solution: true } }),
    );

    expect(events).toEqual([
      { type: "error", code: "provider_error", message: "풀이 생성 중 오류가 발생했습니다." },
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

    const iterable = solveProblemStream({
      problemId: "does-not-exist",
      options: { concept: true, solution: true },
    });

    await expect(collect(iterable)).rejects.toMatchObject(
      new ApiError("validation_error", "문제를 찾을 수 없습니다.", 404),
    );

    vi.unstubAllGlobals();
  });
});

describe("solveProblemStream — 도형 시각화 필드(PRD §4.12 FIG) 하위 호환", () => {
  const BASE_RESULT = {
    conceptMd: null,
    solutionMd: "풀이",
    answerMd: "답",
    conceptTags: [],
    aiProvider: "openai",
    aiModel: "gpt-5.6-terra",
  };

  function sseResponse(sse: string) {
    return { ok: true, status: 200, body: streamFrom(sse), json: () => Promise.resolve(null) };
  }

  it("done payload에 figures/stepFigureRefs가 있으면 그대로 보존해 산출한다", async () => {
    const result = {
      ...BASE_RESULT,
      figures: [F01_TRIANGLE_ANGLE.raw],
      stepFigureRefs: [{ stepId: "s1", figureId: "fig-f01" }],
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(sseResponse(`event: done\ndata: ${JSON.stringify(result)}\n\n`)));

    const events = await collect(
      solveProblemStream({ problemId: "problem-1", options: { concept: true, solution: true } }),
    );

    expect(events).toEqual([{ type: "done", result }]);

    vi.unstubAllGlobals();
  });

  it("figures가 없는 기존 done payload는 키를 새로 만들지 않는다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(sseResponse(`event: done\ndata: ${JSON.stringify(BASE_RESULT)}\n\n`)),
    );

    const events = await collect(
      solveProblemStream({ problemId: "problem-1", options: { concept: true, solution: true } }),
    );

    expect(events).toEqual([{ type: "done", result: BASE_RESULT }]);
    const [event] = events;
    expect(event?.type === "done" ? event.result : null).not.toHaveProperty("figures");

    vi.unstubAllGlobals();
  });
});
