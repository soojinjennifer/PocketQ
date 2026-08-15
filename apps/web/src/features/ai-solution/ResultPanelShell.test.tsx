import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ResultPanelShell } from "./ResultPanelShell";

describe("ResultPanelShell", () => {
  it("width 기본값(default)에서 children을 렌더링하고 420px 폭 클래스를 적용한다", () => {
    const { container } = render(
      <ResultPanelShell onExtend={vi.fn()} onBackToDefault={vi.fn()} onClose={vi.fn()} onOpen={vi.fn()}>
        <div>결과 콘텐츠</div>
      </ResultPanelShell>,
    );

    expect(screen.getByText("결과 콘텐츠")).toBeInTheDocument();
    expect(container.querySelector(".w-\\[min\\(420px\\,45vw\\)\\]")).not.toBeNull();
  });

  it("width='extend'일 때 748px 폭 클래스를 적용한다", () => {
    const { container } = render(
      <ResultPanelShell
        width="extend"
        onExtend={vi.fn()}
        onBackToDefault={vi.fn()}
        onClose={vi.fn()}
        onOpen={vi.fn()}
      >
        <div>결과 콘텐츠</div>
      </ResultPanelShell>,
    );

    expect(screen.getByText("결과 콘텐츠")).toBeInTheDocument();
    expect(container.querySelector(".w-\\[min\\(748px\\,90vw\\)\\]")).not.toBeNull();
  });

  it("width='close'일 때 children을 렌더링하지 않고 24px(w-6) 폭 클래스를 적용한다", () => {
    const { container } = render(
      <ResultPanelShell
        width="close"
        onExtend={vi.fn()}
        onBackToDefault={vi.fn()}
        onClose={vi.fn()}
        onOpen={vi.fn()}
      >
        <div>결과 콘텐츠</div>
      </ResultPanelShell>,
    );

    expect(screen.queryByText("결과 콘텐츠")).not.toBeInTheDocument();
    expect(container.querySelector(".w-6")).not.toBeNull();
  });

  it("3가지 폭 상태 모두에서 ResultPanelResizeHandle을 렌더링한다", () => {
    render(
      <ResultPanelShell onExtend={vi.fn()} onBackToDefault={vi.fn()} onClose={vi.fn()} onOpen={vi.fn()}>
        <div>결과 콘텐츠</div>
      </ResultPanelShell>,
    );

    expect(screen.getByRole("button", { name: "넓게 보기" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "패널 접기" })).toBeInTheDocument();
  });

  it("핸들 클릭 시 전달된 콜백을 그대로 호출한다", () => {
    const onExtend = vi.fn();
    render(
      <ResultPanelShell
        onExtend={onExtend}
        onBackToDefault={vi.fn()}
        onClose={vi.fn()}
        onOpen={vi.fn()}
      >
        <div>결과 콘텐츠</div>
      </ResultPanelShell>,
    );

    fireEvent.click(screen.getByRole("button", { name: "넓게 보기" }));
    expect(onExtend).toHaveBeenCalledTimes(1);
  });
});
