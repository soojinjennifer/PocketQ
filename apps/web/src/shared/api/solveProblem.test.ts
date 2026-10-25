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

describe("solveProblemStream — Stage 3 figures 이벤트(S3-13)", () => {
  const done =
    'event: done\ndata: {"conceptMd":null,"solutionMd":"풀이","answerMd":"답","conceptTags":[],"aiProvider":"openai","aiModel":"m"}\n\n';
  const figure = F01_TRIANGLE_ANGLE.raw;

  function mockFetch(sse: string) {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, body: streamFrom(sse), json: () => Promise.resolve(null) }),
    );
  }

  it("done 뒤 figures 이벤트를 figures 타입으로 산출하고 keep-alive 주석은 무시한다", async () => {
    const refs = [{ stepId: "s1", figureId: "fig-f01" }];
    mockFetch(
      `event: chunk\ndata: {"delta":"a"}\n\n${done}: keep-alive\n\n` +
        `event: figures\ndata: ${JSON.stringify({ figures: [figure], stepFigureRefs: refs })}\n\n`,
    );
    const events = await collect(solveProblemStream({ problemId: "p", options: { concept: true, solution: true } }));
    expect(events.map((e) => e.type)).toEqual(["chunk", "done", "figures"]);
    expect(events[2]).toEqual({ type: "figures", figures: [figure], stepFigureRefs: refs });
  });

  it("깨진 figures 이벤트(비JSON·비배열·빈 배열)는 무시하고 stepFigureRefs가 배열이 아니면 []", async () => {
    mockFetch(
      `${done}event: figures\ndata: {not json\n\n` +
        'event: figures\ndata: {"figures":"x"}\n\n' +
        'event: figures\ndata: {"figures":[]}\n\n' +
        "event: figures\ndata: [1,2]\n\n" +
        `event: figures\ndata: ${JSON.stringify({ figures: [figure], stepFigureRefs: "x" })}\n\n`,
    );
    const events = await collect(solveProblemStream({ problemId: "p", options: { concept: true, solution: true } }));
    expect(events.map((e) => e.type)).toEqual(["done", "figures"]);
    expect(events[1]).toEqual({ type: "figures", figures: [figure], stepFigureRefs: [] });
  });
});

describe("solveProblemStream — Stage 4 signal(L-4)", () => {
  /** signal이 abort되면 읽기가 AbortError로 끝나는 열린 SSE 응답(브라우저 fetch와 같은 동작). */
  function abortableFetch() {
    const encoder = new TextEncoder();
    return vi.fn((_url: string, init?: RequestInit) => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode('event: chunk\ndata: {"delta":"a"}\n\n'));
          init?.signal?.addEventListener("abort", () => {
            const error = new Error("The operation was aborted.");
            error.name = "AbortError";
            controller.error(error);
          });
        },
      });
      return Promise.resolve({ ok: true, status: 200, body, json: () => Promise.resolve(null) });
    });
  }

  it("signal을 fetch에 그대로 넘기고, abort하면 스트림이 AbortError로 끝난다", async () => {
    const fetchMock = abortableFetch();
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();
    const iterator = solveProblemStream({ problemId: "problem-1", options: { concept: true, solution: true } }, controller.signal);

    expect(await iterator.next()).toEqual({ done: false, value: { type: "chunk", delta: "a" } });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBe(controller.signal);

    controller.abort();
    await expect(iterator.next()).rejects.toMatchObject({ name: "AbortError" });
    vi.unstubAllGlobals();
  });

  it("signal을 주지 않으면 요청 옵션에 signal 키가 없다(기존 호출과 같음)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, body: streamFrom(""), json: () => Promise.resolve(null) });
    vi.stubGlobal("fetch", fetchMock);
    await collect(solveProblemStream({ problemId: "problem-1", options: { concept: true, solution: true } }));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect("signal" in init).toBe(false);
    vi.unstubAllGlobals();
  });
});
