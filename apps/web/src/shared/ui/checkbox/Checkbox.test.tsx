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

  it("id를 받으면 <label htmlFor>로 연결되고, 보이는 라벨이 접근 가능한 이름이 된다", () => {
    render(
      <label htmlFor="consent-age">
        <Checkbox id="consent-age" checked={false} onChange={() => undefined} />
        만 14세 이상입니다
      </label>,
    );

    const input = screen.getByRole("checkbox", { name: "만 14세 이상입니다" });
    expect(input).toHaveAttribute("id", "consent-age");
    expect(input).not.toHaveAttribute("aria-label");
  });

  it("label 안에서 문구를 눌러도, 체크박스를 직접 눌러도 onChange는 한 번만 호출된다", () => {
    const handleChange = vi.fn();
    render(
      <label htmlFor="consent-terms">
        <Checkbox id="consent-terms" checked={false} onChange={handleChange} />
        <span>약관 동의</span>
      </label>,
    );

    fireEvent.click(screen.getByText("약관 동의"));
    expect(handleChange).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("checkbox"));
    expect(handleChange).toHaveBeenCalledTimes(2);
  });

  it("disabled면 input이 비활성이고 래퍼가 opacity-50으로 흐려진다", () => {
    const { container } = render(
      <Checkbox checked={false} aria-label="선택" onChange={() => undefined} disabled />,
    );

    expect(screen.getByRole("checkbox")).toBeDisabled();
    expect(container.firstElementChild?.className).toContain("opacity-50");
  });

  it("disabled를 주지 않으면 기존(MyPage HistoryRow)과 같이 활성 상태이고 래퍼에 opacity가 없다", () => {
    const { container } = render(<Checkbox checked={false} aria-label="선택" onChange={() => undefined} />);

    expect(screen.getByRole("checkbox")).toBeEnabled();
    expect(screen.getByRole("checkbox")).not.toHaveAttribute("disabled");
    expect(container.firstElementChild?.className).toBe(
      "relative inline-flex h-6 w-6 shrink-0 items-center justify-center",
    );
  });
});
