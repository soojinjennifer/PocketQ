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
