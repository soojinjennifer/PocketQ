import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HistoryRow } from "./HistoryRow";

const CREATED_AT = new Date(2026, 6, 12, 9, 30).toISOString();

describe("HistoryRow", () => {
  it("문제 텍스트와 첫 개념 태그, 날짜를 렌더링한다", () => {
    render(
      <HistoryRow
        recognizedText="x^2 - 5x + 6 = 0을 풀어라"
        conceptTags={["이차방정식", "인수분해"]}
        createdAt={CREATED_AT}
        onClick={() => undefined}
      />,
    );

    // Thumb(aria-hidden placeholder)과 본문 두 곳에 같은 텍스트가 들어간다.
    expect(screen.getAllByText("x^2 - 5x + 6 = 0을 풀어라").length).toBe(2);
    expect(screen.getByText("이차방정식")).toBeInTheDocument();
    // 두 번째 태그는 78px 고정 높이 때문에 노출하지 않는다.
    expect(screen.queryByText("인수분해")).not.toBeInTheDocument();
    expect(screen.getByText("7월 12일")).toBeInTheDocument();
  });

  it("행 전체가 클릭 가능한 버튼이고 클릭 시 onClick을 호출한다", () => {
    const handleClick = vi.fn();
    render(
      <HistoryRow
        recognizedText="문제"
        conceptTags={[]}
        createdAt={CREATED_AT}
        onClick={handleClick}
      />,
    );

    fireEvent.click(screen.getByRole("button"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("개념 태그가 없으면 chip을 렌더링하지 않는다", () => {
    const { container } = render(
      <HistoryRow
        recognizedText="문제"
        conceptTags={[]}
        createdAt={CREATED_AT}
        onClick={() => undefined}
      />,
    );

    expect(container.querySelector(".bg-fill-tint-brand")).toBeNull();
  });

  it("Figma 실측 높이(78px)와 카드 배경/보더 스타일을 적용한다", () => {
    render(
      <HistoryRow
        recognizedText="문제"
        conceptTags={[]}
        createdAt={CREATED_AT}
        onClick={() => undefined}
      />,
    );

    const row = screen.getByRole("button");
    expect(row.className).toContain("h-[78px]");
    expect(row.className).toContain("bg-bg-elevated");
    expect(row.className).toContain("border-separator");
    expect(row.className).toContain("gap-[14px]");
  });

  it("사진/필기 구분 뱃지는 렌더링하지 않는다(Figma에 없음)", () => {
    render(
      <HistoryRow
        recognizedText="문제"
        conceptTags={[]}
        createdAt={CREATED_AT}
        onClick={() => undefined}
      />,
    );

    expect(screen.queryByText("사진")).not.toBeInTheDocument();
    expect(screen.queryByText("필기")).not.toBeInTheDocument();
  });
});
