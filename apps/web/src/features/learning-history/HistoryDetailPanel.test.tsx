import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HistoryDetailPanel } from "./HistoryDetailPanel";

describe("HistoryDetailPanel", () => {
  it("children을 그대로 렌더링한다(다른 feature 컴포넌트는 페이지가 주입한다)", () => {
    render(
      <HistoryDetailPanel onClose={() => undefined}>
        <div data-testid="detail-content">풀이 결과</div>
      </HistoryDetailPanel>,
    );

    expect(screen.getByTestId("detail-content")).toBeInTheDocument();
  });

  it("dialog 시맨틱을 갖는다", () => {
    render(
      <HistoryDetailPanel onClose={() => undefined}>
        <div />
      </HistoryDetailPanel>,
    );

    const dialog = screen.getByRole("dialog", { name: "지난 풀이 다시 보기" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("'목록으로' 버튼을 누르면 onClose를 호출한다", () => {
    const handleClose = vi.fn();
    render(
      <HistoryDetailPanel onClose={handleClose}>
        <div />
      </HistoryDetailPanel>,
    );

    fireEvent.click(screen.getByRole("button", { name: "목록으로" }));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("Escape 키로도 닫힌다", () => {
    const handleClose = vi.fn();
    render(
      <HistoryDetailPanel onClose={handleClose}>
        <div />
      </HistoryDetailPanel>,
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("ResultPanelShell과 동일한 유리 패널 토큰 클래스를 사용한다(새 값을 만들지 않는다)", () => {
    render(
      <HistoryDetailPanel onClose={() => undefined}>
        <div />
      </HistoryDetailPanel>,
    );

    const dialog = screen.getByRole("dialog", { name: "지난 풀이 다시 보기" });
    expect(dialog.className).toContain("bg-glass-fill");
    expect(dialog.className).toContain("border-glass-border");
    expect(dialog.className).toContain("rounded-[24px]");
  });
});
