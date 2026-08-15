import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ResultPanelResizeHandle } from "./ResultPanelResizeHandle";

describe("ResultPanelResizeHandle", () => {
  it("Default 상태에서는 '넓게 보기'/'패널 접기' 버튼을 보여준다", () => {
    render(
      <ResultPanelResizeHandle
        width="default"
        onExtend={vi.fn()}
        onBackToDefault={vi.fn()}
        onClose={vi.fn()}
        onOpen={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "넓게 보기" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "패널 접기" })).toBeInTheDocument();
  });

  it("Default 상태에서 위쪽 버튼 클릭 시 onExtend를 호출한다", () => {
    const onExtend = vi.fn();
    render(
      <ResultPanelResizeHandle
        width="default"
        onExtend={onExtend}
        onBackToDefault={vi.fn()}
        onClose={vi.fn()}
        onOpen={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "넓게 보기" }));
    expect(onExtend).toHaveBeenCalledTimes(1);
  });

  it("Default 상태에서 아래쪽 버튼 클릭 시 onClose를 호출한다", () => {
    const onClose = vi.fn();
    render(
      <ResultPanelResizeHandle
        width="default"
        onExtend={vi.fn()}
        onBackToDefault={vi.fn()}
        onClose={onClose}
        onOpen={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "패널 접기" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Extend 상태에서는 '기본 크기로 되돌리기'/'패널 접기' 버튼을 보여준다", () => {
    render(
      <ResultPanelResizeHandle
        width="extend"
        onExtend={vi.fn()}
        onBackToDefault={vi.fn()}
        onClose={vi.fn()}
        onOpen={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "기본 크기로 되돌리기" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "패널 접기" })).toBeInTheDocument();
  });

  it("Extend 상태에서 위쪽 버튼 클릭 시 onBackToDefault를 호출한다", () => {
    const onBackToDefault = vi.fn();
    render(
      <ResultPanelResizeHandle
        width="extend"
        onExtend={vi.fn()}
        onBackToDefault={onBackToDefault}
        onClose={vi.fn()}
        onOpen={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "기본 크기로 되돌리기" }));
    expect(onBackToDefault).toHaveBeenCalledTimes(1);
  });

  it("Extend 상태에서 아래쪽 버튼 클릭 시 onClose를 호출한다", () => {
    const onClose = vi.fn();
    render(
      <ResultPanelResizeHandle
        width="extend"
        onExtend={vi.fn()}
        onBackToDefault={vi.fn()}
        onClose={onClose}
        onOpen={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "패널 접기" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Close 상태에서는 '넓게 보기'/'패널 열기' 버튼을 보여준다", () => {
    render(
      <ResultPanelResizeHandle
        width="close"
        onExtend={vi.fn()}
        onBackToDefault={vi.fn()}
        onClose={vi.fn()}
        onOpen={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "넓게 보기" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "패널 열기" })).toBeInTheDocument();
  });

  it("Close 상태에서 위쪽 버튼 클릭 시 onExtend를 호출한다", () => {
    const onExtend = vi.fn();
    render(
      <ResultPanelResizeHandle
        width="close"
        onExtend={onExtend}
        onBackToDefault={vi.fn()}
        onClose={vi.fn()}
        onOpen={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "넓게 보기" }));
    expect(onExtend).toHaveBeenCalledTimes(1);
  });

  it("Close 상태에서 아래쪽 버튼 클릭 시 onOpen을 호출한다", () => {
    const onOpen = vi.fn();
    render(
      <ResultPanelResizeHandle
        width="close"
        onExtend={vi.fn()}
        onBackToDefault={vi.fn()}
        onClose={vi.fn()}
        onOpen={onOpen}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "패널 열기" }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
