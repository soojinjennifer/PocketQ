import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ELEVATED_CARD_SURFACE, ElevatedCard } from "./ElevatedCard";

/** 교체 전 `features/ai-solution/elevatedCardStyle.ts`의 `ELEVATED_CARD_STYLE` 값(삭제 전 원문). */
const PREVIOUS_ELEVATED_CARD_STYLE =
  "bg-bg-elevated rounded-[14px] p-4 drop-shadow-[0px_2px_0px_rgba(35,43,56,0.18),0px_7px_13px_rgba(35,43,56,0.11)]";

describe("ElevatedCard", () => {
  it("표면 클래스는 이전 상수와 같다(값 불변)", () => {
    expect(ELEVATED_CARD_SURFACE).toBe(PREVIOUS_ELEVATED_CARD_STYLE);
  });

  it("기본 태그는 div, className은 표면 뒤에 붙는다", () => {
    const { container } = render(<ElevatedCard className="flex flex-col gap-2">본문</ElevatedCard>);
    const root = container.firstElementChild;
    expect(root?.tagName).toBe("DIV");
    expect(root?.getAttribute("class")).toBe(`${PREVIOUS_ELEVATED_CARD_STYLE} flex flex-col gap-2`);
  });

  it("as로 section/article을 쓰고 aria·id를 전달한다", () => {
    const { container } = render(
      <>
        <ElevatedCard as="section" aria-labelledby="cap" id="card-1">
          a
        </ElevatedCard>
        <ElevatedCard as="article">b</ElevatedCard>
      </>,
    );
    const [section, article] = [...container.children];
    expect(section?.tagName).toBe("SECTION");
    expect(section?.getAttribute("aria-labelledby")).toBe("cap");
    expect(section?.id).toBe("card-1");
    expect(article?.tagName).toBe("ARTICLE");
    expect(article?.getAttribute("class")).toBe(PREVIOUS_ELEVATED_CARD_STYLE);
  });
});
