import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChatBubble } from "./ChatBubble";

describe("ChatBubble", () => {
  it("role=user는 우측 정렬 + bg-fill-tint-brand 톤으로 렌더링된다", () => {
    const { container } = render(<ChatBubble role="user" content="왜 이렇게 풀어요?" />);

    expect(screen.getByText("왜 이렇게 풀어요?")).toBeInTheDocument();
    expect(container.querySelector(".justify-end")).not.toBeNull();
    expect(container.querySelector(".bg-fill-tint-brand")).not.toBeNull();
  });

  it("role=assistant는 ResultCard/AnswerBox와 동일하게 패널 폭을 꽉 채우는 bg-bg-elevated 카드로 렌더링된다(max-w 제한 없음)", () => {
    const { container } = render(<ChatBubble role="assistant" content="이렇게 풀면 돼요." />);

    expect(screen.getByText("이렇게 풀면 돼요.")).toBeInTheDocument();
    expect(container.querySelector(".bg-bg-elevated")).not.toBeNull();
    expect(container.querySelector(".max-w-\\[85\\%\\]")).toBeNull();
  });

  it("content 안의 수식 구분자를 KaTeX로 렌더링한다(renderMathText 재사용)", () => {
    // JSX의 순수 문자열 attribute(따옴표만 사용하는 형태)는 JS 이스케이프를 해석하지 않으므로
    // `\\(`이 그대로 두 개의 백슬래시로 전달된다 — 표현식 컨테이너(`{"..."}`)로 감싸 일반 JS
    // 문자열 이스케이프 규칙을 적용한다(`renderMathText.test.tsx`와 동일한 입력 형태).
    const { container } = render(<ChatBubble role="assistant" content={"정답은 \\(x=2\\)입니다."} />);

    expect(container.querySelector(".katex")).not.toBeNull();
  });
});
