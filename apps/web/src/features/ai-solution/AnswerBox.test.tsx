import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AnswerBox } from "./AnswerBox";

describe("AnswerBox", () => {
  it("'최종 답 ·' 접두사와 함께 answerMd를 보여준다", () => {
    render(<AnswerBox answerMd="x = 2 또는 x = 3" />);

    expect(screen.getByText("최종 답 ·", { exact: false })).toBeInTheDocument();
    expect(screen.getByText(/x = 2 또는 x = 3/)).toBeInTheDocument();
  });

  it("블록 수식(\\[ \\])이 포함된 answerMd를 KaTeX로 렌더링한다", () => {
    const { container } = render(<AnswerBox answerMd={"\\[x=2\\]"} />);

    expect(container.querySelector(".katex")).not.toBeNull();
  });

  it("tone='resume'이면 brand-tint 배경과 radius-18을 적용한다(RESUME-3 최종 답 배너)", () => {
    const { container } = render(<AnswerBox answerMd="x = 2" tone="resume" />);

    const box = container.firstElementChild;
    expect(box).toHaveClass("bg-brand-tint");
    expect(box).toHaveClass("rounded-[18px]");
  });

  it("tone 기본값('default')은 기존 배경/모서리를 그대로 유지한다(회귀 방지)", () => {
    const { container } = render(<AnswerBox answerMd="x = 2" />);

    const box = container.firstElementChild;
    expect(box).toHaveClass("bg-fill-tint-brand");
    expect(box).toHaveClass("rounded-[14px]");
  });
});
