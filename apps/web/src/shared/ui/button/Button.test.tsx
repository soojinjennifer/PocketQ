import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./Button";

describe("Button", () => {
  it("pill-primary variant는 bg-brand 스타일을 적용한다", () => {
    render(<Button variant="pill-primary">풀기</Button>);

    const button = screen.getByRole("button", { name: "풀기" });
    expect(button.className).toContain("bg-brand");
    expect(button.className).toContain("rounded-full");
  });

  it("pill-glass variant는 glass 스타일을 적용한다", () => {
    render(<Button variant="pill-glass">재촬영</Button>);

    const button = screen.getByRole("button", { name: "재촬영" });
    expect(button.className).toContain("bg-glass-fill");
    expect(button.className).toContain("border-glass-border");
  });

  it("pill-dark variant는 label-primary 배경 스타일을 적용한다", () => {
    render(<Button variant="pill-dark">사진 사용</Button>);

    const button = screen.getByRole("button", { name: "사진 사용" });
    expect(button.className).toContain("bg-label-primary");
  });

  it("pill 계열 버튼이 disabled면 Figma Style=Disable 스타일(bg-icon-default)을 적용하고 variant 색상을 덮어쓴다", () => {
    render(
      <Button variant="pill-primary" disabled>
        풀기
      </Button>,
    );

    const button = screen.getByRole("button", { name: "풀기" });
    expect(button).toBeDisabled();
    expect(button.className).toContain("bg-icon-default");
    expect(button.className).not.toContain("bg-brand");
  });

  it("기존 primary variant의 disabled 동작(opacity-50)은 회귀 없이 유지된다", () => {
    render(
      <Button variant="primary" disabled>
        확인
      </Button>,
    );

    const button = screen.getByRole("button", { name: "확인" });
    expect(button).toBeDisabled();
    expect(button.className).toContain("bg-brand");
    expect(button.className).toContain("disabled:opacity-50");
  });
});
