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

describe("HistoryDetailPanel — Stage 5 높이·포커스(§18.7·§18.13, RS12·RS13)", () => {
  it("루트는 fixed inset-x-0 top-0 h-dvh(inset-0·vh 단위 없음)", () => {
    const { container } = render(
      <HistoryDetailPanel onClose={() => undefined}>
        <div />
      </HistoryDetailPanel>,
    );
    const root = container.firstElementChild;
    const tokens = (root?.getAttribute("class") ?? "").split(/\s+/);
    expect(tokens).toEqual(expect.arrayContaining(["fixed", "inset-x-0", "top-0", "h-dvh"]));
    expect(tokens).not.toContain("inset-0");
    expect(tokens.some((t) => /(^|:)(h|min-h|max-h)-screen$/.test(t) || /vh\b/.test(t.replace("dvh", "")))).toBe(false);
  });

  it("열면 '목록으로'에 포커스, 닫으면(언마운트) 열기 직전 포커스 요소로 복귀", () => {
    const opener = document.createElement("button");
    opener.textContent = "행";
    document.body.appendChild(opener);
    opener.focus();
    const view = render(
      <HistoryDetailPanel onClose={() => undefined}>
        <div />
      </HistoryDetailPanel>,
    );
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "목록으로" }));
    view.unmount();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it("열기 직전 요소가 사라졌거나 body였으면 getFallbackFocus 대상으로 간다", () => {
    const fallback = document.createElement("button");
    document.body.appendChild(fallback);
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    opener.focus();
    const view = render(
      <HistoryDetailPanel onClose={() => undefined} getFallbackFocus={() => fallback}>
        <div />
      </HistoryDetailPanel>,
    );
    opener.remove();
    view.unmount();
    expect(document.activeElement).toBe(fallback);

    (document.activeElement as HTMLElement | null)?.blur();
    expect(document.activeElement).toBe(document.body);
    const second = render(
      <HistoryDetailPanel onClose={() => undefined} getFallbackFocus={() => fallback}>
        <div />
      </HistoryDetailPanel>,
    );
    second.unmount();
    expect(document.activeElement).toBe(fallback);
    fallback.remove();
  });
});
