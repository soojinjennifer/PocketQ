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

  it("select variant는 fill-tint-brand 배경과 brand 텍스트, 좁은 pill 여백을 적용한다", () => {
    render(<Button variant="select">학년 변경</Button>);

    const button = screen.getByRole("button", { name: "학년 변경" });
    expect(button.className).toContain("bg-fill-tint-brand");
    expect(button.className).toContain("text-brand");
    expect(button.className).toContain("rounded-full");
    expect(button.className).toContain("px-[14px]");
    expect(button.className).toContain("py-[7px]");
  });

  it("logout variant는 fill-quaternary 배경과 accent-purple 텍스트를 적용한다", () => {
    render(<Button variant="logout">로그아웃</Button>);

    const button = screen.getByRole("button", { name: "로그아웃" });
    expect(button.className).toContain("bg-fill-quaternary");
    expect(button.className).toContain("text-accent-purple");
    expect(button.className).toContain("px-[14px]");
  });

  it("select/logout은 기존 pill 베이스(px-[26px])를 재사용하지 않는다", () => {
    render(<Button variant="logout">로그아웃</Button>);

    expect(screen.getByRole("button", { name: "로그아웃" }).className).not.toContain("px-[26px]");
  });
});
