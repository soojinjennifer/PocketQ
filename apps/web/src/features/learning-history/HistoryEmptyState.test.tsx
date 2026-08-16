import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HistoryEmptyState } from "./HistoryEmptyState";

describe("HistoryEmptyState", () => {
  it("안내 문구와 CTA 버튼을 렌더링한다", () => {
    render(<HistoryEmptyState onStartSolve={() => undefined} />);

    expect(screen.getByText("아직 풀이한 문제가 없어요")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "문제 풀러 가기" })).toBeInTheDocument();
  });

  it("CTA 클릭 시 onStartSolve를 호출한다", () => {
    const handleStart = vi.fn();
    render(<HistoryEmptyState onStartSolve={handleStart} />);

    fireEvent.click(screen.getByRole("button", { name: "문제 풀러 가기" }));
    expect(handleStart).toHaveBeenCalledTimes(1);
  });

  it("새 일러스트/이미지 자산을 만들지 않는다(텍스트 + 버튼만)", () => {
    const { container } = render(<HistoryEmptyState onStartSolve={() => undefined} />);

    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")).toBeNull();
  });
});
