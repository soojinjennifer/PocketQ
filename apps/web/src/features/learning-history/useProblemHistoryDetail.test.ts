import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProblemHistoryDetailDto } from "validation";
import { ApiError } from "../../shared/api/ApiError";

vi.mock("../../shared/api/problemHistory", () => ({
  listProblemHistory: vi.fn(),
  getProblemHistoryDetail: vi.fn(),
}));

const { getProblemHistoryDetail } = await import("../../shared/api/problemHistory");
const { useProblemHistoryDetail } = await import("./useProblemHistoryDetail");

const DETAIL: ProblemHistoryDetailDto = {
  problemId: "problem-1",
  recognizedText: "x^2 - 5x + 6 = 0을 풀어라",
  recognizedLatex: null,
  createdAt: "2026-08-16T10:00:00.000Z",
  solution: {
    conceptMd: "이차방정식",
    solutionMd: "인수분해한다",
    answerMd: "x = 2 또는 x = 3",
    conceptTags: ["이차방정식"],
    aiProvider: "openai",
    aiModel: "gpt-5",
  },
  chatMessages: [],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useProblemHistoryDetail", () => {
  it("problemId가 null이면 요청을 보내지 않고 idle을 유지한다", () => {
    const { result } = renderHook(() => useProblemHistoryDetail(null));

    expect(result.current.status).toBe("idle");
    expect(result.current.detail).toBeNull();
    expect(getProblemHistoryDetail).not.toHaveBeenCalled();
  });

  it("problemId가 주어지면 상세를 조회해 success 상태로 채운다", async () => {
    vi.mocked(getProblemHistoryDetail).mockResolvedValue(DETAIL);

    const { result } = renderHook(() => useProblemHistoryDetail("problem-1"));
    expect(result.current.status).toBe("loading");

    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.detail).toEqual(DETAIL);
    expect(getProblemHistoryDetail).toHaveBeenCalledWith("problem-1");
  });

  it("problemId가 바뀌면 다시 조회한다", async () => {
    vi.mocked(getProblemHistoryDetail).mockResolvedValue(DETAIL);

    const { result, rerender } = renderHook<
      ReturnType<typeof useProblemHistoryDetail>,
      { id: string | null }
    >(({ id }) => useProblemHistoryDetail(id), { initialProps: { id: "problem-1" } });
    await waitFor(() => expect(result.current.status).toBe("success"));

    rerender({ id: "problem-2" });
    await waitFor(() => expect(getProblemHistoryDetail).toHaveBeenCalledWith("problem-2"));
    expect(getProblemHistoryDetail).toHaveBeenCalledTimes(2);
  });

  it("problemId가 null로 돌아가면 idle로 초기화된다(오버레이 닫기)", async () => {
    vi.mocked(getProblemHistoryDetail).mockResolvedValue(DETAIL);

    const { result, rerender } = renderHook<
      ReturnType<typeof useProblemHistoryDetail>,
      { id: string | null }
    >(({ id }) => useProblemHistoryDetail(id), { initialProps: { id: "problem-1" } });
    await waitFor(() => expect(result.current.status).toBe("success"));

    rerender({ id: null });
    expect(result.current.status).toBe("idle");
    expect(result.current.detail).toBeNull();
  });

  it("404면 기록을 찾을 수 없다는 문구를 반환한다", async () => {
    // 404의 `code` 문자열은 계약에 명시돼 있지 않다 — 훅은 status만 보고 문구를 고른다.
    vi.mocked(getProblemHistoryDetail).mockRejectedValue(
      new ApiError("internal_error", "problem row 4f2c not visible for user 91ab", 404),
    );

    const { result } = renderHook(() => useProblemHistoryDetail("problem-x"));

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.errorMessage).toBe("이 풀이 기록을 찾을 수 없습니다.");
  });

  it("그 외 실패는 일반 안내 문구를 반환한다(기술적 메시지 비노출)", async () => {
    vi.mocked(getProblemHistoryDetail).mockRejectedValue(
      new ApiError("internal_error", "DB connection refused at 127.0.0.1:5432", 500),
    );

    const { result } = renderHook(() => useProblemHistoryDetail("problem-1"));

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.errorMessage).toBe("풀이 기록을 불러오지 못했습니다.");
    expect(result.current.errorMessage).not.toContain("127.0.0.1");
  });
});
