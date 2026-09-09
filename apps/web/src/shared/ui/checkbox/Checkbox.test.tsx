import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Checkbox } from "./Checkbox";

describe("Checkbox", () => {
  it("checked prop대로 체크 상태를 렌더링한다", () => {
    render(<Checkbox checked aria-label="선택" onChange={() => undefined} />);

    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  it("클릭하면 반대 상태로 onChange를 호출한다", () => {
    const handleChange = vi.fn();
    render(<Checkbox checked={false} aria-label="선택" onChange={handleChange} />);

    fireEvent.click(screen.getByRole("checkbox"));

    expect(handleChange).toHaveBeenCalledWith(true);
  });

  it("24x24 크기 클래스를 적용한다(Figma 실측)", () => {
    render(<Checkbox checked={false} aria-label="선택" onChange={() => undefined} />);

    const input = screen.getByRole("checkbox");
    expect(input.className).toContain("h-6");
    expect(input.className).toContain("w-6");
  });

  it("onClick이 전달되면 클릭 시 함께 호출된다(행 전체 클릭과의 충돌 방지용)", () => {
    const handleClick = vi.fn();
    render(
      <Checkbox
        checked={false}
        aria-label="선택"
        onChange={() => undefined}
        onClick={handleClick}
      />,
    );

    fireEvent.click(screen.getByRole("checkbox"));

    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
