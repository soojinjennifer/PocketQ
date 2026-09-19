import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const STORAGE_KEY = "pq:renderMode";

/**
 * `renderMode`는 모듈 로드 시점에 `localStorage`/URL을 1회 읽어 모드를 고정하므로, 시나리오마다
 * `vi.resetModules()` 후 다시 `import`해서 매번 새 모듈 인스턴스로 검증한다
 * (`pointerCaptureMode.test.ts`의 기존 패턴과 동일).
 */
async function importFreshModule() {
  vi.resetModules();
  return import("./renderMode");
}

describe("renderMode", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.pushState({}, "", "/");
  });

  afterEach(() => {
    window.localStorage.clear();
    window.history.pushState({}, "", "/");
    vi.restoreAllMocks();
  });

  it("기본값은 cache다(localStorage/URL 모두 없을 때)", async () => {
    const mod = await importFreshModule();

    expect(mod.getRenderMode()).toBe("cache");
    expect(mod.isDirectRenderModeEnabled()).toBe(false);
  });

  it("URL 쿼리 파라미터 ?renderMode=direct가 있으면 모듈 로드 시 localStorage에 저장되어 이후에도 활성 상태가 유지된다", async () => {
    window.history.pushState({}, "", "/?renderMode=direct");
    const mod = await importFreshModule();

    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("direct");
    expect(mod.getRenderMode()).toBe("direct");
    expect(mod.isDirectRenderModeEnabled()).toBe(true);

    // 새로고침(재로딩)을 흉내 낸다 — URL 쿼리 없이도 localStorage만으로 유지되어야 한다.
    window.history.pushState({}, "", "/");
    const modAfterReload = await importFreshModule();
    expect(modAfterReload.getRenderMode()).toBe("direct");
  });

  it("localStorage.removeItem 후에는 기본값(cache)으로 복귀한다", async () => {
    window.localStorage.setItem(STORAGE_KEY, "direct");
    const mod = await importFreshModule();
    expect(mod.getRenderMode()).toBe("direct");

    window.localStorage.removeItem(STORAGE_KEY);
    const modAfterRemove = await importFreshModule();
    expect(modAfterRemove.getRenderMode()).toBe("cache");
    expect(modAfterRemove.isDirectRenderModeEnabled()).toBe(false);
  });
});
