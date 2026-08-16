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

  it("tint-blue variant는 border-brand 보더를 포함한다(해시태그 pill과 공용 톤, Figma 재실측 반영)", () => {
    render(<Badge variant="tint-blue">이차함수</Badge>);

    const badge = screen.getByText("이차함수");
    expect(badge.className).toContain("border-brand");
  });

  it("outline variant는 배경 없이 border-brand/text-brand만 적용한다(제안 질문 pill)", () => {
    render(<Badge variant="outline">이 문제 왜 이렇게 풀어요?</Badge>);

    const badge = screen.getByText("이 문제 왜 이렇게 풀어요?");
    expect(badge.className).toContain("border-brand");
    expect(badge.className).toContain("text-brand");
    expect(badge.className).not.toContain("bg-fill-tint-brand");
  });

  it("size=tag는 해시태그 pill 크기(12px/590, px-[11px] py-[5px])를 적용한다", () => {
    render(
      <Badge variant="tint-blue" size="tag">
        #이차방정식
      </Badge>,
    );

    const badge = screen.getByText("#이차방정식");
    expect(badge.className).toContain("text-[12px]");
    expect(badge.className).toContain("px-[11px]");
    expect(badge.className).toContain("py-[5px]");
  });

  it("size=footnote는 제안 질문 pill 크기(13px/590, px-[14px] py-[7px])를 적용한다", () => {
    render(
      <Badge variant="outline" size="footnote">
        이 문제 왜 이렇게 풀어요?
      </Badge>,
    );

    const badge = screen.getByText("이 문제 왜 이렇게 풀어요?");
    expect(badge.className).toContain("text-[13px]");
    expect(badge.className).toContain("px-[14px]");
    expect(badge.className).toContain("py-[7px]");
  });

  it("size=footnote는 line-height 18px를 적용한다(Figma 174:614 실측, BASE_STYLE의 leading-4 오버라이드)", () => {
    render(
      <Badge variant="outline" size="footnote">
        이 문제 왜 이렇게 풀어요?
      </Badge>,
    );

    const badge = screen.getByText("이 문제 왜 이렇게 풀어요?");
    expect(badge.className).toContain("leading-[18px]");
  });
});
