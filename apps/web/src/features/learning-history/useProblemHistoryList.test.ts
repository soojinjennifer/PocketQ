import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../shared/api/ApiError";

vi.mock("../../shared/api/problemHistory", () => ({
  listProblemHistory: vi.fn(),
  getProblemHistoryDetail: vi.fn(),
}));

const { listProblemHistory } = await import("../../shared/api/problemHistory");
const { useProblemHistoryList } = await import("./useProblemHistoryList");

const ITEMS = [
  {
    problemId: "problem-1",
    recognizedText: "x^2 - 5x + 6 = 0을 풀어라",
    conceptTags: ["이차방정식"],
    createdAt: "2026-08-16T10:00:00.000Z",
  },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useProblemHistoryList", () => {
  it("마운트 시 목록을 조회하고 success 상태로 items를 채운다", async () => {
    vi.mocked(listProblemHistory).mockResolvedValue({ items: ITEMS });

    const { result } = renderHook(() => useProblemHistoryList());
    expect(result.current.status).toBe("loading");

    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.items).toEqual(ITEMS);
    expect(result.current.errorMessage).toBeNull();
    expect(listProblemHistory).toHaveBeenCalledTimes(1);
  });

  it("서버 정렬 결과를 그대로 유지한다(클라이언트에서 재정렬하지 않는다)", async () => {
    const unsorted = [
      { ...ITEMS[0]!, problemId: "b", createdAt: "2026-08-10T00:00:00.000Z" },
      { ...ITEMS[0]!, problemId: "a", createdAt: "2026-08-16T00:00:00.000Z" },
    ];
    vi.mocked(listProblemHistory).mockResolvedValue({ items: unsorted });

    const { result } = renderHook(() => useProblemHistoryList());
    await waitFor(() => expect(result.current.status).toBe("success"));

    expect(result.current.items.map((item) => item.problemId)).toEqual(["b", "a"]);
  });

  it("실패하면 error 상태와 사용자 안내 문구를 반환한다(기술적 메시지를 노출하지 않는다)", async () => {
    vi.mocked(listProblemHistory).mockRejectedValue(
      new ApiError("internal_error", "DB connection refused at 127.0.0.1:5432", 500),
    );

    const { result } = renderHook(() => useProblemHistoryList());

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.errorMessage).toBe("풀이 기록을 불러오지 못했습니다.");
    expect(result.current.errorMessage).not.toContain("127.0.0.1");
  });

  it("reload()를 호출하면 다시 조회한다", async () => {
    vi.mocked(listProblemHistory).mockRejectedValueOnce(
      new ApiError("internal_error", "실패", 500),
    );
    vi.mocked(listProblemHistory).mockResolvedValueOnce({ items: ITEMS });

    const { result } = renderHook(() => useProblemHistoryList());
    await waitFor(() => expect(result.current.status).toBe("error"));

    act(() => {
      result.current.reload();
    });

    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.items).toEqual(ITEMS);
    expect(listProblemHistory).toHaveBeenCalledTimes(2);
  });
});
