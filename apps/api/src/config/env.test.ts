import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_CORS_ORIGIN = process.env["CORS_ORIGIN"];

// env.ts는 모듈 로드 시점에 process.env를 읽는 모듈 수준 상수이므로,
// 값을 바꿔가며 테스트하려면 매번 vi.resetModules()로 캐시를 비우고 다시 import해야 한다.
describe("env.corsOrigin", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    if (ORIGINAL_CORS_ORIGIN === undefined) {
      delete process.env["CORS_ORIGIN"];
    } else {
      process.env["CORS_ORIGIN"] = ORIGINAL_CORS_ORIGIN;
    }
    vi.resetModules();
  });

  it("CORS_ORIGIN이 빈 문자열이면 기본값(http://localhost:5173)으로 대체된다", async () => {
    process.env["CORS_ORIGIN"] = "";
    const { env } = await import("./env");
    expect(env.corsOrigin).toBe("http://localhost:5173");
  });

  it("CORS_ORIGIN이 undefined면 기본값(http://localhost:5173)으로 대체된다", async () => {
    delete process.env["CORS_ORIGIN"];
    const { env } = await import("./env");
    expect(env.corsOrigin).toBe("http://localhost:5173");
  });

  it("CORS_ORIGIN이 값을 가지면 그 값을 그대로 사용한다", async () => {
    process.env["CORS_ORIGIN"] = "https://app.whymath.kr";
    const { env } = await import("./env");
    expect(env.corsOrigin).toBe("https://app.whymath.kr");
  });
});

const ORIGINAL_FIGURES_ENABLED = process.env["FIGURES_ENABLED"];

describe("env.figuresEnabled (도형 시각화 기능 플래그, 기본 off)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    if (ORIGINAL_FIGURES_ENABLED === undefined) {
      delete process.env["FIGURES_ENABLED"];
    } else {
      process.env["FIGURES_ENABLED"] = ORIGINAL_FIGURES_ENABLED;
    }
    vi.resetModules();
  });

  it("FIGURES_ENABLED가 없으면 false다", async () => {
    delete process.env["FIGURES_ENABLED"];
    const { env } = await import("./env");
    expect(env.figuresEnabled).toBe(false);
  });

  it("FIGURES_ENABLED가 빈 문자열이면 false다", async () => {
    process.env["FIGURES_ENABLED"] = "";
    const { env } = await import("./env");
    expect(env.figuresEnabled).toBe(false);
  });

  it.each(["1", "TRUE", "True", "yes", "on", " true"])("FIGURES_ENABLED=%j는 false다(정확히 \"true\"만 허용)", async (value) => {
    process.env["FIGURES_ENABLED"] = value;
    const { env } = await import("./env");
    expect(env.figuresEnabled).toBe(false);
  });

  it("FIGURES_ENABLED=true일 때만 true다", async () => {
    process.env["FIGURES_ENABLED"] = "true";
    const { env } = await import("./env");
    expect(env.figuresEnabled).toBe(true);
  });
});
