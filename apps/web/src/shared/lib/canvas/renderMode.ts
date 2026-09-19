/**
 * iPad 필기 유실 P0 진단용 — 커밋된 stroke를 화면에 그리는 방식을 런타임에서 전환할 수 있게
 * 한다. 기본값은 `"cache"`(기존 동작 그대로, 오프스크린 캐시에 커밋된 strokes를 미리 그려두고
 * 매 pointermove마다 그걸 그대로 복사(blit)한 뒤 활성 스트로크만 얹는다 — 성능 최적화).
 * `"direct"`로 전환하면 오프스크린 캐시를 전혀 쓰지 않고, 매 pointermove마다 커밋된 strokes
 * 전체 + 활성 스트로크를 메인 캔버스에 직접 처음부터 다시 그린다(더 느리지만 캐시-blit 경로
 * 자체를 완전히 우회한다 — 실기기에서 "번갈아 획이 영구적으로 안 보이는" 증상이 캐시 blit
 * 자체의 문제인지 확인하기 위한 A/B 비교용).
 *
 * 활성화 방법: URL에 `?renderMode=direct`를 붙여 페이지를 한 번 로드하면 `localStorage`에
 * 저장되어 이후 새로고침에도 유지된다. `localStorage.setItem("pq:renderMode", "direct")` 후
 * 새로고침해도 된다. `localStorage.removeItem("pq:renderMode")`로 기본값(cache)으로 되돌린다.
 */
const STORAGE_KEY = "pq:renderMode";

export type RenderMode = "cache" | "direct";

function readModeFromStorage(): RenderMode {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "direct" ? "direct" : "cache";
  } catch {
    return "cache";
  }
}

function persistModeFromUrl(): void {
  try {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("renderMode");
    if (requested === "direct" || requested === "cache") {
      window.localStorage.setItem(STORAGE_KEY, requested);
    }
  } catch {
    // localStorage/URL 접근이 막힌 환경에서는 조용히 무시한다.
  }
}

if (typeof window !== "undefined") {
  persistModeFromUrl();
}

const mode: RenderMode = typeof window !== "undefined" ? readModeFromStorage() : "cache";

export function getRenderMode(): RenderMode {
  return mode;
}

export function isDirectRenderModeEnabled(): boolean {
  return mode === "direct";
}
