// @vitest-environment node
import type { UserConfig } from "vite";
import type { VitePWAOptions } from "vite-plugin-pwa";
import { beforeEach, describe, expect, it, vi } from "vitest";
import viteConfig, { BUILD_INPUT, NAVIGATE_FALLBACK_DENYLIST } from "../../../vite.config";

// VitePWA에 실제로 넘어가는 옵션을 가로챈다 — 상수만 보는 테스트는 플러그인 설정에서 빠져도 통과해 버린다(M-QA-2).
const { vitePwaCalls } = vi.hoisted(() => ({ vitePwaCalls: [] as Partial<VitePWAOptions>[] }));
vi.mock("vite-plugin-pwa", () => ({
  VitePWA: (options: Partial<VitePWAOptions>) => {
    vitePwaCalls.push(options);
    return [];
  },
}));

function resolveConfig(): UserConfig {
  if (typeof viteConfig !== "function") {
    throw new Error("vite.config는 함수형 설정이어야 한다");
  }
  return viteConfig({ mode: "production", command: "build" });
}

function resolveWorkboxOptions() {
  vitePwaCalls.length = 0;
  resolveConfig();
  expect(vitePwaCalls).toHaveLength(1);
  const workbox = vitePwaCalls[0]?.workbox;
  if (!workbox) throw new Error("VitePWA에 workbox 옵션이 없다");
  return workbox;
}

beforeEach(() => {
  vitePwaCalls.length = 0;
});

describe("vite 멀티 페이지 설정(랜딩 /home.html)", () => {
  it("빌드 입력에 앱(main)과 랜딩(home) 두 HTML이 들어 있다", () => {
    expect(BUILD_INPUT.main).toMatch(/[\\/]index\.html$/);
    expect(BUILD_INPUT.home).toMatch(/[\\/]home\.html$/);
    expect(resolveConfig().build?.rolldownOptions?.input).toBe(BUILD_INPUT);
  });

  it("VitePWA workbox 옵션이 실제로 랜딩 거부 목록을 쓴다", () => {
    const workbox = resolveWorkboxOptions();
    expect(workbox.navigateFallbackDenylist).toBe(NAVIGATE_FALLBACK_DENYLIST);
  });

  it("VitePWA workbox 옵션이 home.html을 precache에서 뺀다(항상 네트워크에서 새로 받음)", () => {
    const workbox = resolveWorkboxOptions();
    expect(workbox.globIgnores).toContain("home.html");
  });

  it.each([
    ["/home.html", true],
    ["/home.html?ref=x", true],
    ["/home.html?ref=kakao&utm_source=share", true],
    ["/home.html#video", true],
    ["/home", false],
    ["/home.htmlx", false],
    ["/", false],
    ["/login", false],
    ["/solve/pencilcanvas", false],
  ] as const)("거부 목록: %s → %s", (pathWithSearch, expected) => {
    const workbox = resolveWorkboxOptions();
    const denylist = workbox.navigateFallbackDenylist ?? [];
    expect(denylist.some((pattern) => pattern.test(pathWithSearch))).toBe(expected);
  });
});
