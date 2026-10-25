/**
 * Stage 4 WU8 — 도형 슬롯(`docs/FIGURE_DESIGN.md` §17.2·§17.4·§17.6·§17.7). S4-7·S4-9·S4-17(jsdom 범위).
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FigureSpec } from "shared-types";
import { figureSpecSchema } from "validation";
import { F01_TRIANGLE_ANGLE, F09_STEPWISE_AUXILIARY } from "validation/fixtures";

vi.mock("./jsxgraphAdapter", () => ({ loadJsxGraph: () => new Promise(() => {}) }));

const { SolutionFigures, FIGURES_WAITING_DELAY_MS } = await import("./SolutionFigures");
const lazyModule = await import("./SolutionFigures");

const F09: FigureSpec = figureSpecSchema.parse(F09_STEPWISE_AUXILIARY.raw);
const F01: FigureSpec = figureSpecSchema.parse(F01_TRIANGLE_ANGLE.raw);
const THREE = "**1단계** a\n**2단계** b\n**3단계** c";

function Harness({ figures = [F09], solutionMd = THREE, phase = "received" as const }: { figures?: FigureSpec[]; solutionMd?: string | null; phase?: "idle" | "waiting" | "received" | "empty" }) {
  const [step, setStep] = useState<number | null>(null);
  return (
    <>
      <span data-testid="k">{step === null ? "final" : String(step)}</span>
      <SolutionFigures phase={phase} figures={figures} solutionMd={solutionMd} step={step} onStepChange={setStep} />
    </>
  );
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("SolutionFigures 슬롯", () => {
  it("default export는 lazy 진입점(같은 컴포넌트)", () => {
    expect(lazyModule.default).toBe(SolutionFigures);
  });

  it("S4-9: 슬롯 루트 aria-live=off, 카드는 section + aria-labelledby 캡션 '그림'(text-brand Caption Semibold)", () => {
    const { container } = render(<Harness />);
    const root = container.querySelector("[aria-live='off']");
    expect(root).not.toBeNull();
    expect(root?.hasAttribute("hidden")).toBe(false);
    const section = root?.querySelector("section");
    const caption = screen.getByText("그림");
    expect(section?.getAttribute("aria-labelledby")).toBe(caption.id);
    expect(caption.className).toBe("text-brand text-[12px] leading-[16px] font-[590]");
    for (const token of ["flex", "flex-col", "gap-3"]) expect(section?.classList.contains(token)).toBe(true);
  });

  it("그림이 여러 개면 '그림 1'~'그림 3', 카드 사이 gap-3", () => {
    const { container } = render(<Harness figures={[F09, F01, F09]} />);
    expect(screen.getByText("그림 1")).toBeInTheDocument();
    expect(screen.getByText("그림 3")).toBeInTheDocument();
    expect(container.querySelector("[aria-live='off']")?.className).toContain("gap-3");
  });

  it("S4-7: waiting은 500ms 전엔 아무것도 없고(hidden), 이후 Spinner 한 줄(announce=false), aria-busy", () => {
    vi.useFakeTimers();
    const { container, rerender } = render(<Harness phase="waiting" figures={[]} />);
    const root = container.querySelector("[aria-live='off']");
    expect(root?.getAttribute("aria-busy")).toBe("true");
    expect(root?.hasAttribute("hidden")).toBe(true);
    expect(screen.queryByText("그림을 준비하는 중")).toBeNull();
    act(() => {
      vi.advanceTimersByTime(FIGURES_WAITING_DELAY_MS - 1);
    });
    expect(screen.queryByText("그림을 준비하는 중")).toBeNull();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByText("그림을 준비하는 중")).toBeInTheDocument();
    expect(root?.hasAttribute("hidden")).toBe(false);
    expect(root?.querySelector("[role='status'], [aria-live='polite']")).toBeNull();
    // received로 바뀌면 대기 줄을 그림 카드가 대체하고 aria-busy가 사라진다.
    rerender(<Harness phase="received" figures={[F09]} />);
    // 슬롯 대기 줄(루트의 직접 자식)은 없어지고, 남은 문구는 카드 안 보드의 청크 대기 표시(§9)뿐이다.
    expect([...(root?.children ?? [])].every((child) => child.tagName === "SECTION")).toBe(true);
    expect(screen.getAllByText("그림을 준비하는 중").every((node) => node.closest("section") !== null)).toBe(true);
    expect(root?.hasAttribute("aria-busy")).toBe(false);
  });

  it("S4-7: 서버 off(waiting → 500ms 안에 empty)는 깜빡임 없이 끝까지 아무것도 보이지 않는다", () => {
    vi.useFakeTimers();
    const { container, rerender } = render(<Harness phase="waiting" figures={[]} />);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    rerender(<Harness phase="empty" figures={[]} />);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.queryByText("그림을 준비하는 중")).toBeNull();
    expect(container.querySelector("[aria-live='off']")?.hasAttribute("hidden")).toBe(true);
  });

  it("empty·idle은 아무것도 표시하지 않는다(문구 없음)", () => {
    for (const phase of ["empty", "idle"] as const) {
      const { container, unmount } = render(<Harness phase={phase} figures={[]} />);
      expect(container.querySelector("[aria-live='off']")?.hasAttribute("hidden")).toBe(true);
      expect(container.querySelector("section")).toBeNull();
      unmount();
    }
  });
});

describe("SolutionFigures 스테퍼(S4-17)", () => {
  it("기본 = 최종, 버튼은 pill-tint + min-h-11, 상태 텍스트에만 aria-live", () => {
    const { container } = render(<Harness />);
    const group = screen.getByRole("group", { name: "그림 단계 이동" });
    const [prev, next] = [screen.getByRole("button", { name: "이전" }), screen.getByRole("button", { name: "다음" })];
    expect(screen.getByText("최종")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByText("최종")).toHaveAttribute("aria-atomic", "true");
    expect(next).toBeDisabled();
    expect(prev).not.toBeDisabled();
    for (const button of [prev, next]) expect(button.classList.contains("min-h-11")).toBe(true);
    expect(prev.className).toContain("bg-fill-tint-brand");
    expect(group.querySelectorAll("[aria-live]")).toHaveLength(1);
    expect(container.querySelectorAll("[aria-live='polite']")).toHaveLength(1);
  });

  it("이전: 최종 → 3 → 2 → 1(끝, 순환 없음). 1에서 이전이 disabled되면 포커스가 다음으로 이동", () => {
    render(<Harness />);
    const prev = screen.getByRole("button", { name: "이전" });
    const next = screen.getByRole("button", { name: "다음" });
    prev.focus();
    fireEvent.click(prev);
    expect(screen.getByTestId("k")).toHaveTextContent("3");
    expect(screen.getByText("3단계 / 3")).toBeInTheDocument();
    fireEvent.click(prev);
    fireEvent.click(prev);
    expect(screen.getByTestId("k")).toHaveTextContent("1");
    expect(prev).toBeDisabled();
    expect(document.activeElement).toBe(next);
    fireEvent.click(next);
    fireEvent.click(next);
    fireEvent.click(next);
    expect(screen.getByTestId("k")).toHaveTextContent("final");
    expect(next).toBeDisabled();
    expect(document.activeElement).toBe(prev);
  });

  it("그림 여러 개는 같은 k를 공유하고 카드마다 스테퍼가 있다", () => {
    render(<Harness figures={[F09, F09]} />);
    const prevButtons = screen.getAllByRole("button", { name: "이전" });
    expect(prevButtons).toHaveLength(2);
    fireEvent.click(prevButtons[1] as HTMLElement);
    expect(screen.getAllByText("3단계 / 3")).toHaveLength(2);
  });

  it("분할 실패(표지 없음)나 단계 정보 없는 그림(F01은 steps 있음 → 표시, appearAt·steps 모두 없는 그림 → 미표시)", () => {
    const { unmount } = render(<Harness solutionMd="표지 없는 풀이" />);
    expect(screen.queryByRole("group", { name: "그림 단계 이동" })).toBeNull();
    unmount();
    const plain: FigureSpec = { ...F01, steps: [] };
    render(<Harness figures={[plain]} />);
    expect(screen.queryByRole("group", { name: "그림 단계 이동" })).toBeNull();
  });
});

describe("SolutionFigures 스테퍼 이동량(재작업 1 L-H)", () => {
  function renderAt(step: number | null, stepCount = 4) {
    const onStepChange = vi.fn();
    const md = Array.from({ length: stepCount }, (_, i) => `**${i + 1}단계** s${i + 1}`).join("\n");
    render(<SolutionFigures phase="received" figures={[F09]} solutionMd={md} step={step} onStepChange={onStepChange} />);
    return onStepChange;
  }

  it.each([
    [2, "이전", 1],
    [2, "다음", 3],
    [3, "이전", 2],
    [3, "다음", 4],
    [4, "다음", null],
    [null, "이전", 4],
  ] as const)("k=%s에서 %s → 정확히 %s(한 번 호출, 한 칸)", (k, name, expected) => {
    const onStepChange = renderAt(k);
    fireEvent.click(screen.getByRole("button", { name }));
    expect(onStepChange).toHaveBeenCalledTimes(1);
    expect(onStepChange).toHaveBeenCalledWith(expected);
    if (typeof k === "number" && typeof expected === "number") expect(Math.abs(expected - k)).toBe(1);
  });

  it("끝에서는 이동하지 않는다(k=1 이전, 최종 다음은 disabled → 호출 0)", () => {
    const atFirst = renderAt(1);
    fireEvent.click(screen.getByRole("button", { name: "이전" }));
    expect(atFirst).not.toHaveBeenCalled();
    cleanup();
    const atFinal = renderAt(null);
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    expect(atFinal).not.toHaveBeenCalled();
  });
});
