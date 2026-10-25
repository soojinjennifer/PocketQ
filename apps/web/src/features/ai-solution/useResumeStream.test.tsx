import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ResumeStreamEvent } from "../../shared/api/resumeProblem";

vi.mock("../../shared/api/resumeProblem", () => ({
  resumeProblemStream: vi.fn(),
}));

const { resumeProblemStream } = await import("../../shared/api/resumeProblem");
const { useResumeStream } = await import("./useResumeStream");

async function* eventsOf(events: ResumeStreamEvent[]) {
  await Promise.resolve();
  for (const event of events) {
    yield event;
  }
}

const RESUME_SOLUTION = {
  mode: "own" as const,
  methodName: "3번째 줄부터 이어가기",
  solutionMd: "이어풀기 본문",
  answerMd: "답",
  verified: true,
};

describe("useResumeStream", () => {
  it("chunk 이벤트를 누적하다가 done이 오면 success 상태와 결과를 채운다", async () => {
    vi.mocked(resumeProblemStream).mockReturnValue(
      eventsOf([
        { type: "chunk", delta: "이어" },
        { type: "chunk", delta: "풀기" },
        { type: "done", result: RESUME_SOLUTION },
      ]),
    );

    const { result } = renderHook(() => useResumeStream());
    expect(result.current.status).toBe("idle");
    expect(result.current.mode).toBeNull();

    await act(async () => {
      await result.current.resume({ problemId: "problem-1", mode: "own" });
    });

    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.mode).toBe("own");
    expect(result.current.streamedText).toBe("이어풀기");
    expect(result.current.result).toEqual(RESUME_SOLUTION);
    expect(result.current.errorMessage).toBeNull();
  });

  it("error 이벤트가 오면 error 상태와 메시지를 채운다", async () => {
    vi.mocked(resumeProblemStream).mockReturnValue(
      eventsOf([{ type: "error", code: "provider_error", message: "이어풀기 생성 중 오류가 발생했습니다." }]),
    );

    const { result } = renderHook(() => useResumeStream());

    await act(async () => {
      await result.current.resume({ problemId: "problem-1", mode: "alternative" });
    });

    expect(result.current.status).toBe("error");
    expect(result.current.errorMessage).toBe("이어풀기 생성 중 오류가 발생했습니다.");
  });

  it("reset은 모든 상태를 idle로 되돌린다", async () => {
    vi.mocked(resumeProblemStream).mockReturnValue(eventsOf([{ type: "done", result: RESUME_SOLUTION }]));

    const { result } = renderHook(() => useResumeStream());
    await act(async () => {
      await result.current.resume({ problemId: "problem-1", mode: "own" });
    });

    act(() => result.current.reset());

    expect(result.current.status).toBe("idle");
    expect(result.current.mode).toBeNull();
    expect(result.current.streamedText).toBe("");
    expect(result.current.result).toBeNull();
    expect(result.current.errorMessage).toBeNull();
  });

  it("이전 요청이 끝나기 전에 새 resume()이 호출되면 이전 스트림의 뒤늦은 이벤트를 무시한다", async () => {
    let releaseFirst: (() => void) | undefined;
    vi.mocked(resumeProblemStream).mockImplementationOnce(function firstStream() {
      async function* generate(): AsyncGenerator<ResumeStreamEvent> {
        await new Promise<void>((resolve) => {
          releaseFirst = resolve;
        });
        yield { type: "done", result: { ...RESUME_SOLUTION, mode: "own" } };
      }
      return generate();
    });
    vi.mocked(resumeProblemStream).mockImplementationOnce(function secondStream() {
      return eventsOf([{ type: "done", result: { ...RESUME_SOLUTION, mode: "alternative" } }]);
    });

    const { result } = renderHook(() => useResumeStream());

    const firstCall = act(async () => {
      await result.current.resume({ problemId: "problem-1", mode: "own" });
    });

    await act(async () => {
      await result.current.resume({ problemId: "problem-1", mode: "alternative" });
    });

    releaseFirst?.();
    await firstCall;

    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.mode).toBe("alternative");
    expect(result.current.result?.mode).toBe("alternative");
  });
});

function gatedResumeStream(before: ResumeStreamEvent[], after: ResumeStreamEvent[]) {
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  async function* generate(): AsyncGenerator<ResumeStreamEvent> {
    await Promise.resolve();
    for (const event of before) yield event;
    await gate;
    for (const event of after) yield event;
  }
  return { stream: generate(), release: () => release() };
}

const RESUME_FIGURE = { schemaVersion: 1, figureId: "fig-r" } as unknown as import("shared-types").FigureSpec;

describe("useResumeStream — Stage 3 figures(S3-R8)", () => {
  it("done에서 resolve하고 이후 figures를 병합한다", async () => {
    const { stream, release } = gatedResumeStream(
      [{ type: "done", result: RESUME_SOLUTION }],
      [{ type: "figures", figures: [RESUME_FIGURE], stepFigureRefs: [{ stepId: "s1", figureId: "fig-r" }] }],
    );
    vi.mocked(resumeProblemStream).mockReturnValue(stream);
    const { result } = renderHook(() => useResumeStream());
    let resolved: unknown = "pending";
    await act(async () => {
      resolved = await result.current.resume({ problemId: "p", mode: "own" });
    });
    expect(resolved).toEqual(RESUME_SOLUTION);
    await act(async () => {
      release();
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.result?.figures).toEqual([RESUME_FIGURE]));
    expect(result.current.result?.verified).toBe(true);
  });

  it("모드를 바꿔 다시 요청하면 이전 요청의 figures는 무시한다", async () => {
    const own = gatedResumeStream(
      [{ type: "done", result: RESUME_SOLUTION }],
      [{ type: "figures", figures: [RESUME_FIGURE], stepFigureRefs: [] }],
    );
    const alternative = { ...RESUME_SOLUTION, mode: "alternative" as const };
    vi.mocked(resumeProblemStream).mockReturnValueOnce(own.stream).mockReturnValueOnce(eventsOf([{ type: "done", result: alternative }]));
    const { result } = renderHook(() => useResumeStream());
    await act(async () => {
      await result.current.resume({ problemId: "p", mode: "own" });
    });
    await act(async () => {
      await result.current.resume({ problemId: "p", mode: "alternative" });
    });
    await act(async () => {
      own.release();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(result.current.result).toEqual(alternative);
    expect(result.current.mode).toBe("alternative");
  });
});

// ---- Stage 4 WU4: AbortController(L-4)·figuresPhase ----

function abortError(): Error {
  const error = new Error("The operation was aborted.");
  error.name = "AbortError";
  return error;
}

function openStream(events: ResumeStreamEvent[]) {
  const seen: { signal: AbortSignal | undefined } = { signal: undefined };
  async function* impl(_params: unknown, signal?: AbortSignal): AsyncGenerator<ResumeStreamEvent> {
    seen.signal = signal;
    await Promise.resolve();
    for (const event of events) yield event;
    await new Promise<void>((_resolve, reject) => {
      signal?.addEventListener("abort", () => reject(abortError()), { once: true });
    });
  }
  return { impl, seen };
}

const FIG = { schemaVersion: 1, figureId: "fig-r" } as unknown as import("shared-types").FigureSpec;

describe("useResumeStream — Stage 4 figuresPhase·L-4", () => {
  it("done이면 waiting, figures면 received, 종료되면 empty(도형 없음)", async () => {
    const stream = openStream([{ type: "done", result: RESUME_SOLUTION }, { type: "figures", figures: [FIG], stepFigureRefs: [] }]);
    vi.mocked(resumeProblemStream).mockImplementation(stream.impl);
    const { result } = renderHook(() => useResumeStream());
    expect(result.current.figuresPhase).toBe("idle");
    await act(async () => {
      await result.current.resume({ problemId: "p", mode: "own" });
    });
    await waitFor(() => expect(result.current.figuresPhase).toBe("received"));

    vi.mocked(resumeProblemStream).mockReturnValue(eventsOf([{ type: "done", result: RESUME_SOLUTION }]));
    await act(async () => {
      await result.current.resume({ problemId: "p", mode: "alternative" });
    });
    await waitFor(() => expect(result.current.figuresPhase).toBe("empty"));
    expect(stream.seen.signal?.aborted).toBe(true);
  });

  it("reset·모드 재요청·언마운트 때 abort, AbortError는 error 상태를 만들지 않는다", async () => {
    const first = openStream([{ type: "done", result: RESUME_SOLUTION }]);
    vi.mocked(resumeProblemStream).mockImplementation(first.impl);
    const { result, unmount } = renderHook(() => useResumeStream());
    await act(async () => {
      await result.current.resume({ problemId: "p", mode: "own" });
    });
    expect(result.current.figuresPhase).toBe("waiting");

    const second = openStream([{ type: "done", result: { ...RESUME_SOLUTION, mode: "alternative" as const } }]);
    vi.mocked(resumeProblemStream).mockImplementation(second.impl);
    await act(async () => {
      await result.current.resume({ problemId: "p", mode: "alternative" });
    });
    expect(first.seen.signal?.aborted).toBe(true);
    expect(result.current.status).toBe("success");
    expect(result.current.errorMessage).toBeNull();

    act(() => result.current.reset());
    expect(second.seen.signal?.aborted).toBe(true);
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.status).toBe("idle");
    expect(result.current.errorMessage).toBeNull();
    expect(result.current.figuresPhase).toBe("idle");

    const third = openStream([{ type: "done", result: RESUME_SOLUTION }]);
    vi.mocked(resumeProblemStream).mockImplementation(third.impl);
    await act(async () => {
      await result.current.resume({ problemId: "p", mode: "own" });
    });
    unmount();
    expect(third.seen.signal?.aborted).toBe(true);
  });
});
