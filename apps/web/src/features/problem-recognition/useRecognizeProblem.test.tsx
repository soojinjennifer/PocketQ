import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../../shared/api/ApiError";
import { NetworkError } from "../../shared/api/NetworkError";

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

  describe("isConnectionError(연결 오류 판정)", () => {
    const blob = new Blob(["fake"], { type: "image/jpeg" });

    it("recognize가 NetworkError로 실패하면 true가 된다", async () => {
      vi.mocked(recognizeProblem).mockRejectedValue(new NetworkError("unreachable"));
      const { result } = renderHook(() => useRecognizeProblem());

      await act(async () => {
        await result.current.recognize({ imageBlob: blob, inputType: "photo", grade: "M2" });
      });

      expect(result.current.status).toBe("error");
      expect(result.current.isConnectionError).toBe(true);
    });

    it("타임아웃(NetworkError timeout)도 true다", async () => {
      vi.mocked(recognizeProblem).mockRejectedValue(new NetworkError("timeout"));
      const { result } = renderHook(() => useRecognizeProblem());

      await act(async () => {
        await result.current.recognize({ imageBlob: blob, inputType: "photo", grade: "M2" });
      });

      expect(result.current.isConnectionError).toBe(true);
    });

    it("서버가 응답한 실패(ApiError 4xx/5xx)는 false다", async () => {
      vi.mocked(recognizeProblem).mockRejectedValue(new ApiError("internal_error", "서버 오류", 500));
      const { result } = renderHook(() => useRecognizeProblem());

      await act(async () => {
        await result.current.recognize({ imageBlob: blob, inputType: "photo", grade: "M2" });
      });

      expect(result.current.status).toBe("error");
      expect(result.current.isConnectionError).toBe(false);
    });

    it("resumeFromHistory가 NetworkError로 실패해도 true가 된다", async () => {
      vi.mocked(reopenProblemHistory).mockRejectedValue(new NetworkError("unreachable"));
      const { result } = renderHook(() => useRecognizeProblem());

      await act(async () => {
        await result.current.resumeFromHistory("problem-1");
      });

      expect(result.current.status).toBe("error");
      expect(result.current.isConnectionError).toBe(true);
    });

    it("다음 요청이 loading으로 들어가면 false로 돌아가고, reset도 false로 되돌린다", async () => {
      vi.mocked(recognizeProblem).mockRejectedValueOnce(new NetworkError("unreachable"));
      const { result } = renderHook(() => useRecognizeProblem());

      await act(async () => {
        await result.current.recognize({ imageBlob: blob, inputType: "photo", grade: "M2" });
      });
      expect(result.current.isConnectionError).toBe(true);

      let resolveRecognize: (value: Awaited<ReturnType<typeof recognizeProblem>>) => void = () => undefined;
      vi.mocked(recognizeProblem).mockReturnValueOnce(
        new Promise((resolve) => {
          resolveRecognize = resolve;
        }),
      );
      let pending: Promise<string | null> = Promise.resolve(null);
      act(() => {
        pending = result.current.recognize({ imageBlob: blob, inputType: "photo", grade: "M2" });
      });
      expect(result.current.status).toBe("loading");
      expect(result.current.isConnectionError).toBe(false);

      await act(async () => {
        resolveRecognize({
          problemId: "problem-1",
          recognizedText: "1+1=?",
          recognizedLatex: null,
          createdAt: "2026-08-01T00:00:00.000Z",
        });
        await pending;
      });

      vi.mocked(recognizeProblem).mockRejectedValueOnce(new NetworkError("timeout"));
      await act(async () => {
        await result.current.recognize({ imageBlob: blob, inputType: "photo", grade: "M2" });
      });
      expect(result.current.isConnectionError).toBe(true);

      act(() => result.current.reset());
      expect(result.current.isConnectionError).toBe(false);
    });
  });
});
