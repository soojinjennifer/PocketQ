import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RecognizedProblemPopup } from "./RecognizedProblemPopup";

describe("RecognizedProblemPopup", () => {
  it("제목/캡션/인식된 문제 원문과 계속하기 버튼을 표시한다", () => {
    render(
      <RecognizedProblemPopup
        recognizedText="1 + 1 = ?"
        onContinue={() => {}}
        onCancelRecognition={() => {}}
      />,
    );

    expect(screen.getByText("문제가 인식 되었습니다")).toBeInTheDocument();
    expect(screen.getByText("촬영한 문제")).toBeInTheDocument();
    expect(screen.getByText("1 + 1 = ?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "계속하기" })).toBeInTheDocument();
  });

  it("계속하기 버튼을 누르면 onContinue를 호출한다", () => {
    const onContinue = vi.fn();
    render(
      <RecognizedProblemPopup
        recognizedText="1 + 1 = ?"
        onContinue={onContinue}
        onCancelRecognition={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "계속하기" }));

    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("recognizedText가 null이어도 렌더링에 실패하지 않는다", () => {
    render(
      <RecognizedProblemPopup
        recognizedText={null}
        onContinue={() => {}}
        onCancelRecognition={() => {}}
      />,
    );

    expect(screen.getByText("문제가 인식 되었습니다")).toBeInTheDocument();
  });

  describe("인식취소 버튼(오너 UX 결정: 인식취소 상시 배치, 사진 인식 직후 확인 팝업에도 취소 옵션 추가)", () => {
    it("'인식취소' 버튼을 표시하고, 클릭하면 onCancelRecognition을 호출한다", () => {
      const onCancelRecognition = vi.fn();
      render(
        <RecognizedProblemPopup
          recognizedText="1 + 1 = ?"
          onContinue={() => {}}
          onCancelRecognition={onCancelRecognition}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "인식취소" }));

      expect(onCancelRecognition).toHaveBeenCalledTimes(1);
    });

    it("'인식취소'를 눌러도 '계속하기'(onContinue)는 호출되지 않는다", () => {
      const onContinue = vi.fn();
      const onCancelRecognition = vi.fn();
      render(
        <RecognizedProblemPopup
          recognizedText="1 + 1 = ?"
          onContinue={onContinue}
          onCancelRecognition={onCancelRecognition}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "인식취소" }));

      expect(onCancelRecognition).toHaveBeenCalledTimes(1);
      expect(onContinue).not.toHaveBeenCalled();
    });
  });
});
