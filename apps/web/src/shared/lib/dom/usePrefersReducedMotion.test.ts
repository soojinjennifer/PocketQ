import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubMatchMedia(initial: boolean) {
  const listeners = new Set<() => void>();
  const mediaQueryList = {
    matches: initial,
    media: "(prefers-reduced-motion: reduce)",
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
  };
  const matchMedia = vi.fn(() => mediaQueryList);
  vi.stubGlobal("matchMedia", matchMedia);
  return {
    matchMedia,
    listeners,
    change: (matches: boolean) => {
      mediaQueryList.matches = matches;
      act(() => listeners.forEach((listener) => listener()));
    },
  };
}

describe("usePrefersReducedMotion", () => {
  it("matchMedia가 없으면 false", () => {
    vi.stubGlobal("matchMedia", undefined);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);
  });

  it("현재 설정을 읽고 change 이벤트에 따라 바뀐다", () => {
    const media = stubMatchMedia(false);
    const { result, unmount } = renderHook(() => usePrefersReducedMotion());
    expect(media.matchMedia).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");
    expect(result.current).toBe(false);
    media.change(true);
    expect(result.current).toBe(true);
    unmount();
    expect(media.listeners.size).toBe(0);
  });
});
