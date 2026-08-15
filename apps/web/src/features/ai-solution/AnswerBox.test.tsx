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
});
