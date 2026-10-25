import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SolveStreamEvent } from "../../shared/api/solveProblem";

vi.mock("../../shared/api/solveProblem", () => ({
  solveProblemStream: vi.fn(),
}));

const { solveProblemStream } = await import("../../shared/api/solveProblem");
const { useSolveStream } = await import("./useSolveStream");

async function* eventsOf(events: SolveStreamEvent[]) {
  await Promise.resolve();
  for (const event of events) {
    yield event;
  }
}

const SOLUTION = {
  conceptMd: null,
  solutionMd: "풀이",
  answerMd: "답",
  conceptTags: [],
  aiProvider: "openai" as const,
  aiModel: "gpt-5.6-terra",
};

describe("useSolveStream", () => {
  it("chunk 이벤트를 누적하다가 done이 오면 success 상태와 결과를 채운다", async () => {
    vi.mocked(solveProblemStream).mockReturnValue(
      eventsOf([
        { type: "chunk", delta: "안녕" },
        { type: "chunk", delta: "하세요" },
        { type: "done", result: SOLUTION },
      ]),
    );

    const { result } = renderHook(() => useSolveStream());
    expect(result.current.status).toBe("idle");

    await act(async () => {
      await result.current.solve({ problemId: "problem-1", options: { concept: true, solution: true } });
    });

    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.streamedText).toBe("안녕하세요");
    expect(result.current.result).toEqual(SOLUTION);
    expect(result.current.errorMessage).toBeNull();
  });

  it("error 이벤트가 오면 error 상태와 메시지를 채운다", async () => {
    vi.mocked(solveProblemStream).mockReturnValue(
      eventsOf([{ type: "error", code: "provider_error", message: "풀이 생성 중 오류가 발생했습니다." }]),
    );

    const { result } = renderHook(() => useSolveStream());

    await act(async () => {
      await result.current.solve({ problemId: "problem-1", options: { concept: true, solution: true } });
    });

    expect(result.current.status).toBe("error");
    expect(result.current.errorMessage).toBe("풀이 생성 중 오류가 발생했습니다.");
  });

  it("reset은 모든 상태를 idle로 되돌린다", async () => {
    vi.mocked(solveProblemStream).mockReturnValue(eventsOf([{ type: "done", result: SOLUTION }]));

    const { result } = renderHook(() => useSolveStream());
    await act(async () => {
      await result.current.solve({ problemId: "problem-1", options: { concept: true, solution: true } });
    });

    act(() => result.current.reset());

    expect(result.current.status).toBe("idle");
    expect(result.current.streamedText).toBe("");
    expect(result.current.result).toBeNull();
    expect(result.current.errorMessage).toBeNull();
  });
});

/** done 이후 `release()`를 부를 때까지 멈춰 있는 스트림(서버가 도형을 만드는 동안 스트림이 열려 있는 상황). */
function gatedStream(before: SolveStreamEvent[], after: SolveStreamEvent[], throwAfter = false) {
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  async function* generate(): AsyncGenerator<SolveStreamEvent> {
    await Promise.resolve();
    for (const event of before) yield event;
    await gate;
    for (const event of after) yield event;
    if (throwAfter) throw new Error("network lost");
  }
  return { stream: generate(), release: () => release() };
}

const FIGURE = { schemaVersion: 1, figureId: "fig-a" } as unknown as import("shared-types").FigureSpec;
const REFS = [{ stepId: "s1", figureId: "fig-a" }];

describe("useSolveStream — Stage 3 figures(S3-13)", () => {
  it("done에서 resolve하고(스트림이 아직 열려 있어도) 이후 figures를 result에 병합한다", async () => {
    const { stream, release } = gatedStream(
      [{ type: "chunk", delta: "a" }, { type: "done", result: SOLUTION }],
      [{ type: "figures", figures: [FIGURE], stepFigureRefs: REFS }],
    );
    vi.mocked(solveProblemStream).mockReturnValue(stream);
    const { result } = renderHook(() => useSolveStream());

    let resolved: unknown = "pending";
    await act(async () => {
      resolved = await result.current.solve({ problemId: "p", options: { concept: true, solution: true } });
    });
    expect(resolved).toEqual(SOLUTION);
    expect(result.current.status).toBe("success");
    expect(result.current.result?.figures).toBeUndefined();

    await act(async () => {
      release();
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.result?.figures).toEqual([FIGURE]));
    expect(result.current.result?.stepFigureRefs).toEqual(REFS);
    expect(result.current.result?.answerMd).toBe(SOLUTION.answerMd);
  });

  it("done 뒤 error 이벤트·네트워크 오류가 와도 success와 결과를 유지한다", async () => {
    const { stream, release } = gatedStream(
      [{ type: "done", result: SOLUTION }],
      [{ type: "error", code: "provider_error", message: "x" }],
      true,
    );
    vi.mocked(solveProblemStream).mockReturnValue(stream);
    const { result } = renderHook(() => useSolveStream());
    await act(async () => {
      await result.current.solve({ problemId: "p", options: { concept: true, solution: true } });
    });
    await act(async () => {
      release();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(result.current.status).toBe("success");
    expect(result.current.result).toEqual(SOLUTION);
    expect(result.current.errorMessage).toBeNull();
  });

  it("새 요청이나 reset 이후에 도착한 이전 요청의 figures는 무시한다", async () => {
    const first = gatedStream([{ type: "done", result: SOLUTION }], [{ type: "figures", figures: [FIGURE], stepFigureRefs: REFS }]);
    const secondSolution = { ...SOLUTION, answerMd: "두 번째" };
    vi.mocked(solveProblemStream).mockReturnValueOnce(first.stream).mockReturnValueOnce(eventsOf([{ type: "done", result: secondSolution }]));
    const { result } = renderHook(() => useSolveStream());
    await act(async () => {
      await result.current.solve({ problemId: "p", options: { concept: true, solution: true } });
    });
    await act(async () => {
      await result.current.solve({ problemId: "p", options: { concept: true, solution: true } });
    });
    await act(async () => {
      first.release();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(result.current.result).toEqual(secondSolution);

    const third = gatedStream([{ type: "done", result: SOLUTION }], [{ type: "figures", figures: [FIGURE], stepFigureRefs: REFS }]);
    vi.mocked(solveProblemStream).mockReturnValueOnce(third.stream);
    await act(async () => {
      await result.current.solve({ problemId: "p", options: { concept: true, solution: true } });
    });
    act(() => result.current.reset());
    await act(async () => {
      third.release();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(result.current.result).toBeNull();
    expect(result.current.status).toBe("idle");
  });
});

// ---- Stage 4 WU4: AbortController(L-4)·figuresPhase ----

function abortError(): Error {
  const error = new Error("The operation was aborted.");
  error.name = "AbortError";
  return error;
}

/** 주어진 이벤트를 내보낸 뒤 signal이 abort될 때까지(또는 `finish`/`fail`까지) 열려 있는 스트림. */
function openStream(events: SolveStreamEvent[]) {
  const seen: { signal: AbortSignal | undefined } = { signal: undefined };
  let finish: () => void = () => undefined;
  let fail: (error: Error) => void = () => undefined;
  const tail = new Promise<void>((resolve, reject) => {
    finish = resolve;
    fail = reject;
  });
  async function* impl(_params: unknown, signal?: AbortSignal): AsyncGenerator<SolveStreamEvent> {
    seen.signal = signal;
    await Promise.resolve();
    for (const event of events) yield event;
    await new Promise<void>((resolve, reject) => {
      signal?.addEventListener("abort", () => reject(abortError()), { once: true });
      tail.then(resolve, reject);
    });
  }
  return { impl, seen, finish: () => finish(), fail: (error: Error) => fail(error) };
}

const FIG = { schemaVersion: 1, figureId: "fig-b" } as unknown as import("shared-types").FigureSpec;

describe("useSolveStream — Stage 4 figuresPhase", () => {
  it("idle → done이면 waiting → figures면 received, 스트림 종료 뒤에도 received", async () => {
    const stream = openStream([{ type: "done", result: SOLUTION }]);
    vi.mocked(solveProblemStream).mockImplementation(stream.impl);
    const { result } = renderHook(() => useSolveStream());
    expect(result.current.figuresPhase).toBe("idle");

    await act(async () => {
      await result.current.solve({ problemId: "p", options: { concept: true, solution: true } });
    });
    expect(result.current.figuresPhase).toBe("waiting");

    vi.mocked(solveProblemStream).mockReset();
    const withFigures = openStream([
      { type: "done", result: SOLUTION },
      { type: "figures", figures: [FIG], stepFigureRefs: [] },
    ]);
    vi.mocked(solveProblemStream).mockImplementation(withFigures.impl);
    await act(async () => {
      await result.current.solve({ problemId: "p", options: { concept: true, solution: true } });
    });
    await waitFor(() => expect(result.current.figuresPhase).toBe("received"));
    expect(result.current.result?.figures).toEqual([FIG]);
    await act(async () => {
      withFigures.finish();
      await Promise.resolve();
    });
    expect(result.current.figuresPhase).toBe("received");
  });

  it("done 뒤 figures 없이 스트림이 끝나면 empty", async () => {
    vi.mocked(solveProblemStream).mockReturnValue(eventsOf([{ type: "done", result: SOLUTION }]));
    const { result } = renderHook(() => useSolveStream());
    await act(async () => {
      await result.current.solve({ problemId: "p", options: { concept: true, solution: true } });
    });
    await waitFor(() => expect(result.current.figuresPhase).toBe("empty"));
    expect(result.current.status).toBe("success");
  });

  it("done 뒤 네트워크 오류면 empty, status·결과 유지", async () => {
    const stream = openStream([{ type: "done", result: SOLUTION }]);
    vi.mocked(solveProblemStream).mockImplementation(stream.impl);
    const { result } = renderHook(() => useSolveStream());
    await act(async () => {
      await result.current.solve({ problemId: "p", options: { concept: true, solution: true } });
    });
    await act(async () => {
      stream.fail(new TypeError("network"));
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.figuresPhase).toBe("empty"));
    expect(result.current.status).toBe("success");
    expect(result.current.result).toEqual(SOLUTION);
    expect(result.current.errorMessage).toBeNull();
  });

  it("done 전 error 이벤트면 idle 유지", async () => {
    vi.mocked(solveProblemStream).mockReturnValue(eventsOf([{ type: "error", code: "provider_error", message: "실패" }]));
    const { result } = renderHook(() => useSolveStream());
    await act(async () => {
      await result.current.solve({ problemId: "p", options: { concept: true, solution: true } });
    });
    expect(result.current.status).toBe("error");
    expect(result.current.figuresPhase).toBe("idle");
  });
});

describe("useSolveStream — Stage 4 L-4 AbortController", () => {
  it("요청마다 signal을 넘기고, reset하면 abort — AbortError는 error 상태를 만들지 않고 idle로 돌아간다", async () => {
    const stream = openStream([{ type: "done", result: SOLUTION }]);
    vi.mocked(solveProblemStream).mockImplementation(stream.impl);
    const { result } = renderHook(() => useSolveStream());
    await act(async () => {
      await result.current.solve({ problemId: "p", options: { concept: true, solution: true } });
    });
    expect(vi.mocked(solveProblemStream).mock.calls.at(-1)?.[1]).toBe(stream.seen.signal);
    expect(stream.seen.signal?.aborted).toBe(false);

    act(() => result.current.reset());
    expect(stream.seen.signal?.aborted).toBe(true);
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.status).toBe("idle");
    expect(result.current.errorMessage).toBeNull();
    expect(result.current.figuresPhase).toBe("idle");
  });

  it("done 전(loading)에 reset해도 abort되고 solve()는 null로 끝나며 error 0", async () => {
    const stream = openStream([{ type: "chunk", delta: "풀이 중" }]);
    vi.mocked(solveProblemStream).mockImplementation(stream.impl);
    const { result } = renderHook(() => useSolveStream());
    let pending: Promise<unknown> = Promise.resolve();
    act(() => {
      pending = result.current.solve({ problemId: "p", options: { concept: true, solution: true } });
    });
    await waitFor(() => expect(result.current.streamedText).toBe("풀이 중"));
    act(() => result.current.reset());
    await act(async () => {
      expect(await pending).toBeNull();
    });
    expect(stream.seen.signal?.aborted).toBe(true);
    expect(result.current.status).toBe("idle");
    expect(result.current.errorMessage).toBeNull();
  });

  it("새 요청이 이전 요청을 abort하고, 새 요청의 done 결과는 그대로", async () => {
    const first = openStream([{ type: "done", result: SOLUTION }]);
    vi.mocked(solveProblemStream).mockImplementation(first.impl);
    const { result } = renderHook(() => useSolveStream());
    await act(async () => {
      await result.current.solve({ problemId: "p", options: { concept: true, solution: true } });
    });
    const second = openStream([{ type: "done", result: { ...SOLUTION, answerMd: "두 번째" } }]);
    vi.mocked(solveProblemStream).mockImplementation(second.impl);
    await act(async () => {
      await result.current.solve({ problemId: "p", options: { concept: true, solution: true } });
    });
    expect(first.seen.signal?.aborted).toBe(true);
    expect(second.seen.signal?.aborted).toBe(false);
    expect(result.current.status).toBe("success");
    expect(result.current.result?.answerMd).toBe("두 번째");
    expect(result.current.errorMessage).toBeNull();
    expect(result.current.figuresPhase).toBe("waiting");
  });

  it("언마운트하면 진행 중인 요청을 abort한다", async () => {
    const stream = openStream([{ type: "done", result: SOLUTION }]);
    vi.mocked(solveProblemStream).mockImplementation(stream.impl);
    const { result, unmount } = renderHook(() => useSolveStream());
    await act(async () => {
      await result.current.solve({ problemId: "p", options: { concept: true, solution: true } });
    });
    unmount();
    expect(stream.seen.signal?.aborted).toBe(true);
  });

  it("같은 요청에서 done 뒤 AbortError가 와도(외부 중단) error 0, done 결과 유지, figuresPhase empty", async () => {
    const stream = openStream([{ type: "done", result: SOLUTION }]);
    vi.mocked(solveProblemStream).mockImplementation(stream.impl);
    const { result } = renderHook(() => useSolveStream());
    await act(async () => {
      await result.current.solve({ problemId: "p", options: { concept: true, solution: true } });
    });
    await act(async () => {
      stream.fail(abortError());
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.figuresPhase).toBe("empty"));
    expect(result.current.status).toBe("success");
    expect(result.current.result).toEqual(SOLUTION);
    expect(result.current.errorMessage).toBeNull();
  });
});
