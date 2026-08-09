import { env } from "../../config/env";
import type { LLMAdapter } from "./adapter";
import { FakeLLMAdapter } from "./fake-adapter";

/**
 * 라우트가 실제로 사용할 어댑터를 결정한다.
 *
 * 이번 vertical slice(1~4단계)에서는 AI_PROVIDER 환경변수 값과 무관하게
 * 항상 FakeLLMAdapter를 강제로 사용한다 (5단계 이전에 실제 OpenAI/Claude를 호출하지 않는 것이 최우선).
 * env.aiProvider/env.aiModel은 응답에 기록되는 라벨로만 사용하고,
 * 실제 provider 분기(createAdapter)는 5단계에서 이어받는다.
 */
export function resolveAdapter(): LLMAdapter {
  return new FakeLLMAdapter(env.aiProvider ?? "claude", env.aiModel || "fake-whymath-v0");
}
