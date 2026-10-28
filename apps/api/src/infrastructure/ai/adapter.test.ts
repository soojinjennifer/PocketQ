import { afterEach, describe, expect, it, vi } from "vitest";
import { createAdapter } from "./adapter";
import { OpenAIAdapter } from "./openai-adapter";

const gateway = vi.hoisted(() => ({ aiGateway: undefined as "runyour" | undefined, runyourApiKey: "" }));

vi.mock("../../config/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../config/env")>();
  return {
    ...actual,
    env: new Proxy(actual.env, {
      get: (target, key): unknown =>
        key === "aiGateway" || key === "runyourApiKey" ? gateway[key] : Reflect.get(target, key),
    }),
  };
});

describe("createAdapter", () => {
  it("openai인데 OPENAI_API_KEY가 비어 있으면(테스트 환경 기본값) 명확한 설정 오류를 던진다", () => {
    // 이 테스트는 실행 환경에 OPENAI_API_KEY가 설정돼 있지 않다는 전제로 동작한다
    // (CI/로컬 모두 .env를 로드하지 않는 테스트 실행 방식상 기본적으로 비어 있다).
    expect(() => createAdapter("openai", "some-model")).toThrow(/OPENAI_API_KEY/);
  });

  it("claude는 아직 구현되지 않았으므로 명확한 에러를 던진다", () => {
    expect(() => createAdapter("claude", "claude-sonnet-5")).toThrow(/구현되지 않았습니다/);
  });
});

describe("createAdapter — AI_GATEWAY=runyour", () => {
  afterEach(() => {
    gateway.aiGateway = undefined;
    gateway.runyourApiKey = "";
  });

  function useRunyour(apiKey: string) {
    gateway.aiGateway = "runyour";
    gateway.runyourApiKey = apiKey;
  }

  it("RUNYOUR_API_KEY가 비어 있으면 명확한 설정 오류를 던진다", () => {
    useRunyour("");
    expect(() => createAdapter("openai", "anthropic/claude-sonnet-5")).toThrow(/RUNYOUR_API_KEY/);
  });

  it("AI_MODEL이 비어 있으면 명확한 설정 오류를 던진다", () => {
    useRunyour("test-key");
    expect(() => createAdapter("openai", "")).toThrow(/AI_MODEL/);
  });

  it("키와 모델이 있으면 OPENAI_API_KEY 없이도 OpenAI 호환 어댑터를 만든다", () => {
    useRunyour("test-key");
    expect(createAdapter("openai", "anthropic/claude-sonnet-5")).toBeInstanceOf(OpenAIAdapter);
  });
});

describe("OpenAIAdapter", () => {
  it("LLMAdapter interface를 구현한다(타입 계약 확인용, 네트워크 호출 없음)", () => {
    const adapter = new OpenAIAdapter("test-model", "test-key");
    expect(typeof adapter.recognizeProblem).toBe("function");
    expect(typeof adapter.solve).toBe("function");
    expect(typeof adapter.chat).toBe("function");
  });
});
