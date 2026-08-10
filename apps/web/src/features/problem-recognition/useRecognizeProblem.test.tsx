import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../../shared/api/ApiError";

vi.mock("../../shared/api/recognizeProblem", () => ({
  recognizeProblem: vi.fn(),
}));

const { recognizeProblem } = await import("../../shared/api/recognizeProblem");
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
});
