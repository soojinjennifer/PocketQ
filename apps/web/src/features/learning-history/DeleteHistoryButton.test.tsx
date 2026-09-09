import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DeleteHistoryButton } from "./DeleteHistoryButton";

describe("DeleteHistoryButton", () => {
  it("선택된 항목이 없으면(disabled) 클릭해도 onClick이 호출되지 않는다", () => {
    const handleClick = vi.fn();
    render(<DeleteHistoryButton disabled onClick={handleClick} />);

    const button = screen.getByRole("button", { name: "풀이 내역 지우기" });
    expect(button).toBeDisabled();

    fireEvent.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it("선택된 항목이 있으면(활성) 클릭 시 onClick을 호출한다", () => {
    const handleClick = vi.fn();
    render(<DeleteHistoryButton disabled={false} onClick={handleClick} />);

    const button = screen.getByRole("button", { name: "풀이 내역 지우기" });
    expect(button).not.toBeDisabled();

    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("언마운트되지 않고 항상 렌더링된다(편집모드 진입 트리거 없음)", () => {
    const { rerender } = render(<DeleteHistoryButton disabled onClick={() => undefined} />);
    expect(screen.getByRole("button", { name: "풀이 내역 지우기" })).toBeInTheDocument();

    rerender(<DeleteHistoryButton disabled={false} onClick={() => undefined} />);
    expect(screen.getByRole("button", { name: "풀이 내역 지우기" })).toBeInTheDocument();
  });
});
