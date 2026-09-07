import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_CAS_SERVICE_URL = process.env["CAS_SERVICE_URL"];

/**
 * `env.ts`(`config/env.test.ts`)와 동일한 이유로 매번 `vi.resetModules()`를 거쳐 다시
 * import한다 — `env`가 모듈 로드 시점에 `process.env`를 읽는 모듈 수준 상수이기 때문이다.
 */
describe("resolveCasClient", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    if (ORIGINAL_CAS_SERVICE_URL === undefined) {
      delete process.env["CAS_SERVICE_URL"];
    } else {
      process.env["CAS_SERVICE_URL"] = ORIGINAL_CAS_SERVICE_URL;
    }
    vi.resetModules();
  });

  it("CAS_SERVICE_URL이 비어 있으면 stubCasVerification/stubResumeCasCheck로 폴백한다", async () => {
    process.env["CAS_SERVICE_URL"] = "";
    const { resolveCasClient } = await import("./resolveCasClient");
    const { HttpCasClient } = await import("./casClient");

    const client = resolveCasClient();

    expect(client).not.toBeInstanceOf(HttpCasClient);

    // stubCasVerification과 동일하게 모든 줄을 isValid: true로 반환해야 한다.
    const results = await client.verifyWorkLines([
      { lineNo: 1, latex: "y = x^{2} - 4x + 3", isLowConfidence: false },
      { lineNo: 2, latex: "\\text{말이 안 되는 줄}", isLowConfidence: true },
    ]);
    expect(results).toEqual([
      { lineNo: 1, isValid: true },
      { lineNo: 2, isValid: true },
    ]);

    // stubResumeCasCheck와 동일하게 항상 verified: true를 반환해야 한다.
    const { verified } = await client.verifyFinalAnswer("-1", "아무 값");
    expect(verified).toBe(true);
  });

  it("CAS_SERVICE_URL이 설정돼 있으면 HttpCasClient를 반환한다", async () => {
    process.env["CAS_SERVICE_URL"] = "http://localhost:8000";
    const { resolveCasClient } = await import("./resolveCasClient");
    const { HttpCasClient } = await import("./casClient");

    const client = resolveCasClient();

    expect(client).toBeInstanceOf(HttpCasClient);
  });
});
