/**
 * iPad 필기 유실 P0 진단용 — 명시적 `setPointerCapture` 시도 자체를 런타임에서 끄고 켤 수 있게
 * 한다. 기본값은 `"native"`(기존 동작 그대로, 명시적 캡처를 시도한다) — 이 값을 바꾸는 것은
 * 실기기에서 두 모드(native capture 시도 vs 항상 document fallback 사용)를 비교 검증한 뒤
 * 오너가 확정한 다음에만 한다(오너 지시: "기본 동작을 바꾸기 전에 두 모드를 비교한다").
 *
 * 활성화 방법: URL에 `?pointerCaptureMode=document-fallback-only`를 붙여 페이지를 한 번
 * 로드하면 `localStorage`에 저장되어 이후 새로고침에도 유지된다. 콘솔에서
 * `localStorage.setItem("pq:pointerCaptureMode", "document-fallback-only")` 후 새로고침해도 된다.
 * `localStorage.removeItem("pq:pointerCaptureMode")`로 기본값(native)으로 되돌린다.
 */
const STORAGE_KEY = "pq:pointerCaptureMode";

export type PointerCaptureMode = "native" | "document-fallback-only";

function readModeFromStorage(): PointerCaptureMode {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "document-fallback-only" ? "document-fallback-only" : "native";
  } catch {
    return "native";
  }
}

function persistModeFromUrl(): void {
  try {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("pointerCaptureMode");
    if (requested === "document-fallback-only" || requested === "native") {
      window.localStorage.setItem(STORAGE_KEY, requested);
    }
  } catch {
    // localStorage/URL 접근이 막힌 환경에서는 조용히 무시한다.
  }
}

if (typeof window !== "undefined") {
  persistModeFromUrl();
}

const mode: PointerCaptureMode = typeof window !== "undefined" ? readModeFromStorage() : "native";

/** 현재 pointer capture 모드. 모듈 로드 시 1회만 계산되고 이후 바뀌지 않는다(기존
 * `pointerDebugLog.ts`의 `isPointerDebugEnabled()`와 동일한 패턴). */
export function getPointerCaptureMode(): PointerCaptureMode {
  return mode;
}

/** `setPointerCapture`를 시도해야 하는지 여부. `false`면 `HandwritingCanvas`가 명시적 캡처 호출
 * 자체를 건너뛰고 항상 document-level fallback 경로를 사용한다(진단용 A/B 비교). */
export function isExplicitPointerCaptureEnabled(): boolean {
  return mode !== "document-fallback-only";
}
