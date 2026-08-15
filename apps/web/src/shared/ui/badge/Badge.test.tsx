import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Badge } from "./Badge";

describe("Badge", () => {
  it("onClick이 없으면 span으로 렌더링된다(비상호작용 배지)", () => {
    render(<Badge variant="tint-green">인식됨</Badge>);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    const badge = screen.getByText("인식됨");
    expect(badge.tagName).toBe("SPAN");
    expect(badge.className).toContain("bg-fill-tint-green");
    expect(badge.className).toContain("text-accent-green");
  });

  it("onClick이 있으면 button으로 렌더링되고 클릭 시 호출된다", () => {
    const handleClick = vi.fn();
    render(
      <Badge variant="tint-blue" onClick={handleClick}>
        새 문제
      </Badge>,
    );

    const button = screen.getByRole("button", { name: "새 문제" });
    expect(button.className).toContain("bg-fill-tint-brand");
    expect(button.className).toContain("text-brand");

    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("tint-blue variant 색상 클래스를 적용한다", () => {
    render(<Badge variant="tint-blue">이차함수 › 최대·최소</Badge>);

    const badge = screen.getByText("이차함수 › 최대·최소");
    expect(badge.className).toContain("bg-fill-tint-brand");
    expect(badge.className).toContain("text-brand");
  });
});
