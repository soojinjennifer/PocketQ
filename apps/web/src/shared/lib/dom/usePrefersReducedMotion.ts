import { useSyncExternalStore } from "react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function getMediaQueryList(): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return null;
  }
  return window.matchMedia(REDUCED_MOTION_QUERY);
}

function subscribe(onChange: () => void): () => void {
  const mediaQueryList = getMediaQueryList();
  if (!mediaQueryList) {
    return () => {};
  }
  mediaQueryList.addEventListener("change", onChange);
  return () => mediaQueryList.removeEventListener("change", onChange);
}

function getSnapshot(): boolean {
  return getMediaQueryList()?.matches ?? false;
}

/** 사용자가 OS에서 "동작 줄이기"를 켰는지. 설정이 바뀌면 다시 렌더한다. matchMedia가 없으면 false다. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
