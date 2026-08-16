import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SuggestionPill } from "./SuggestionPill";

describe("SuggestionPill", () => {
  it("label을 렌더링하고 클릭하면 onClick이 호출된다", () => {
    const handleClick = vi.fn();
    render(<SuggestionPill label="이 문제 왜 이렇게 풀어요?" onClick={handleClick} />);

    const pill = screen.getByRole("button", { name: "이 문제 왜 이렇게 풀어요?" });
    expect(pill.className).toContain("border-brand");
    expect(pill.className).not.toContain("bg-fill-tint-brand");

    fireEvent.click(pill);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
