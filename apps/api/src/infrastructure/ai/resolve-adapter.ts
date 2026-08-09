import { env } from "../../config/env";
import { createAdapter, type LLMAdapter } from "./adapter";
import { FakeLLMAdapter } from "./fake-adapter";

/**
 * 라우트가 실제로 사용할 어댑터를 결정한다.
 *
 * `AI_PROVIDER` 환경변수가 설정돼 있으면 `createAdapter`로 실제 provider를 생성한다
 * (openai는 실제 Responses API 연동, claude는 아직 스텁이라 호출 시 에러).
 * `AI_PROVIDER`가 설정돼 있지 않으면(로컬 개발/테스트 등 AI 설정이 아예 없는 환경) 조용히
 * 실패하지 않도록 FakeLLMAdapter로 폴백한다 — 단, provider가 명시적으로 설정된 경우에는
 * 절대 fake로 대체하지 않는다(설정 오류는 `createAdapter`가 즉시 던진다).
 */
export function resolveAdapter(): LLMAdapter {
  if (!env.aiProvider) {
    return new FakeLLMAdapter();
  }

  return createAdapter(env.aiProvider, env.aiModel);
}
