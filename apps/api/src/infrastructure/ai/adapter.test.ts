import { describe, expect, it } from "vitest";
import { createAdapter } from "./adapter";

describe("createAdapter", () => {
  it("openai는 아직 구현되지 않았으므로 명확한 에러를 던진다", () => {
    expect(() => createAdapter("openai", "gpt-4o")).toThrow(/구현되지 않았습니다/);
  });

  it("claude는 아직 구현되지 않았으므로 명확한 에러를 던진다", () => {
    expect(() => createAdapter("claude", "claude-sonnet-5")).toThrow(/구현되지 않았습니다/);
  });
});
