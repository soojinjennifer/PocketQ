import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ResultPanel } from "./ResultPanel";

describe("ResultPanel", () => {
  it("제목/카테고리 배지/인식된 문제/개념/풀이/답을 모두 렌더링한다", () => {
    render(
      <ResultPanel
        category="이차함수 › 최대·최소"
        recognizedText="x^2 - 5x + 6 = 0을 풀어라"
        conceptMd="이차방정식은 인수분해로 풀 수 있다."
        solutionMd="1단계: 인수분해한다. 2단계: 근을 구한다."
        answerMd="x = 2 또는 x = 3"
      />,
    );

    expect(screen.getByText("풀이 결과")).toBeInTheDocument();
    expect(screen.getByText("이차함수 › 최대·최소")).toBeInTheDocument();
    expect(screen.getByText("x^2 - 5x + 6 = 0을 풀어라")).toBeInTheDocument();
    expect(screen.getByText("관련 개념")).toBeInTheDocument();
    expect(screen.getByText("단계별 풀이")).toBeInTheDocument();
    expect(screen.getByText(/x = 2 또는 x = 3/)).toBeInTheDocument();
    expect(screen.getByText("새 문제")).toBeInTheDocument();
  });

  it("conceptMd/solutionMd가 null이면 해당 카드를 렌더링하지 않는다", () => {
    render(
      <ResultPanel
        recognizedText="문제"
        conceptMd={null}
        solutionMd={null}
        answerMd="42"
      />,
    );

    expect(screen.queryByText("관련 개념")).not.toBeInTheDocument();
    expect(screen.queryByText("단계별 풀이")).not.toBeInTheDocument();
  });

  it("category가 없으면 카테고리 배지를 렌더링하지 않는다", () => {
    render(<ResultPanel recognizedText="문제" conceptMd={null} solutionMd={null} answerMd="42" />);

    // "새 문제" 배지만 남아야 한다(카테고리 배지가 없어야 함).
    expect(screen.getAllByText(/./).filter((el) => el.className.includes("bg-fill-tint-brand")).length).toBe(1);
  });

  it("onNewProblem이 있으면 '새 문제' 배지가 클릭 가능하다", () => {
    const handleNewProblem = vi.fn();
    render(
      <ResultPanel
        recognizedText="문제"
        conceptMd={null}
        solutionMd={null}
        answerMd="42"
        onNewProblem={handleNewProblem}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "새 문제" }));
    expect(handleNewProblem).toHaveBeenCalledTimes(1);
  });

  it("onNewProblem이 없으면 '새 문제' 배지는 비상호작용 표시로만 렌더링된다", () => {
    render(<ResultPanel recognizedText="문제" conceptMd={null} solutionMd={null} answerMd="42" />);

    expect(screen.queryByRole("button", { name: "새 문제" })).not.toBeInTheDocument();
    expect(screen.getByText("새 문제")).toBeInTheDocument();
  });

  it("chatContent/chatFooter가 없으면 후속 질문 관련 슬롯을 아예 렌더링하지 않는다", () => {
    const { container } = render(
      <ResultPanel recognizedText="문제" conceptMd={null} solutionMd={null} answerMd="42" />,
    );

    expect(container.querySelector('[aria-label="후속 질문 입력"]')).toBeNull();
  });

  it("chatContent/chatFooter 슬롯을 전달하면 그대로 렌더링한다(features/follow-up-chat를 직접 import하지 않고 슬롯으로만 받는다)", () => {
    render(
      <ResultPanel
        recognizedText="문제"
        conceptMd={null}
        solutionMd={null}
        answerMd="42"
        chatContent={<div data-testid="chat-content">채팅 콘텐츠</div>}
        chatFooter={<div data-testid="chat-footer">채팅 푸터</div>}
      />,
    );

    expect(screen.getByTestId("chat-content")).toBeInTheDocument();
    expect(screen.getByTestId("chat-footer")).toBeInTheDocument();
  });
});
