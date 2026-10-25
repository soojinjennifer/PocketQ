/**
 * Stage 4 WU5(D-6) — `/dev/figures` 카드 표면을 `ElevatedCard`로 바꿔도 태그·클래스 토큰 집합이 교체 전과 같다.
 */
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../features/figure-visualization/jsxgraphAdapter", () => ({
  loadJsxGraph: () => new Promise(() => {}),
}));

const { FigurePreviewPage } = await import("./FigurePreviewPage");

/** 교체 전 `ELEVATED_CARD_STYLE` 원문. */
const BEFORE = "bg-bg-elevated rounded-[14px] p-4 drop-shadow-[0px_2px_0px_rgba(35,43,56,0.18),0px_7px_13px_rgba(35,43,56,0.11)]";

describe("FigurePreviewPage 카드 표면", () => {
  it("모든 카드(figure를 감싼 요소)가 div이고 class가 교체 전 상수와 같다", () => {
    const { container } = render(<FigurePreviewPage />);
    const cards = [...container.querySelectorAll("figure")].map((figure) => figure.parentElement);
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      expect(card?.tagName).toBe("DIV");
      expect((card?.getAttribute("class") ?? "").split(" ").sort()).toEqual(BEFORE.split(" ").sort());
    }
  });
});
