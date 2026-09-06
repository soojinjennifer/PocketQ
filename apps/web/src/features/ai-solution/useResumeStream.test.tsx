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
