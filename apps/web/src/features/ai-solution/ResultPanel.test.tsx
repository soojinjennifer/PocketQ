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

    // 카테고리 배지 자체가 없어야 한다(헤더의 "새 문제" 배지는 오너 결정으로 삭제됨, 2026-09).
    expect(screen.queryAllByText(/./).filter((el) => el.className.includes("bg-fill-tint-brand")).length).toBe(0);
  });

  it("editLabel/onEdit을 RecognizedProblemBar로 그대로 전달한다(마이페이지 '다시 풀기')", () => {
    const handleEdit = vi.fn();
    render(
      <ResultPanel
        recognizedText="문제"
        conceptMd={null}
        solutionMd={null}
        answerMd="42"
        onEdit={handleEdit}
        editLabel="다시 풀기"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "다시 풀기" }));
    expect(handleEdit).toHaveBeenCalledTimes(1);
  });

  it("editLabel을 전달하지 않으면 기존대로 '수정' 버튼이 유지된다", () => {
    render(<ResultPanel recognizedText="문제" conceptMd={null} solutionMd={null} answerMd="42" />);

    expect(screen.getByRole("button", { name: "수정" })).toBeDisabled();
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
