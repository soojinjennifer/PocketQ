/**
 * validation
 *
 * recognize/solve 요청·응답의 zod 런타임 검증 스키마와 그로부터 도출한 DTO 타입.
 * DTO 타입은 항상 `z.infer`로만 도출하고 별도로 재선언하지 않는다.
 */
import { z } from "zod";

const gradeSchema = z.enum(["M1", "M2", "M3", "H1", "H2", "H3"]);

/**
 * POST /api/problems/recognize 요청 스키마.
 * 이미지 파일 자체는 multer가 별도로 처리하므로 여기서는 텍스트 필드만 검증한다.
 */
export const recognizeRequestSchema = z.object({
  inputType: z.enum(["photo", "handwriting"]),
  grade: gradeSchema,
});
export type RecognizeRequestDto = z.infer<typeof recognizeRequestSchema>;

/**
 * Vision 모델의 원시 구조화 출력(Structured Outputs) 검증 스키마.
 * `recognizeResponseSchema`(HTTP 응답 전체)와는 별개로, AI가 실제로 반환한 값만 검증한다
 * (problemId/createdAt은 AI 응답이 아니라 서버가 이후에 부여하는 값이라 이 스키마엔 없다).
 */
export const recognizedProblemSchema = z.object({
  recognizedText: z.string(),
  recognizedLatex: z.string().nullable(),
});
export type RecognizedProblemDto = z.infer<typeof recognizedProblemSchema>;

/** POST /api/problems/recognize 응답 스키마 */
export const recognizeResponseSchema = z.object({
  problemId: z.string(),
  recognizedText: z.string(),
  recognizedLatex: z.string().nullable(),
  createdAt: z.string(),
});
export type RecognizeResponseDto = z.infer<typeof recognizeResponseSchema>;

/** POST /api/problems/:problemId/solve 요청 스키마 */
export const solveRequestSchema = z.object({
  options: z.object({
    concept: z.boolean(),
    solution: z.boolean(),
  }),
  confirmedText: z.string().optional(),
});
export type SolveRequestDto = z.infer<typeof solveRequestSchema>;

/**
 * POST /api/problems/:problemId/chat 요청 스키마.
 * `history`는 서버에 저장하지 않는 stateless 설계라 매 요청마다 클라이언트가 전체 이력을 보낸다.
 * `max(2000)`은 Figma/PRD에 명시된 근거가 없는 합리적 기본값이다 — 결정 필요, 오너 확인 시 조정 가능.
 */
export const chatRequestSchema = z.object({
  question: z.string().trim().min(1).max(2000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      }),
    )
    .default([]),
});
export type ChatRequestDto = z.infer<typeof chatRequestSchema>;

/** POST /api/problems/:problemId/chat 응답 스키마 (일반 JSON 완료 응답 — SSE 아님, PRD CHAT-8) */
export const chatResponseSchema = z.object({
  answerMd: z.string(),
});
export type ChatResponseDto = z.infer<typeof chatResponseSchema>;
