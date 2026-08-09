import type { AiProvider, Grade, RecognizedProblem, Solution, SolveOptions } from "shared-types";

export interface SolveRequest {
  problem: RecognizedProblem;
  options: SolveOptions;
}

export type SolveStreamEvent = { delta: string } | { done: true; result: Solution };

/**
 * PRD §8.3 LLM Adapter 인터페이스.
 * 실제 SDK(OpenAI/Anthropic) 타입은 절대 노출하지 않고 shared-types 도메인 타입만 사용한다.
 */
export interface LLMAdapter {
  /** 이미지에서 문제 텍스트/LaTeX 추출 */
  recognizeProblem(image: Buffer, grade: Grade): Promise<RecognizedProblem>;
  /** 개념/풀이 생성 — 스트리밍 */
  solve(req: SolveRequest): AsyncIterable<SolveStreamEvent>;
}

/**
 * Provider별 LLMAdapter 팩토리.
 *
 * 주의: 이번 vertical slice(1~4단계)에서는 openai/claude 어댑터가 실제로 구현되지 않는다.
 * 호출 시 명확한 오류를 던지는 스텁으로만 존재하며, 5단계 이후 실제 SDK 연동으로 대체된다.
 * 현재 라우트들은 이 함수를 사용하지 않고 fake adapter를 직접 사용한다
 * (`infrastructure/ai/resolve-adapter.ts` 참고).
 */
export function createAdapter(provider: AiProvider, _model: string): LLMAdapter {
  switch (provider) {
    case "openai":
      throw new Error("OpenAI adapter는 아직 구현되지 않았습니다 (5단계 이후 범위).");
    case "claude":
      throw new Error("Claude adapter는 아직 구현되지 않았습니다 (5단계 이후 범위).");
  }
}
