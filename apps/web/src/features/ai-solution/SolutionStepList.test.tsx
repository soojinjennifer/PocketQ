/**
 * Stage 4 WU7 — 단계 블록(`docs/FIGURE_DESIGN.md` §17.3·§17.11·§17.12, S4-6).
 * 표지 없는 입력의 DOM 동일성은 `__baseline__/resultDom.baseline.test.tsx`(WU0 스냅샷)가 확인한다.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ResultCard } from "./ResultCard";
import { ResumeResultCard } from "./ResumeResultCard";
import { hidePartialStepMarker } from "./hidePartialStepMarker";
import { SolutionStepList } from "./SolutionStepList";

const THREE = "먼저 식을 정리합니다.\n**1단계** 그래프를 그립니다.\n**2단계** 꼭짓점 \\((2,-1)\\)\n을 찾습니다.\n**3단계** 근을 구합니다.";

describe("SolutionStepList", () => {
  it("S4-6: 표지가 있으면 별표 0, 블록 N개, 머리말 보존, 라벨 'N단계' 인라인 Semibold", () => {
    const { container } = render(<SolutionStepList body={THREE} />);
    expect(container.textContent).not.toContain("**");
    const items = container.querySelectorAll("ol > li");
    expect(items).toHaveLength(3);
    expect(container.querySelector("ol")?.className).toContain("list-none");
    expect(container.firstElementChild?.tagName).toBe("P");
    expect(container.firstElementChild?.textContent).toBe("먼저 식을 정리합니다.");
    const label = items[0]?.querySelector("p > span");
    expect(label?.textContent).toBe("1단계");
    expect(label?.className).toBe("font-[590]");
    expect(items[0]?.textContent).toBe("1단계 그래프를 그립니다.");
    expect(items[1]?.textContent).toContain("을 찾습니다.");
  });

  it("모든 블록은 항상 같은 여백(-mx-2 px-2 py-1.5), 선택 블록만 rounded·tint·ring + aria-current + sr-only", () => {
    const { container, rerender } = render(<SolutionStepList body={THREE} currentStep={2} />);
    const items = [...container.querySelectorAll("ol > li")];
    for (const item of items) {
      for (const token of ["-mx-2", "px-2", "py-1.5"]) expect(item.classList.contains(token)).toBe(true);
    }
    expect(items[1]?.getAttribute("aria-current")).toBe("step");
    for (const token of ["rounded-[10px]", "bg-fill-tint-brand", "ring-1", "ring-brand"]) expect(items[1]?.classList.contains(token)).toBe(true);
    expect(items[0]?.hasAttribute("aria-current")).toBe(false);
    expect(items[0]?.classList.contains("ring-1")).toBe(false);
    expect(screen.getByText("(그림에 표시 중)").className).toBe("sr-only");
    expect(container.querySelectorAll(".sr-only")).toHaveLength(1);

    rerender(<SolutionStepList body={THREE} currentStep={null} />);
    expect(container.querySelector("[aria-current]")).toBeNull();
    expect(container.querySelector(".ring-1")).toBeNull();
  });

  it("블록은 버튼이 아니다(버튼·tabindex·클릭 핸들러 없음), transition 클래스 없음", () => {
    const { container } = render(<SolutionStepList body={THREE} currentStep={1} />);
    expect(container.querySelector("button, [tabindex], [role='button']")).toBeNull();
    expect(container.innerHTML).not.toMatch(/transition/);
  });

  it("분할 실패(번호 건너뜀·줄 중간 표지·콜론 스타일)면 단일 본문 <p> 하나", () => {
    for (const body of ["**1단계** a\n**3단계** b", "앞 **1단계** 가운데", "**1단계: 식 세우기** 내용"]) {
      const { container, unmount } = render(<SolutionStepList body={body} />);
      expect(container.querySelector("ol")).toBeNull();
      expect(container.children).toHaveLength(1);
      expect(container.firstElementChild?.tagName).toBe("P");
      unmount();
    }
  });

  it("S4-6 스트리밍: 마지막 줄이 미완성 표지(**2단 등)면 숨기고, 완성되면 블록이 된다", () => {
    expect(hidePartialStepMarker("**1단계** a\n**2단", true)).toBe("**1단계** a");
    expect(hidePartialStepMarker("**1단계** a\n*", true)).toBe("**1단계** a");
    expect(hidePartialStepMarker("**1단계** a\n**2단", false)).toBe("**1단계** a\n**2단");
    expect(hidePartialStepMarker("**1단계** a\n**2단계** b", true)).toBe("**1단계** a\n**2단계** b");
    expect(hidePartialStepMarker("**1", true)).toBe("");

    const { container, rerender } = render(<SolutionStepList body={"**1단계** a\n**2단"} streaming />);
    expect(container.textContent).not.toContain("**");
    expect(container.querySelectorAll("ol > li")).toHaveLength(1);
    rerender(<SolutionStepList body={"**1단계** a\n**2단계** b"} streaming />);
    expect(container.querySelectorAll("ol > li")).toHaveLength(2);
  });

  it("ResultCard steps·ResumeResultCard가 분할 성공 시 블록을 쓰고, concept 카드는 표지가 있어도 그대로", () => {
    const steps = render(<ResultCard kind="steps" body={THREE} currentStep={3} />);
    expect(steps.container.querySelectorAll("ol > li")).toHaveLength(3);
    expect(steps.container.querySelector("[aria-current='step']")?.textContent).toContain("3단계");
    steps.unmount();
    const concept = render(<ResultCard kind="concept" body={THREE} />);
    expect(concept.container.querySelector("ol")).toBeNull();
    concept.unmount();
    const resume = render(
      <ResumeResultCard
        solution={{ mode: "own", methodName: "m", solutionMd: "**1단계** a\n**2단계** b", answerMd: "-1", verified: true }}
        currentStep={1}
        figureContent={<div data-testid="slot" />}
      />,
    );
    expect(resume.container.querySelectorAll("ol > li")).toHaveLength(2);
    // 배치: 이어풀기 카드 → 도형 슬롯 → AnswerBox
    const children = [...(resume.container.firstElementChild?.children ?? [])];
    // 재작업 1(P2-1): 슬롯 내용은 미리 렌더된 aria-live="off" 래퍼(FigureSlot) 안에 들어간다.
    expect(children[1]?.getAttribute("aria-live")).toBe("off");
    expect(children[1]?.firstElementChild?.getAttribute("data-testid")).toBe("slot");
    expect(children).toHaveLength(3);
  });
});
