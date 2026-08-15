import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RecognizedProblemBar } from "./RecognizedProblemBar";

describe("RecognizedProblemBar", () => {
  it("'인식됨' 배지와 인식된 문제 텍스트를 보여준다", () => {
    render(<RecognizedProblemBar recognizedText="2x + 3 = 7을 풀어라" />);

    expect(screen.getByText("인식됨")).toBeInTheDocument();
    expect(screen.getByText("2x + 3 = 7을 풀어라")).toBeInTheDocument();
  });

  it("onEdit이 없으면 '수정' 링크가 비활성화된다", () => {
    render(<RecognizedProblemBar recognizedText="문제" />);

    expect(screen.getByRole("button", { name: "수정" })).toBeDisabled();
  });

  it("onEdit이 있으면 클릭 시 호출된다", () => {
    const handleEdit = vi.fn();
    render(<RecognizedProblemBar recognizedText="문제" onEdit={handleEdit} />);

    const editButton = screen.getByRole("button", { name: "수정" });
    expect(editButton).not.toBeDisabled();
    fireEvent.click(editButton);
    expect(handleEdit).toHaveBeenCalledTimes(1);
  });
});
