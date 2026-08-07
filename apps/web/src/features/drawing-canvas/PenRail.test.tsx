import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { PenRail } from "./PenRail";

function renderPenRail(activeTool: "pen" | "eraser" = "pen") {
  const onSelectTool = vi.fn();
  const onUndo = vi.fn();
  const onClear = vi.fn();

  render(
    <MemoryRouter>
      <PenRail
        activeTool={activeTool}
        onSelectTool={onSelectTool}
        onUndo={onUndo}
        onClear={onClear}
      />
    </MemoryRouter>,
  );

  return { onSelectTool, onUndo, onClear };
}

describe("PenRail", () => {
  it("펜/지우개 클릭 시 onSelectTool을 해당 도구와 함께 호출한다", () => {
    const { onSelectTool } = renderPenRail();

    fireEvent.click(screen.getByRole("button", { name: "지우개" }));
    expect(onSelectTool).toHaveBeenCalledWith("eraser");

    fireEvent.click(screen.getByRole("button", { name: "펜" }));
    expect(onSelectTool).toHaveBeenCalledWith("pen");
  });

  it("현재 activeTool과 일치하는 버튼만 aria-pressed=true를 갖는다", () => {
    renderPenRail("eraser");

    expect(screen.getByRole("button", { name: "지우개" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "펜" })).toHaveAttribute("aria-pressed", "false");
  });

  it("새로고침 클릭 시 onUndo, 취소 클릭 시 onClear를 호출한다", () => {
    const { onUndo, onClear } = renderPenRail();

    fireEvent.click(screen.getByRole("button", { name: "새로고침" }));
    expect(onUndo).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
