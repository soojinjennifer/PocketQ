import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PenRail } from "./PenRail";

interface RenderOptions {
  activeTool?: "pen" | "eraser";
  positioned?: boolean;
  canUndo?: boolean;
  canRedo?: boolean;
}

function renderPenRail({
  activeTool = "pen",
  positioned,
  canUndo = true,
  canRedo = true,
}: RenderOptions = {}) {
  const onSelectTool = vi.fn();
  const onUndo = vi.fn();
  const onRedo = vi.fn();
  const onClear = vi.fn();

  render(
    <PenRail
      activeTool={activeTool}
      onSelectTool={onSelectTool}
      onUndo={onUndo}
      onRedo={onRedo}
      onClear={onClear}
      canUndo={canUndo}
      canRedo={canRedo}
      positioned={positioned}
    />,
  );

  return { onSelectTool, onUndo, onRedo, onClear };
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
    renderPenRail({ activeTool: "eraser" });

    expect(screen.getByRole("button", { name: "지우개" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "펜" })).toHaveAttribute("aria-pressed", "false");
  });

  it("새로고침(Undo) 클릭 시 onUndo, 다시 실행(Redo) 클릭 시 onRedo를 호출한다", () => {
    const { onUndo, onRedo } = renderPenRail();

    fireEvent.click(screen.getByRole("button", { name: "새로고침" }));
    expect(onUndo).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "다시 실행" }));
    expect(onRedo).toHaveBeenCalledTimes(1);
  });

  it("canUndo=false면 Undo 버튼이 disabled/opacity-40이고 클릭해도 onUndo가 호출되지 않는다", () => {
    const { onUndo } = renderPenRail({ canUndo: false });

    const undoButton = screen.getByRole("button", { name: "새로고침" });
    expect(undoButton).toBeDisabled();
    expect(undoButton).toHaveClass("opacity-40");

    fireEvent.click(undoButton);
    expect(onUndo).not.toHaveBeenCalled();
  });

  it("canRedo=false면 Redo 버튼이 disabled/opacity-40이고 클릭해도 onRedo가 호출되지 않는다", () => {
    const { onRedo } = renderPenRail({ canRedo: false });

    const redoButton = screen.getByRole("button", { name: "다시 실행" });
    expect(redoButton).toBeDisabled();
    expect(redoButton).toHaveClass("opacity-40");

    fireEvent.click(redoButton);
    expect(onRedo).not.toHaveBeenCalled();
  });

  it("전체 삭제 버튼은 aria-label='전체 삭제'이고 2줄 텍스트('전체'/'삭제')를 갖으며 클릭 시 onClear를 호출한다", () => {
    const { onClear } = renderPenRail();

    const clearButton = screen.getByRole("button", { name: "전체 삭제" });
    expect(clearButton).toHaveTextContent("전체");
    expect(clearButton).toHaveTextContent("삭제");

    fireEvent.click(clearButton);
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("카메라(사진) 버튼은 더 이상 렌더링되지 않는다(CameraRailButton으로 분리됨)", () => {
    renderPenRail();

    expect(screen.queryByRole("button", { name: "사진" })).not.toBeInTheDocument();
  });

  it("Undo 아이콘은 좌우 반전(-scale-x-100)되고 Redo 아이콘은 반전되지 않는다(Figma 42:158 실측)", () => {
    renderPenRail();

    const undoButton = screen.getByRole("button", { name: "새로고침" });
    const redoButton = screen.getByRole("button", { name: "다시 실행" });

    expect(undoButton.querySelector("span")).toHaveClass("-scale-x-100");
    expect(redoButton.querySelector("span")).not.toBeInTheDocument();
  });

  it("버튼 순서는 펜 → 지우개 → Undo → Redo → 전체 삭제 순이다", () => {
    renderPenRail();

    const buttons = screen.getAllByRole("button");
    const labels = buttons.map((button) => button.getAttribute("aria-label"));
    expect(labels).toEqual(["펜", "지우개", "새로고침", "다시 실행", "전체 삭제"]);
  });

  it("positioned 기본값(생략 시)에서는 위치 클래스(absolute top-1/2 등)를 그대로 갖는다", () => {
    renderPenRail();

    const container = screen.getByRole("button", { name: "펜" }).closest("div[class*='bg-glass-fill']");
    expect(container).toHaveClass("absolute");
    expect(container).toHaveClass("top-1/2");
    expect(container).toHaveClass("left-5");
    expect(container).toHaveClass("-translate-y-1/2");
  });

  it("positioned=false면 위치 클래스가 빠지고 나머지 스타일(배경/보더/그림자/flex 레이아웃)은 유지된다", () => {
    renderPenRail({ positioned: false });

    const container = screen.getByRole("button", { name: "펜" }).closest("div[class*='bg-glass-fill']");
    expect(container).not.toHaveClass("absolute");
    expect(container).not.toHaveClass("top-1/2");
    expect(container).not.toHaveClass("left-5");
    expect(container).not.toHaveClass("-translate-y-1/2");
    expect(container).toHaveClass("bg-glass-fill");
    expect(container).toHaveClass("border-separator");
    expect(container).toHaveClass("flex");
    expect(container).toHaveClass("flex-col");
    expect(container).toHaveClass("rounded-full");
  });
});
