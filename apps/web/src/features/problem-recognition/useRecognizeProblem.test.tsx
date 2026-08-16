import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../../shared/api/ApiError";

vi.mock("../../shared/api/recognizeProblem", () => ({
  recognizeProblem: vi.fn(),
}));

vi.mock("../../shared/api/problemHistory", () => ({
  reopenProblemHistory: vi.fn(),
}));

const { recognizeProblem } = await import("../../shared/api/recognizeProblem");
const { reopenProblemHistory } = await import("../../shared/api/problemHistory");
const { useRecognizeProblem } = await import("./useRecognizeProblem");

describe("useRecognizeProblem", () => {
  it("성공하면 loading을 거쳐 success 상태가 되고 problemId/recognizedText를 채운다", async () => {
    vi.mocked(recognizeProblem).mockResolvedValue({
      problemId: "problem-1",
      recognizedText: "1+1=?",
      recognizedLatex: null,
      createdAt: "2026-08-01T00:00:00.000Z",
    });

    const { result } = renderHook(() => useRecognizeProblem());
    expect(result.current.status).toBe("idle");

    const blob = new Blob(["fake"], { type: "image/jpeg" });
    let returnedId: string | null = null;
    await act(async () => {
      returnedId = await result.current.recognize({ imageBlob: blob, inputType: "photo", grade: "M2" });
    });

    expect(returnedId).toBe("problem-1");
    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.problemId).toBe("problem-1");
    expect(result.current.recognizedText).toBe("1+1=?");
    expect(result.current.errorMessage).toBeNull();
  });

  it("ApiError가 발생하면 error 상태가 되고 서버 메시지를 그대로 노출한다", async () => {
    vi.mocked(recognizeProblem).mockRejectedValue(
      new ApiError("recognition_failed", "문제를 인식할 수 없습니다.", 422),
    );

    const { result } = renderHook(() => useRecognizeProblem());
    const blob = new Blob(["fake"], { type: "image/jpeg" });

    let returnedId: string | null = "not-null";
    await act(async () => {
      returnedId = await result.current.recognize({ imageBlob: blob, inputType: "photo", grade: "M2" });
    });

    expect(returnedId).toBeNull();
    expect(result.current.status).toBe("error");
    expect(result.current.errorMessage).toBe("문제를 인식할 수 없습니다.");
  });

  it("reset은 모든 상태를 idle로 되돌린다", async () => {
    vi.mocked(recognizeProblem).mockResolvedValue({
      problemId: "problem-1",
      recognizedText: "1+1=?",
      recognizedLatex: null,
      createdAt: "2026-08-01T00:00:00.000Z",
    });

    const { result } = renderHook(() => useRecognizeProblem());
    const blob = new Blob(["fake"], { type: "image/jpeg" });
    await act(async () => {
      await result.current.recognize({ imageBlob: blob, inputType: "photo", grade: "M2" });
    });

    act(() => result.current.reset());

    expect(result.current.status).toBe("idle");
    expect(result.current.problemId).toBeNull();
    expect(result.current.recognizedText).toBeNull();
    expect(result.current.errorMessage).toBeNull();
  });

  describe("resumeFromHistory(마이페이지 다시 풀기)", () => {
    it("이미지 없이 reopen API 결과로 recognize 상태를 재수화한다", async () => {
      vi.mocked(reopenProblemHistory).mockResolvedValue({
        problemId: "problem-2",
        recognizedText: "x^2 - 5x + 6 = 0을 풀어라",
        recognizedLatex: null,
        createdAt: "2026-08-16T11:00:00.000Z",
      });

      const { result } = renderHook(() => useRecognizeProblem());

      let returnedId: string | null = null;
      await act(async () => {
        returnedId = await result.current.resumeFromHistory("problem-1");
      });

      expect(reopenProblemHistory).toHaveBeenCalledWith("problem-1");
      expect(returnedId).toBe("problem-2");
      await waitFor(() => expect(result.current.status).toBe("success"));
      expect(result.current.problemId).toBe("problem-2");
      expect(result.current.recognizedText).toBe("x^2 - 5x + 6 = 0을 풀어라");
    });

    it("실패하면 recognize와 동일한 error 상태/메시지 경로를 사용한다", async () => {
      // 서버가 404에 어떤 `code`를 쓰는지는 계약에 없고 `ErrorCode`에도 없어서(`problemHistory.test.ts`
      // 동일 주석 참고) 타입에 존재하는 코드로 대신 만든다 — 훅은 `message`만 사용한다.
      vi.mocked(reopenProblemHistory).mockRejectedValue(
        new ApiError("internal_error", "기록을 찾을 수 없습니다.", 404),
      );

      const { result } = renderHook(() => useRecognizeProblem());

      let returnedId: string | null = "not-null";
      await act(async () => {
        returnedId = await result.current.resumeFromHistory("problem-x");
      });

      expect(returnedId).toBeNull();
      expect(result.current.status).toBe("error");
      expect(result.current.errorMessage).toBe("기록을 찾을 수 없습니다.");
    });
  });
});
