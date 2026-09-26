import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InputModeToggle } from "./InputModeToggle";

describe("InputModeToggle", () => {
  it("세 세그먼트 버튼을 '사진으로 문제 인식' → '사진 업로드' → '필기로 문제 인식' 순서로 렌더링한다", () => {
    render(<InputModeToggle mode="photo" onSelectMode={() => undefined} />);

    const labels = screen.getAllByRole("button").map((button) => button.textContent);
    expect(labels).toEqual(["사진으로 문제 인식", "사진 업로드", "필기로 문제 인식"]);
  });

  it("'사진 업로드'를 클릭하면 onSelectMode('upload')가 호출된다", () => {
    const handleSelectMode = vi.fn();
    render(<InputModeToggle mode="photo" onSelectMode={handleSelectMode} />);

    fireEvent.click(screen.getByRole("button", { name: "사진 업로드" }));

    expect(handleSelectMode).toHaveBeenCalledTimes(1);
    expect(handleSelectMode).toHaveBeenCalledWith("upload");
  });

  it.each([
    ["photo", "사진으로 문제 인식"],
    ["upload", "사진 업로드"],
    ["handwriting", "필기로 문제 인식"],
  ] as const)("mode='%s'이면 '%s'만 aria-pressed=true이고 선택 스타일을 갖는다", (mode, selectedLabel) => {
    render(<InputModeToggle mode={mode} onSelectMode={() => undefined} />);

    for (const button of screen.getAllByRole("button")) {
      const isSelected = button.textContent === selectedLabel;
      expect(button).toHaveAttribute("aria-pressed", String(isSelected));
      expect(button.className.includes("bg-bg-canvas")).toBe(isSelected);
      expect(button.className.includes("h-[26px]")).toBe(isSelected);
    }
  });

  it("세그먼트 사이에 aria-hidden 세로 구분선 2개가 폭 0 슬롯으로 렌더링된다", () => {
    render(<InputModeToggle mode="photo" onSelectMode={() => undefined} />);

    const dividers = screen.getAllByTestId("input-mode-divider");
    expect(dividers).toHaveLength(2);
    for (const divider of dividers) {
      expect(divider).toHaveAttribute("aria-hidden", "true");
      expect(divider.className).toContain("w-0");
      expect(divider.className).toContain("h-[17px]");
      expect(divider.firstElementChild?.className).toContain("bg-accent-green");
    }
    // 첫 세그먼트 앞/마지막 세그먼트 뒤에는 구분선이 없다.
    const children = Array.from(dividers[0]?.parentElement?.children ?? []);
    expect(children.map((child) => child.tagName)).toEqual([
      "BUTTON",
      "SPAN",
      "BUTTON",
      "SPAN",
      "BUTTON",
    ]);
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

    for (const button of screen.getAllByRole("button")) {
      expect(button.className).toContain("text-[11px]");
      expect(button.className).toContain("leading-[13px]");
      expect(button.className).toContain("font-[590]");
      expect(button.className).toContain("whitespace-nowrap");
      expect(button.className).not.toContain("text-[14px]");
      expect(button.className).not.toContain("font-medium");
    }
  });

  it("각 세그먼트 버튼이 세로 정렬을 위한 flex/items-center/justify-center 클래스를 갖는다(정렬 회귀 방지)", () => {
    render(<InputModeToggle mode="photo" onSelectMode={() => undefined} />);

    for (const button of screen.getAllByRole("button")) {
      expect(button.className).toContain("flex");
      expect(button.className).toContain("items-center");
      expect(button.className).toContain("justify-center");
    }
  });
});
