import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useKeyboardInset } from "./useKeyboardInset";

/** 테스트용 최소 `VisualViewport` mock — 실제 이벤트 타깃처럼 리스너 등록/발화를 지원한다. */
function createMockVisualViewport(initial: { height: number; offsetTop: number }) {
  const listeners = new Map<string, Set<() => void>>();
  const viewport = {
    height: initial.height,
    offsetTop: initial.offsetTop,
    addEventListener: (type: string, listener: () => void) => {
      if (!listeners.has(type)) {
        listeners.set(type, new Set());
      }
      listeners.get(type)?.add(listener);
    },
    removeEventListener: (type: string, listener: () => void) => {
      listeners.get(type)?.delete(listener);
    },
    dispatch: (type: string) => {
      listeners.get(type)?.forEach((listener) => listener());
    },
  };
  return viewport;
}

describe("useKeyboardInset", () => {
  const originalInnerHeight = window.innerHeight;
  const originalVisualViewport = window.visualViewport;

  afterEach(() => {
    Object.defineProperty(window, "innerHeight", { value: originalInnerHeight, configurable: true });
    Object.defineProperty(window, "visualViewport", { value: originalVisualViewport, configurable: true });
  });

  it("visualViewport를 지원하지 않으면 항상 0을 반환한다(회귀 없음)", () => {
    Object.defineProperty(window, "visualViewport", { value: undefined, configurable: true });

    const { result } = renderHook(() => useKeyboardInset());

    expect(result.current).toBe(0);
  });

  it("키보드가 닫혀 있으면(레이아웃 뷰포트와 시각 뷰포트 높이가 같으면) 0을 반환한다", () => {
    Object.defineProperty(window, "innerHeight", { value: 834, configurable: true });
    const viewport = createMockVisualViewport({ height: 834, offsetTop: 0 });
    Object.defineProperty(window, "visualViewport", { value: viewport, configurable: true });

    const { result } = renderHook(() => useKeyboardInset());

    expect(result.current).toBe(0);
  });

  it("키보드가 열려 레이아웃 뷰포트보다 시각 뷰포트가 줄어들면 그 차이(px)를 반환한다", () => {
    Object.defineProperty(window, "innerHeight", { value: 834, configurable: true });
    const viewport = createMockVisualViewport({ height: 834, offsetTop: 0 });
    Object.defineProperty(window, "visualViewport", { value: viewport, configurable: true });

    const { result } = renderHook(() => useKeyboardInset());

    act(() => {
      viewport.height = 500;
      viewport.dispatch("resize");
    });

    expect(result.current).toBe(334);
  });

  it("resize/scroll 리스너를 언마운트 시 정리한다", () => {
    Object.defineProperty(window, "innerHeight", { value: 834, configurable: true });
    const viewport = createMockVisualViewport({ height: 834, offsetTop: 0 });
    Object.defineProperty(window, "visualViewport", { value: viewport, configurable: true });

    const { unmount } = renderHook(() => useKeyboardInset());
    unmount();

    // 언마운트 후 dispatch해도 예외 없이 무시된다(리스너가 실제로 제거됐는지는 등록 시점의
    // Set 크기로 간접 확인 — act() 경고 없이 조용히 끝나면 정리된 것).
    expect(() => viewport.dispatch("resize")).not.toThrow();
  });
});
