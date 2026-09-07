import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RecognizedProblemPopup } from "./RecognizedProblemPopup";

describe("RecognizedProblemPopup", () => {
  it("제목/캡션/인식된 문제 원문과 계속하기 버튼을 표시한다", () => {
    render(<RecognizedProblemPopup recognizedText="1 + 1 = ?" onContinue={() => {}} />);

    expect(screen.getByText("문제가 인식 되었습니다")).toBeInTheDocument();
    expect(screen.getByText("촬영한 문제")).toBeInTheDocument();
    expect(screen.getByText("1 + 1 = ?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "계속하기" })).toBeInTheDocument();
  });

  it("계속하기 버튼을 누르면 onContinue를 호출한다", () => {
    const onContinue = vi.fn();
    render(<RecognizedProblemPopup recognizedText="1 + 1 = ?" onContinue={onContinue} />);

    fireEvent.click(screen.getByRole("button", { name: "계속하기" }));

    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("recognizedText가 null이어도 렌더링에 실패하지 않는다", () => {
    render(<RecognizedProblemPopup recognizedText={null} onContinue={() => {}} />);

    expect(screen.getByText("문제가 인식 되었습니다")).toBeInTheDocument();
  });
});
