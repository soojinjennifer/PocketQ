import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PointerDebugEntry } from "./pointerDebugLog";

const STORAGE_KEY = "pq:pointerDebug";

/**
 * `pointerDebugLog`는 모듈 로드 시점에 `localStorage`/URL을 1회 읽어 활성화 여부를 고정하므로,
 * 시나리오마다 `vi.resetModules()` 후 다시 `import`해서 매번 새 모듈 인스턴스로 검증한다.
 */
async function importFreshModule() {
  vi.resetModules();
  return import("./pointerDebugLog");
}

function baseEntry(overrides: Partial<PointerDebugEntry> = {}): PointerDebugEntry {
  return {
    timestamp: 0,
    eventType: "pointerdown",
    activePointerIdBefore: null,
    activePointerIdAfter: null,
    drawing: false,
    coalescedCount: null,
    hasCapture: null,
    ...overrides,
  };
}

describe("pointerDebugLog", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.pushState({}, "", "/");
  });

  afterEach(() => {
    window.localStorage.clear();
    window.history.pushState({}, "", "/");
    delete window.__pqPointerDebug;
    vi.restoreAllMocks();
  });

  it("localStorage에 켜져 있지 않으면 비활성 상태이고 logPointerEvent가 no-op이다(dump는 항상 빈 배열, 전역 노출도 없음)", async () => {
    const mod = await importFreshModule();

    expect(mod.isPointerDebugEnabled()).toBe(false);
    mod.logPointerEvent(baseEntry());
    expect(mod.getPointerDebugDump()).toEqual([]);
    expect(window.__pqPointerDebug).toBeUndefined();
  });

  it("localStorage에 '1'이 저장돼 있으면 활성 상태이고 window.__pqPointerDebug가 노출되며 로그가 쌓인다", async () => {
    window.localStorage.setItem(STORAGE_KEY, "1");
    const mod = await importFreshModule();

    expect(mod.isPointerDebugEnabled()).toBe(true);
    expect(window.__pqPointerDebug).toBeDefined();

    mod.logPointerEvent(baseEntry({ timestamp: 1, activePointerIdAfter: 1, drawing: true }));
    expect(mod.getPointerDebugDump()).toHaveLength(1);
  });

  it("URL 쿼리 파라미터 ?pointerDebug=1이 있으면 모듈 로드 시 localStorage에 저장되어 이후에도 활성 상태가 유지된다", async () => {
    window.history.pushState({}, "", "/?pointerDebug=1");
    const mod = await importFreshModule();

    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("1");
    expect(mod.isPointerDebugEnabled()).toBe(true);
  });

  it("고정 크기(3000개) 순환 배열 — 그 이상 기록하면 가장 오래된 항목부터 덮어쓴다", async () => {
    window.localStorage.setItem(STORAGE_KEY, "1");
    const mod = await importFreshModule();

    for (let i = 0; i < 3005; i += 1) {
      mod.logPointerEvent(baseEntry({ timestamp: i, eventType: "pointermove" }));
    }

    const dump = mod.getPointerDebugDump();
    expect(dump).toHaveLength(3000);
    expect(dump[0]?.timestamp).toBe(5);
    expect(dump[dump.length - 1]?.timestamp).toBe(3004);
  });

  it("exportPointerDebugDump는 클립보드에 JSON 문자열을 기록한다", async () => {
    window.localStorage.setItem(STORAGE_KEY, "1");
    const mod = await importFreshModule();
    mod.logPointerEvent(baseEntry({ timestamp: 1, activePointerIdAfter: 1, drawing: true }));

    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    mod.exportPointerDebugDump();

    expect(writeText).toHaveBeenCalledTimes(1);
    const [json] = writeText.mock.calls[0] as [string];
    expect(JSON.parse(json)).toHaveLength(1);
  });

  it("exportPointerDebugDump는 클립보드가 없으면 console.log로 폴백한다", async () => {
    window.localStorage.setItem(STORAGE_KEY, "1");
    const mod = await importFreshModule();
    mod.logPointerEvent(baseEntry({ timestamp: 1 }));

    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    mod.exportPointerDebugDump();

    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
  });
});
