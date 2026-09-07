import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RecognizedChip } from "./RecognizedChip";

describe("RecognizedChip", () => {
  it("인식된 원문과 '인식됨' 배지를 보여준다", () => {
    render(<RecognizedChip recognizedText="1+1=?" />);

    expect(screen.getByText("인식됨")).toBeInTheDocument();
    expect(screen.getByText("1+1=?")).toBeInTheDocument();
  });

  it("모서리가 각진 사각형이다(Figma `267:607` 실측, rounded-full 아님)", () => {
    render(<RecognizedChip recognizedText="1+1=?" />);

    const chip = screen.getByText("1+1=?").closest("div");
    expect(chip).not.toHaveClass("rounded-full");
  });
});
