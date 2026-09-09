import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HistoryRow } from "./HistoryRow";

const CREATED_AT = new Date(2026, 6, 12, 9, 30).toISOString();

function renderRow(overrides: Partial<Parameters<typeof HistoryRow>[0]> = {}) {
  return render(
    <HistoryRow
      problemId="problem-1"
      recognizedText="문제"
      conceptTags={[]}
      createdAt={CREATED_AT}
      onClick={() => undefined}
      isSelected={false}
      onToggleSelect={() => undefined}
      onRetry={() => undefined}
      {...overrides}
    />,
  );
}

describe("HistoryRow", () => {
  it("문제 텍스트와 첫 개념 태그, 날짜를 렌더링한다", () => {
    renderRow({
      recognizedText: "x^2 - 5x + 6 = 0을 풀어라",
      conceptTags: ["이차방정식", "인수분해"],
    });

    // Thumb(aria-hidden placeholder)과 본문 두 곳에 같은 텍스트가 들어간다.
    expect(screen.getAllByText("x^2 - 5x + 6 = 0을 풀어라").length).toBe(2);
    expect(screen.getByText("이차방정식")).toBeInTheDocument();
    // 두 번째 태그는 78px 고정 높이 때문에 노출하지 않는다.
    expect(screen.queryByText("인수분해")).not.toBeInTheDocument();
    expect(screen.getByText("7월 12일")).toBeInTheDocument();
  });

  it("행 전체가 클릭 가능한 버튼이고 클릭 시 onClick을 호출한다", () => {
    const handleClick = vi.fn();
    renderRow({ onClick: handleClick });

    fireEvent.click(screen.getByRole("button", { name: /^문제/ }));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("개념 태그가 없으면 chip을 렌더링하지 않는다", () => {
    const { container } = renderRow();

    expect(container.querySelector(".bg-fill-tint-brand")).toBeNull();
  });

  it("Figma 실측 높이(78px)와 카드 배경/보더 스타일을 적용한다", () => {
    const { container } = renderRow();

    const row = container.firstElementChild;
    expect(row?.className).toContain("h-[78px]");
    expect(row?.className).toContain("bg-bg-elevated");
    expect(row?.className).toContain("border-separator");
    expect(row?.className).toContain("gap-[14px]");
  });

  it("사진/필기 구분 뱃지는 렌더링하지 않는다(Figma에 없음)", () => {
    renderRow();

    expect(screen.queryByText("사진")).not.toBeInTheDocument();
    expect(screen.queryByText("필기")).not.toBeInTheDocument();
  });

  it("마이페이지 개선 1번 항목: Thumb 폭을 120px로 확대하고 본문은 flex-1 min-w-0을 유지한다", () => {
    renderRow();

    // 체크박스의 체크 아이콘 svg도 aria-hidden이라, 상세보기 버튼 내부로 범위를 좁혀 조회한다.
    const row = screen.getByRole("button", { name: /^문제/ });
    const thumb = row.querySelector('[aria-hidden="true"]');
    expect(thumb?.className).toContain("w-[120px]");
    expect(thumb?.className).toContain("h-[52px]");

    const body = row.children[1];
    expect(body?.className).toContain("flex-1");
    expect(body?.className).toContain("min-w-0");
  });

  it("마이페이지 개선 3번: 체크박스를 렌더링하고 isSelected를 그대로 반영한다", () => {
    renderRow({ isSelected: true });

    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  it("체크박스를 클릭하면 onToggleSelect(problemId)만 호출되고 행 클릭(onClick)은 호출되지 않는다", () => {
    const handleClick = vi.fn();
    const handleToggle = vi.fn();
    renderRow({ problemId: "problem-42", onClick: handleClick, onToggleSelect: handleToggle });

    fireEvent.click(screen.getByRole("checkbox"));

    expect(handleToggle).toHaveBeenCalledWith("problem-42");
    expect(handleClick).not.toHaveBeenCalled();
  });
});

describe("HistoryRow — 마이페이지 개선 4번(다시풀기 버튼)", () => {
  it("112x30 크기의 label/primary 배경 + 흰 텍스트 버튼을 렌더링한다", () => {
    renderRow();

    // design-agent 사후검수로 Figma MCP 재조회 확정(`Button/Pill` node `279:990`): 실제 텍스트
    // 레이어는 "다시 풀기"(공백 포함)이고 폰트는 15px(기존 13px는 실측 없는 임시값). 접근성
    // 이름은 상세보기 오버레이의 동일 문구 "다시 풀기" 버튼과 구분하기 위해 문제 텍스트를 덧붙인다
    // (`aria-label={`다시 풀기 ${recognizedText}`}`).
    const retryButton = screen.getByRole("button", { name: "다시 풀기 문제" });
    expect(retryButton.className).toContain("w-[112px]");
    expect(retryButton.className).toContain("h-[30px]");
    expect(retryButton.className).toContain("bg-label-primary");
    expect(retryButton.className).toContain("text-bg-elevated");
    expect(retryButton.className).toContain("text-[15px]");
  });

  it("다시풀기 버튼을 클릭하면 onRetry(problemId)만 호출되고 상세보기(onClick)는 호출되지 않는다", () => {
    const handleClick = vi.fn();
    const handleRetry = vi.fn();
    renderRow({ problemId: "problem-42", onClick: handleClick, onRetry: handleRetry });

    fireEvent.click(screen.getByRole("button", { name: "다시 풀기 문제" }));

    expect(handleRetry).toHaveBeenCalledWith("problem-42");
    expect(handleClick).not.toHaveBeenCalled();
  });

  it("chevron은 다시풀기 버튼 뒤(오른쪽)에 위치한다", () => {
    const { container } = renderRow();

    const row = container.firstElementChild;
    const retryButton = screen.getByRole("button", { name: "다시 풀기 문제" });
    const chevron = screen.getByText("›");

    const children = row ? Array.from(row.children) : [];
    expect(children.indexOf(retryButton)).toBeLessThan(children.indexOf(chevron));
  });
});
