import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LandingButton } from "./LandingButton";

describe("LandingButton", () => {
  it("눌리는 버튼(a·button)에는 입체 그림자를 준다", () => {
    render(
      <>
        <LandingButton as="a" href="#start" variant="primary-l">
          지금 바로 풀어보기
        </LandingButton>
        <LandingButton as="button" variant="secondary-m" onClick={() => {}}>
          Google로 시작하기
        </LandingButton>
      </>,
    );

    expect(screen.getByRole("link", { name: "지금 바로 풀어보기" }).className).toContain("shadow-landing-button-deep");
    expect(screen.getByRole("button", { name: "Google로 시작하기" }).className).toContain("shadow-landing-chip");
  });

  it.each(["primary-m", "primary-block", "secondary-block"] as const)(
    "일러스트(span, %s)는 눌릴 것처럼 보이지 않도록 그림자가 없다",
    (variant) => {
      render(
        <LandingButton as="span" variant={variant}>
          봐 주세요
        </LandingButton>,
      );

      expect(screen.getByText("봐 주세요").className).not.toMatch(/shadow-/);
    },
  );
});
