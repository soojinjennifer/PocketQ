/**
 * Stage 5 S5-V7·V8·V10 한 줄 배치·포커스 링 클래스(재작업 1: QA MEDIUM-1, design P3).
 * 실제 줄바꿈·넘침은 jsdom이 계산하지 못해 헤드리스로 확인한다(장부 §8.19) — 여기서는 규칙 클래스가 붙어 있는지만 본다.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TEXT_LINK_FOCUS_RING, TEXT_LINK_STYLE } from "../../shared/ui/text-link/textLinkStyle";
import { RecognizedProblemBar } from "./RecognizedProblemBar";
import { WorkLineList } from "./WorkLineList";

const tokens = (el: Element | null) => (el?.getAttribute("class") ?? "").split(/\s+/);

describe("WorkLineList 줄(MEDIUM-1)", () => {
  it("줄 본문은 min-w-0 flex-1 wrap-anywhere, 판정 배지는 shrink-0 whitespace-nowrap", () => {
    const long = "x".repeat(300);
    render(
      <WorkLineList
        lines={[
          { lineNo: 1, latex: long, isValid: true },
          { lineNo: 2, latex: long, isValid: false },
        ]}
      />,
    );
    for (const item of screen.getAllByRole("listitem")) {
      expect(tokens(item.querySelector("p"))).toEqual(expect.arrayContaining(["min-w-0", "flex-1", "wrap-anywhere"]));
    }
    for (const label of ["확인", "막힌 지점"]) {
      expect(tokens(screen.getByText(label))).toEqual(expect.arrayContaining(["shrink-0", "whitespace-nowrap"]));
    }
  });
});

describe("텍스트 링크 포커스 링(S5-V10, design P3)", () => {
  it("공용 상수 하나를 밑줄 링크와 인식 바 버튼이 함께 쓴다(모서리 6px)", () => {
    expect(TEXT_LINK_FOCUS_RING.split(" ")).toEqual(
      expect.arrayContaining(["rounded-[6px]", "outline-none", "focus-visible:ring-2", "focus-visible:ring-brand", "focus-visible:ring-offset-2"]),
    );
    expect(TEXT_LINK_STYLE).toContain(TEXT_LINK_FOCUS_RING);
    render(<RecognizedProblemBar recognizedText="문제" onEdit={() => undefined} editLabel="다시 풀기" />);
    const button = screen.getByRole("button", { name: "다시 풀기" });
    expect(tokens(button)).toEqual(expect.arrayContaining(TEXT_LINK_FOCUS_RING.split(" ")));
  });

  it("인식 바 버튼의 첫 줄 정렬 2px는 링 바깥 여백(mt-0.5) — 링 안쪽 여백(pt) 없음", () => {
    render(<RecognizedProblemBar recognizedText="문제" onEdit={() => undefined} />);
    const t = tokens(screen.getByRole("button", { name: "수정" }));
    expect(t).toContain("mt-0.5");
    expect(t.some((token) => /^p[ty]?-/.test(token))).toBe(false);
  });
});
