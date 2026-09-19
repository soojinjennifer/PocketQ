import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const STORAGE_KEY = "pq:pointerCaptureMode";

/**
 * `pointerCaptureMode`는 모듈 로드 시점에 `localStorage`/URL을 1회 읽어 모드를 고정하므로,
 * 시나리오마다 `vi.resetModules()` 후 다시 `import`해서 매번 새 모듈 인스턴스로 검증한다
 * (`pointerDebugLog.test.ts`의 기존 패턴과 동일).
 */
async function importFreshModule() {
  vi.resetModules();
  return import("./pointerCaptureMode");
}

describe("pointerCaptureMode", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.pushState({}, "", "/");
  });

  afterEach(() => {
    window.localStorage.clear();
    window.history.pushState({}, "", "/");
    vi.restoreAllMocks();
  });

  it("기본값은 native다(localStorage/URL 모두 없을 때)", async () => {
    const mod = await importFreshModule();

    expect(mod.getPointerCaptureMode()).toBe("native");
    expect(mod.isExplicitPointerCaptureEnabled()).toBe(true);
  });

  it("URL 쿼리 파라미터 ?pointerCaptureMode=document-fallback-only가 있으면 모듈 로드 시 localStorage에 저장되어 이후에도 활성 상태가 유지된다", async () => {
    window.history.pushState({}, "", "/?pointerCaptureMode=document-fallback-only");
    const mod = await importFreshModule();

    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("document-fallback-only");
    expect(mod.getPointerCaptureMode()).toBe("document-fallback-only");
    expect(mod.isExplicitPointerCaptureEnabled()).toBe(false);

    // 새로고침(재로딩)을 흉내 낸다 — URL 쿼리 없이도 localStorage만으로 유지되어야 한다.
    window.history.pushState({}, "", "/");
    const modAfterReload = await importFreshModule();
    expect(modAfterReload.getPointerCaptureMode()).toBe("document-fallback-only");
  });

  it("localStorage.removeItem 후에는 기본값(native)으로 복귀한다", async () => {
    window.localStorage.setItem(STORAGE_KEY, "document-fallback-only");
    const mod = await importFreshModule();
    expect(mod.getPointerCaptureMode()).toBe("document-fallback-only");

    window.localStorage.removeItem(STORAGE_KEY);
    const modAfterRemove = await importFreshModule();
    expect(modAfterRemove.getPointerCaptureMode()).toBe("native");
    expect(modAfterRemove.isExplicitPointerCaptureEnabled()).toBe(true);
  });
});
