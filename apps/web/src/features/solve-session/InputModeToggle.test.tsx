import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { dispatchTrustedClick } from "../../test/dispatchTrustedClick";
import { InputModeToggle, type InputMode } from "./InputModeToggle";

const PHOTO = "사진으로 문제 인식";
const HANDWRITING = "필기로 문제 인식";

function renderToggle({
  mode = "photo",
  onSelectHandwriting = vi.fn(),
  onSelectPhotoSource = vi.fn(),
  disabled,
}: {
  mode?: InputMode;
  onSelectHandwriting?: () => void;
  onSelectPhotoSource?: (source: "library" | "camera") => void;
  disabled?: boolean;
} = {}) {
  render(
    <InputModeToggle
      mode={mode}
      onSelectHandwriting={onSelectHandwriting}
      onSelectPhotoSource={onSelectPhotoSource}
      disabled={disabled}
    />,
  );
  return { onSelectHandwriting, onSelectPhotoSource };
}

/** 세그먼트 버튼만(메뉴 항목 제외) — `aria-pressed`가 있는 버튼. */
function getSegments() {
  return screen.getAllByRole("button").filter((button) => button.hasAttribute("aria-pressed"));
}

describe("InputModeToggle", () => {
  it("두 세그먼트 버튼을 '필기로 문제 인식'(왼쪽) → '사진으로 문제 인식'(오른쪽) 순서로 렌더링한다(Figma 342:833 실측, 기존 3분할 탭 없음)", () => {
    renderToggle();

    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual([
      HANDWRITING,
      PHOTO,
    ]);
    expect(screen.queryByRole("button", { name: "카메라로 문제인식" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "사진 업로드" })).not.toBeInTheDocument();
  });

  it("세그먼트 사이에 aria-hidden 세로 구분선 1개가 폭 0 슬롯으로 렌더링된다", () => {
    renderToggle();

    const dividers = screen.getAllByTestId("input-mode-divider");
    expect(dividers).toHaveLength(1);
    const [divider] = dividers;
    expect(divider).toHaveAttribute("aria-hidden", "true");
    expect(divider?.className).toContain("w-0");
    expect(divider?.className).toContain("h-[17px]");
    expect(divider?.firstElementChild?.className).toContain("bg-accent-green");
    const children = Array.from(divider?.parentElement?.children ?? []);
    expect(children.map((child) => child.tagName)).toEqual(["BUTTON", "SPAN", "BUTTON"]);
  });

  it.each([
    ["photo", PHOTO],
    ["handwriting", HANDWRITING],
  ] as const)("mode='%s'이면 '%s'만 aria-pressed=true이고 선택 스타일을 갖는다", (mode, selectedLabel) => {
    renderToggle({ mode });

    for (const button of getSegments()) {
      const isSelected = button.textContent === selectedLabel;
      expect(button).toHaveAttribute("aria-pressed", String(isSelected));
      expect(button.className.includes("bg-bg-canvas")).toBe(isSelected);
      expect(button.className.includes("h-[26px]")).toBe(isSelected);
    }
  });

  it("각 세그먼트 버튼이 기존 스타일(패딩 18/8, 11px/13px/font-590, nowrap, flex 세로 정렬)을 유지한다", () => {
    renderToggle();

    for (const button of getSegments()) {
      for (const token of [
        "px-[18px]",
        "py-[8px]",
        "text-[11px]",
        "leading-[13px]",
        "font-[590]",
        "whitespace-nowrap",
        "flex",
        "items-center",
        "justify-center",
      ]) {
        expect(button.className).toContain(token);
      }
      expect(button.className).not.toContain("text-[14px]");
      expect(button.className).not.toContain("font-medium");
    }
  });

  it("'필기로 문제 인식'을 누르면 onSelectHandwriting만 호출되고 메뉴는 열리지 않는다", () => {
    const { onSelectHandwriting, onSelectPhotoSource } = renderToggle();

    fireEvent.click(screen.getByRole("button", { name: HANDWRITING }));

    expect(onSelectHandwriting).toHaveBeenCalledTimes(1);
    expect(onSelectPhotoSource).not.toHaveBeenCalled();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("사진 버튼은 메뉴 트리거다 — 누르면 콜백 없이 [사진 보관함] [사진 찍기] 메뉴만 열린다", () => {
    const { onSelectHandwriting, onSelectPhotoSource } = renderToggle({ mode: "handwriting" });
    const photoButton = screen.getByRole("button", { name: PHOTO });
    expect(photoButton).toHaveAttribute("aria-haspopup", "menu");
    expect(photoButton).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(photoButton);

    const menu = screen.getByRole("menu");
    expect(photoButton).toHaveAttribute("aria-expanded", "true");
    expect(photoButton).toHaveAttribute("aria-controls", menu.id);
    expect(menu).toHaveAttribute("aria-labelledby", photoButton.id);
    expect(menu).toHaveAccessibleName(PHOTO);
    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "사진 보관함",
      "사진 찍기",
    ]);
    expect(onSelectPhotoSource).not.toHaveBeenCalled();
    expect(onSelectHandwriting).not.toHaveBeenCalled();
    // 메뉴만 열고 선택 상태(모드)는 바꾸지 않는다 — 모드는 상위가 결정한다.
    expect(screen.getByRole("button", { name: HANDWRITING })).toHaveAttribute("aria-pressed", "true");
  });

  it("메뉴는 오른쪽 사진 세그먼트 바로 아래 오른쪽 정렬이고 캔버스 잉크 가림 표식을 갖는다", () => {
    renderToggle();
    fireEvent.click(screen.getByRole("button", { name: PHOTO }));

    const root = screen.getByRole("menu").parentElement;
    expect(root).toHaveClass("absolute", "top-full", "right-0");
    expect(root).not.toHaveClass("left-0");
    expect(root).toHaveAttribute("data-canvas-occluder", "");
  });

  it.each([
    ["사진 보관함", "library"],
    ["사진 찍기", "camera"],
  ] as const)("메뉴에서 '%s'을(를) 고르면 onSelectPhotoSource('%s')가 1회 호출되고 메뉴가 닫힌다", (label, source) => {
    const { onSelectPhotoSource } = renderToggle();
    const photoButton = screen.getByRole("button", { name: PHOTO });
    fireEvent.click(photoButton);

    fireEvent.click(screen.getByRole("menuitem", { name: label }));

    expect(onSelectPhotoSource).toHaveBeenCalledTimes(1);
    expect(onSelectPhotoSource).toHaveBeenCalledWith(source);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(photoButton).toHaveAttribute("aria-expanded", "false");
    expect(photoButton).toHaveFocus();
  });

  it("사진 버튼을 다시 누르거나 Escape/바깥 탭을 하면 콜백 없이 메뉴만 닫힌다", () => {
    const { onSelectPhotoSource } = renderToggle();
    const photoButton = screen.getByRole("button", { name: PHOTO });

    fireEvent.click(photoButton);
    fireEvent.click(photoButton);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    fireEvent.click(photoButton);
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    fireEvent.click(photoButton);
    fireEvent.click(screen.getByTestId("action-menu-scrim"));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    expect(onSelectPhotoSource).not.toHaveBeenCalled();
  });

  it("메뉴가 열린 채 '필기로 문제 인식'을 탭하면 메뉴가 닫히고 onSelectHandwriting이 바로 호출된다", () => {
    const { onSelectHandwriting, onSelectPhotoSource } = renderToggle();
    fireEvent.click(screen.getByRole("button", { name: PHOTO }));

    dispatchTrustedClick(screen.getByRole("button", { name: HANDWRITING }));

    expect(onSelectHandwriting).toHaveBeenCalledTimes(1);
    expect(onSelectPhotoSource).not.toHaveBeenCalled();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: PHOTO })).toHaveAttribute("aria-expanded", "false");
  });

  it("메뉴가 열린 채 disabled가 되면 메뉴가 닫히고 포커스를 트리거로 옮기지 않는다", () => {
    const props = {
      mode: "photo" as const,
      onSelectHandwriting: vi.fn(),
      onSelectPhotoSource: vi.fn(),
    };
    const { rerender } = render(<InputModeToggle {...props} />);
    fireEvent.click(screen.getByRole("button", { name: PHOTO }));
    const firstItem = screen.getByRole("menuitem", { name: "사진 보관함" });
    expect(firstItem).toHaveFocus();

    rerender(<InputModeToggle {...props} disabled />);

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: PHOTO })).not.toHaveFocus();
  });

  it("disabled면 두 버튼이 비활성화되어 메뉴가 열리지 않고 콜백도 호출되지 않는다", () => {
    const { onSelectHandwriting, onSelectPhotoSource } = renderToggle({ disabled: true });

    for (const button of getSegments()) {
      expect(button).toBeDisabled();
    }
    fireEvent.click(screen.getByRole("button", { name: PHOTO }));
    fireEvent.click(screen.getByRole("button", { name: HANDWRITING }));

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(onSelectHandwriting).not.toHaveBeenCalled();
    expect(onSelectPhotoSource).not.toHaveBeenCalled();
  });
});
