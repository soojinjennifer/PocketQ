/**
 * shared-types
 *
 * API 스키마와 무관한 Provider 독립적 도메인 타입만 정의한다.
 * 런타임 의존성이 전혀 없는 순수 타입 선언 전용 패키지다 (zod 등 금지).
 */

/** 학생 학년: 중1~중3, 고1~고3 */
export type Grade = "M1" | "M2" | "M3" | "H1" | "H2" | "H3";

/** 풀이 요청 시 선택 옵션 (개념 설명 / 풀이 각각 켜고 끌 수 있다) */
export interface SolveOptions {
  concept: boolean;
  solution: boolean;
}

/** 풀이 생성에 사용하는 AI 제공자 */
export type AiProvider = "openai" | "claude";

/** 이미지에서 인식된 문제 원문/LaTeX */
export interface RecognizedProblem {
  recognizedText: string;
  recognizedLatex: string | null;
}

/** AI가 생성한 개념 설명·풀이·답 결과 */
export interface Solution {
  conceptMd: string | null;
  solutionMd: string | null;
  answerMd: string;
  conceptTags: string[];
  aiProvider: AiProvider;
  aiModel: string;
}

/** 후속 질문(채팅) 메시지의 발화자 */
export type ChatRole = "user" | "assistant";

/** 후속 질문(채팅) 대화 이력의 개별 메시지 */
export interface ChatMessage {
  role: ChatRole;
  content: string;
}

/** API 전역에서 사용하는 에러 코드 */
export type ErrorCode =
  | "validation_error"
  | "unauthorized"
  | "recognition_failed"
  | "not_math_problem"
  | "provider_error"
  | "timeout"
  | "rate_limited"
  | "internal_error";
