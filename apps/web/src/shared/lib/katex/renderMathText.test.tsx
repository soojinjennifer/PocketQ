import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderMathText } from "./renderMathText";

describe("renderMathText", () => {
  it("수식 구분자가 없으면 원본 텍스트를 그대로 렌더링한다", () => {
    const { container } = render(<div>{renderMathText("일반 텍스트입니다.")}</div>);

    expect(container.textContent).toBe("일반 텍스트입니다.");
    expect(container.querySelector(".katex")).toBeNull();
  });

  it("인라인 수식(\\( \\))을 KaTeX HTML로 변환한다", () => {
    const { container } = render(<div>{renderMathText("정답은 \\(x=2\\)입니다.")}</div>);

    expect(container.querySelector(".katex")).not.toBeNull();
    expect(container.textContent).toContain("정답은");
    expect(container.textContent).toContain("입니다.");
  });

  it("블록 수식(\\[ \\])을 displayMode로 렌더링한다", () => {
    const { container } = render(<div>{renderMathText("\\[\\boxed{x=2}\\]")}</div>);

    expect(container.querySelector(".katex-display")).not.toBeNull();
  });

  it("$...$/$$...$$ 구분자도 방어적으로 지원한다", () => {
    const { container } = render(<div>{renderMathText("$x=2$ 그리고 $$y=3$$")}</div>);

    const katexNodes = container.querySelectorAll(".katex");
    expect(katexNodes.length).toBe(2);
  });

  it("잘못된 수식은 예외를 던지지 않고 원본 구분자를 포함한 텍스트로 폴백한다", () => {
    const { container } = render(<div>{renderMathText("\\(\\frac{1\\)")}</div>);

    expect(container.querySelector(".katex")).toBeNull();
    expect(container.textContent).toContain("\\(\\frac{1\\)");
  });
});
