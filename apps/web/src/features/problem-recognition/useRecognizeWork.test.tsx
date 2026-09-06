import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../../shared/api/ApiError";

vi.mock("../../shared/api/recognizeWork", () => ({
  recognizeWork: vi.fn(),
}));

const { recognizeWork } = await import("../../shared/api/recognizeWork");
const { useRecognizeWork } = await import("./useRecognizeWork");

describe("useRecognizeWork", () => {
  it("성공하면 loading을 거쳐 success 상태가 되고 workLines를 채운다", async () => {
    vi.mocked(recognizeWork).mockResolvedValue({
      workLines: [{ lineNo: 1, latex: "y = x^{2}", isLowConfidence: false }],
    });

    const { result } = renderHook(() => useRecognizeWork());
    expect(result.current.status).toBe("idle");

    const blob = new Blob(["fake"], { type: "image/jpeg" });
    let returned: unknown = null;
    await act(async () => {
      returned = await result.current.recognizeWork({ problemId: "problem-1", imageBlob: blob });
    });

    expect(returned).toEqual([{ lineNo: 1, latex: "y = x^{2}", isLowConfidence: false }]);
    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.workLines).toEqual([{ lineNo: 1, latex: "y = x^{2}", isLowConfidence: false }]);
    expect(result.current.errorMessage).toBeNull();
  });

  it("ApiError가 발생하면 error 상태가 되고 서버 메시지를 그대로 노출한다", async () => {
    vi.mocked(recognizeWork).mockRejectedValue(
      new ApiError("validation_error", "문제를 찾을 수 없습니다.", 404),
    );

    const { result } = renderHook(() => useRecognizeWork());
    const blob = new Blob(["fake"], { type: "image/jpeg" });

    let returned: unknown = "not-null";
    await act(async () => {
      returned = await result.current.recognizeWork({ problemId: "problem-1", imageBlob: blob });
    });

    expect(returned).toBeNull();
    expect(result.current.status).toBe("error");
    expect(result.current.errorMessage).toBe("문제를 찾을 수 없습니다.");
  });

  it("reset은 모든 상태를 idle로 되돌린다", async () => {
    vi.mocked(recognizeWork).mockResolvedValue({
      workLines: [{ lineNo: 1, latex: "y = x^{2}", isLowConfidence: false }],
    });

    const { result } = renderHook(() => useRecognizeWork());
    const blob = new Blob(["fake"], { type: "image/jpeg" });
    await act(async () => {
      await result.current.recognizeWork({ problemId: "problem-1", imageBlob: blob });
    });

    act(() => result.current.reset());

    expect(result.current.status).toBe("idle");
    expect(result.current.workLines).toBeNull();
    expect(result.current.errorMessage).toBeNull();
  });
});
