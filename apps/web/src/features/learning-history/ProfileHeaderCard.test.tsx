import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProfileHeaderCard } from "./ProfileHeaderCard";

describe("ProfileHeaderCard", () => {
  it("이름/부제/아바타 첫 글자를 렌더링한다", () => {
    render(
      <ProfileHeaderCard
        name="지민"
        subtitle="고1 · jimin@example.com"
        onChangeGrade={() => undefined}
        onSignOut={() => undefined}
      />,
    );

    expect(screen.getByText("지민")).toBeInTheDocument();
    expect(screen.getByText("고1 · jimin@example.com")).toBeInTheDocument();
    expect(screen.getByText("지")).toBeInTheDocument();
  });

  it("부제가 없으면 렌더링하지 않는다", () => {
    render(
      <ProfileHeaderCard name="지민" onChangeGrade={() => undefined} onSignOut={() => undefined} />,
    );

    expect(screen.queryByText(/·/)).not.toBeInTheDocument();
  });

  it("학년 변경/로그아웃 버튼 클릭 시 각각의 콜백을 호출한다", () => {
    const handleChangeGrade = vi.fn();
    const handleSignOut = vi.fn();
    render(
      <ProfileHeaderCard
        name="지민"
        onChangeGrade={handleChangeGrade}
        onSignOut={handleSignOut}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "학년 변경" }));
    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));

    expect(handleChangeGrade).toHaveBeenCalledTimes(1);
    expect(handleSignOut).toHaveBeenCalledTimes(1);
  });

  it("Figma 실측 카드 스타일(bg-bg-elevated, rounded-[16px], px-[18px] py-[16px])을 적용한다", () => {
    const { container } = render(
      <ProfileHeaderCard name="지민" onChangeGrade={() => undefined} onSignOut={() => undefined} />,
    );

    const card = container.querySelector("section");
    expect(card?.className).toContain("bg-bg-elevated");
    expect(card?.className).toContain("rounded-[16px]");
    expect(card?.className).toContain("px-[18px]");
    expect(card?.className).toContain("py-[16px]");
  });
});
