import type {
  AiProvider,
  ChatMessage,
  Grade,
  RecognizedProblem,
  Solution,
  SolveOptions,
} from "shared-types";
import { env } from "../../config/env";
import { OpenAIAdapter } from "./openai-adapter";

export interface SolveRequest {
  problem: RecognizedProblem;
  options: SolveOptions;
  grade: Grade;
}

export type SolveStreamEvent = { delta: string } | { done: true; result: Solution };

/** 후속 질문(채팅) 요청 — 문제/최초 풀이 컨텍스트와 이전 대화 이력, 이번 질문을 함께 전달한다. */
export interface ChatRequest {
  problem: RecognizedProblem;
  solution: Solution;
  history: ChatMessage[];
  question: string;
  grade: Grade;
}

/**
 * PRD §8.3 LLM Adapter 인터페이스.
 * 실제 SDK(OpenAI/Anthropic) 타입은 절대 노출하지 않고 shared-types 도메인 타입만 사용한다.
 */
export interface LLMAdapter {
  /** 이미지에서 문제 텍스트/LaTeX 추출 */
  recognizeProblem(image: Buffer, grade: Grade): Promise<RecognizedProblem>;
  /** 개념/풀이 생성 — 스트리밍 */
  solve(req: SolveRequest): AsyncIterable<SolveStreamEvent>;
  /**
   * 후속 질문(채팅) 응답 생성 — 일반 완료 응답(스트리밍 아님, PRD CHAT-8: 실시간 스트리밍은 P1).
   * 반환값은 answerMd 하나뿐이다.
   */
  chat(req: ChatRequest): Promise<string>;
}

/**
 * Provider별 LLMAdapter 팩토리 (PRD §8.3: `createAdapter(AI_PROVIDER, AI_MODEL)`).
 *
 * Claude adapter는 아직 구현되지 않아 호출 시 명확한 오류를 던지는 스텁으로 남아있다.
 * OpenAI adapter는 실제 Responses API로 동작하며, `OPENAI_API_KEY`/`model`이 비어있으면
 * 여기서 즉시(호출 시점에) 설정 오류를 던진다 — 조용히 다른 동작으로 대체하지 않는다.
 */
export function createAdapter(provider: AiProvider, model: string): LLMAdapter {
  switch (provider) {
    case "openai": {
      if (!env.openaiApiKey) {
        throw new Error(
          "AI_PROVIDER=openai로 설정됐지만 OPENAI_API_KEY 환경변수가 비어 있습니다.",
        );
      }
      if (!model) {
        throw new Error("AI_PROVIDER=openai로 설정됐지만 AI_MODEL 환경변수가 비어 있습니다.");
      }
      return new OpenAIAdapter(model, env.openaiApiKey);
    }
    case "claude":
      throw new Error("Claude adapter는 아직 구현되지 않았습니다 (5단계 이후 범위).");
  }
}
