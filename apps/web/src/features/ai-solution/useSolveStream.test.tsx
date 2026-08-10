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
