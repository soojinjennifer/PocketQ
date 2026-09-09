import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { PenRail } from "./PenRail";

function renderPenRail(activeTool: "pen" | "eraser" = "pen", positioned?: boolean) {
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
        positioned={positioned}
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

  it("positioned 기본값(생략 시)에서는 위치 클래스(absolute top-1/2 등)를 그대로 갖는다", () => {
    renderPenRail("pen");

    const container = screen.getByRole("button", { name: "펜" }).closest("div[class*='bg-glass-fill']");
    expect(container).toHaveClass("absolute");
    expect(container).toHaveClass("top-1/2");
    expect(container).toHaveClass("left-5");
    expect(container).toHaveClass("-translate-y-1/2");
  });

  it("positioned=false면 위치 클래스가 빠지고 나머지 스타일(배경/보더/그림자/flex 레이아웃)은 유지된다", () => {
    renderPenRail("pen", false);

    const container = screen.getByRole("button", { name: "펜" }).closest("div[class*='bg-glass-fill']");
    expect(container).not.toHaveClass("absolute");
    expect(container).not.toHaveClass("top-1/2");
    expect(container).not.toHaveClass("left-5");
    expect(container).not.toHaveClass("-translate-y-1/2");
    expect(container).toHaveClass("bg-glass-fill");
    expect(container).toHaveClass("border-glass-border");
    expect(container).toHaveClass("flex");
    expect(container).toHaveClass("flex-col");
    expect(container).toHaveClass("rounded-full");
  });
});
