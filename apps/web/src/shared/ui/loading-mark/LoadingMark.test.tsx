import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LoadingMark } from "./LoadingMark";

describe("LoadingMark", () => {
  it("role=status/aria-live=polite로 렌더링된다(접근성)", () => {
    render(<LoadingMark />);

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
  });

  it("펄스 애니메이션 클래스가 이미지에 적용된다", () => {
    render(<LoadingMark />);

    const img = screen.getByRole("status").querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.className).toContain("animate-[loading-mark-pulse_1.4s_ease-in-out_infinite]");
  });

  it("이미지는 장식용이라 alt가 빈 문자열이다", () => {
    render(<LoadingMark />);

    const img = screen.getByRole("status").querySelector("img");
    expect(img).toHaveAttribute("alt", "");
  });

  it("label을 생략하면 스크린리더용 기본 문구가 sr-only로 표시된다", () => {
    render(<LoadingMark />);

    const text = screen.getByText("로딩 중");
    expect(text.className).toContain("sr-only");
  });

  it("label을 전달하면 시각적으로 표시된다", () => {
    render(<LoadingMark label="풀이를 생성하는 중" />);

    const text = screen.getByText("풀이를 생성하는 중");
    expect(text.className).not.toContain("sr-only");
    expect(text.className).toContain("text-label-secondary");
  });

  it("size prop으로 마크 크기를 지정할 수 있다", () => {
    render(<LoadingMark size={48} />);

    const img = screen.getByRole("status").querySelector("img");
    expect(img).toHaveStyle({ width: "48px", height: "48px" });
  });

  it("size 기본값은 36px이다", () => {
    render(<LoadingMark />);

    const img = screen.getByRole("status").querySelector("img");
    expect(img).toHaveStyle({ width: "36px", height: "36px" });
  });
});
