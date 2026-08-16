import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FilterPill } from "./FilterPill";

describe("FilterPill", () => {
  it("선택 상태면 brand 채움 스타일과 aria-pressed=true를 적용한다", () => {
    render(<FilterPill label="전체" selected onClick={() => undefined} />);

    const pill = screen.getByRole("button", { name: "전체" });
    expect(pill).toHaveAttribute("aria-pressed", "true");
    expect(pill.className).toContain("bg-brand");
    expect(pill.className).toContain("text-label-on-dark");
  });

  it("비선택 상태면 bg-bg-elevated/text-label-secondary를 적용하고 보더가 없다", () => {
    render(<FilterPill label="이차함수" selected={false} onClick={() => undefined} />);

    const pill = screen.getByRole("button", { name: "이차함수" });
    expect(pill).toHaveAttribute("aria-pressed", "false");
    expect(pill.className).toContain("bg-bg-elevated");
    expect(pill.className).toContain("text-label-secondary");
    expect(pill.className).not.toContain("border");
  });

  it("클릭하면 onClick을 호출한다", () => {
    const handleClick = vi.fn();
    render(<FilterPill label="다항식" selected={false} onClick={handleClick} />);

    fireEvent.click(screen.getByRole("button", { name: "다항식" }));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
