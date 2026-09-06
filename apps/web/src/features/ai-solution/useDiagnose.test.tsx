import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../../shared/api/ApiError";

vi.mock("../../shared/api/diagnoseProblem", () => ({
  diagnoseProblem: vi.fn(),
}));

const { diagnoseProblem } = await import("../../shared/api/diagnoseProblem");
const { useDiagnose } = await import("./useDiagnose");

const DIAGNOSIS = {
  lastValidLine: 1,
  stallLine: 2,
  errorTypeLabel: "부호 오류",
  errorDetail: "2번째 줄을 다시 확인하세요.",
  relatedConcepts: ["이차함수 > 완전제곱식"],
  reachedAnswerWithNotes: false,
  isLowConfidence: false,
  conceptExplanations: [],
  identifiedMethod: null,
  isMethodApplicable: true,
  methodApplicabilityNote: null,
};

describe("useDiagnose", () => {
  it("성공하면 loading을 거쳐 success 상태가 되고 diagnosis를 채운다", async () => {
    vi.mocked(diagnoseProblem).mockResolvedValue(DIAGNOSIS);

    const { result } = renderHook(() => useDiagnose());
    expect(result.current.status).toBe("idle");

    let returned: unknown = null;
    await act(async () => {
      returned = await result.current.diagnose({
        problemId: "problem-1",
        workLines: [{ lineNo: 1, latex: "x" }],
      });
    });

    expect(returned).toEqual(DIAGNOSIS);
    expect(result.current.status).toBe("success");
    expect(result.current.diagnosis).toEqual(DIAGNOSIS);
    expect(result.current.errorMessage).toBeNull();
  });

  it("ApiError가 발생하면 error 상태가 되고 서버 메시지를 그대로 노출한다", async () => {
    vi.mocked(diagnoseProblem).mockRejectedValue(
      new ApiError("validation_error", "문제를 찾을 수 없습니다.", 404),
    );

    const { result } = renderHook(() => useDiagnose());

    let returned: unknown = "not-null";
    await act(async () => {
      returned = await result.current.diagnose({
        problemId: "problem-1",
        workLines: [{ lineNo: 1, latex: "x" }],
      });
    });

    expect(returned).toBeNull();
    expect(result.current.status).toBe("error");
    expect(result.current.errorMessage).toBe("문제를 찾을 수 없습니다.");
  });

  it("reset은 모든 상태를 idle로 되돌린다", async () => {
    vi.mocked(diagnoseProblem).mockResolvedValue(DIAGNOSIS);

    const { result } = renderHook(() => useDiagnose());
    await act(async () => {
      await result.current.diagnose({ problemId: "problem-1", workLines: [{ lineNo: 1, latex: "x" }] });
    });

    act(() => result.current.reset());

    expect(result.current.status).toBe("idle");
    expect(result.current.diagnosis).toBeNull();
    expect(result.current.errorMessage).toBeNull();
  });
});
