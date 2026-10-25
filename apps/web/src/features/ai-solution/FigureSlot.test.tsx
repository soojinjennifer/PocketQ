/**
 * Stage 4 재작업 1 design P2-1 — 도형 슬롯 래퍼 고정.
 */
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ResultPanel } from "./ResultPanel";
import { ResumeResultCard } from "./ResumeResultCard";

const SOLUTION = { mode: "own" as const, methodName: "m", solutionMd: "**1단계** a", answerMd: "-1", verified: true };

describe("FigureSlot(aria-live=off 래퍼)", () => {
  it("figureContent가 null이면 내용 없이 래퍼만 미리 렌더하고, 내용이 생겨도 같은 래퍼 노드에 채워진다", () => {
    const { container, rerender } = render(
      <ResultPanel recognizedText="문제" conceptMd={null} solutionMd="**1단계** a" answerMd="-1" figureContent={null} />,
    );
    const slot = container.querySelector("[data-figure-slot]");
    expect(slot?.getAttribute("aria-live")).toBe("off");
    expect(slot?.childElementCount).toBe(0);
    rerender(
      <ResultPanel recognizedText="문제" conceptMd={null} solutionMd="**1단계** a" answerMd="-1" figureContent={<section>그림</section>} />,
    );
    expect(container.querySelector("[data-figure-slot]")).toBe(slot);
    expect(slot?.querySelector("section")?.textContent).toBe("그림");
  });

  it("보이는 자식이 없을 때 부모 gap-3을 상쇄하는 클래스(간격 누수 방지)", () => {
    const { container } = render(<ResumeResultCard solution={SOLUTION} figureContent={null} />);
    const slot = container.querySelector("[data-figure-slot]");
    expect(slot?.className).toBe("[&:not(:has(>:not([hidden])))]:-mt-3");
    // 이어풀기 카드 → 래퍼 → AnswerBox
    expect(slot?.previousElementSibling?.textContent).toContain("이어풀기");
    expect(slot?.nextElementSibling).not.toBeNull();
  });

  it("figureContent 미지정(MyPage·플래그 off)이면 래퍼 없음", () => {
    const panel = render(<ResultPanel recognizedText="문제" conceptMd={null} solutionMd="**1단계** a" answerMd="-1" />);
    expect(panel.container.querySelector("[data-figure-slot]")).toBeNull();
    panel.unmount();
    const resume = render(<ResumeResultCard solution={SOLUTION} />);
    expect(resume.container.querySelector("[data-figure-slot]")).toBeNull();
  });
});
