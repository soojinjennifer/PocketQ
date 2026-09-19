import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InputModeToggle } from "./InputModeToggle";

describe("InputModeToggle", () => {
  it("두 세그먼트 버튼을 모두 렌더링한다", () => {
    render(<InputModeToggle mode="photo" onSelectMode={() => undefined} />);

    expect(screen.getByRole("button", { name: "사진으로 문제 인식" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "필기로 문제 인식" })).toBeInTheDocument();
  });

  it("'필기로 문제 인식'을 클릭하면 onSelectMode('handwriting')가 호출된다", () => {
    const handleSelectMode = vi.fn();
    render(<InputModeToggle mode="photo" onSelectMode={handleSelectMode} />);

    fireEvent.click(screen.getByRole("button", { name: "필기로 문제 인식" }));

    expect(handleSelectMode).toHaveBeenCalledTimes(1);
    expect(handleSelectMode).toHaveBeenCalledWith("handwriting");
  });

  it("'사진으로 문제 인식'을 클릭하면 onSelectMode('photo')가 호출된다", () => {
    const handleSelectMode = vi.fn();
    render(<InputModeToggle mode="handwriting" onSelectMode={handleSelectMode} />);

    fireEvent.click(screen.getByRole("button", { name: "사진으로 문제 인식" }));

    expect(handleSelectMode).toHaveBeenCalledTimes(1);
    expect(handleSelectMode).toHaveBeenCalledWith("photo");
  });

  it("mode='photo'면 '사진으로 문제 인식'이 선택 스타일(bg-bg-canvas)과 aria-pressed=true를 갖는다", () => {
    render(<InputModeToggle mode="photo" onSelectMode={() => undefined} />);

    const photoButton = screen.getByRole("button", { name: "사진으로 문제 인식" });
    const handwritingButton = screen.getByRole("button", { name: "필기로 문제 인식" });

    expect(photoButton).toHaveAttribute("aria-pressed", "true");
    expect(photoButton.className).toContain("bg-bg-canvas");
    expect(photoButton.className).toContain("h-[26px]");
    expect(handwritingButton).toHaveAttribute("aria-pressed", "false");
    expect(handwritingButton.className).not.toContain("bg-bg-canvas");
    expect(handwritingButton.className).not.toContain("h-[26px]");
  });

  it("mode='handwriting'이면 '필기로 문제 인식'이 선택 스타일과 aria-pressed=true를 갖는다", () => {
    render(<InputModeToggle mode="handwriting" onSelectMode={() => undefined} />);

    const photoButton = screen.getByRole("button", { name: "사진으로 문제 인식" });
    const handwritingButton = screen.getByRole("button", { name: "필기로 문제 인식" });

    expect(handwritingButton).toHaveAttribute("aria-pressed", "true");
    expect(handwritingButton.className).toContain("bg-bg-canvas");
    expect(handwritingButton.className).toContain("h-[26px]");
    expect(photoButton).toHaveAttribute("aria-pressed", "false");
    expect(photoButton.className).not.toContain("bg-bg-canvas");
    expect(photoButton.className).not.toContain("h-[26px]");
  });

  it("각 세그먼트 버튼이 Figma 재실측 라벨 스타일(11px/13px/font-590)을 갖는다", () => {
    render(<InputModeToggle mode="photo" onSelectMode={() => undefined} />);

    const photoButton = screen.getByRole("button", { name: "사진으로 문제 인식" });
    const handwritingButton = screen.getByRole("button", { name: "필기로 문제 인식" });

    for (const button of [photoButton, handwritingButton]) {
      expect(button.className).toContain("text-[11px]");
      expect(button.className).toContain("leading-[13px]");
      expect(button.className).toContain("font-[590]");
      expect(button.className).not.toContain("text-[14px]");
      expect(button.className).not.toContain("font-medium");
    }
  });

  it("각 세그먼트 버튼이 세로 정렬을 위한 flex/items-center/justify-center 클래스를 갖는다(정렬 회귀 방지)", () => {
    render(<InputModeToggle mode="photo" onSelectMode={() => undefined} />);

    const photoButton = screen.getByRole("button", { name: "사진으로 문제 인식" });
    const handwritingButton = screen.getByRole("button", { name: "필기로 문제 인식" });

    for (const button of [photoButton, handwritingButton]) {
      expect(button.className).toContain("flex");
      expect(button.className).toContain("items-center");
      expect(button.className).toContain("justify-center");
    }
  });
});
