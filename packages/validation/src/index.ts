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
  /**
   * 소프트 캡(하루 10회, 매일 자정 UTC 리셋, 오너 확정) 안내용 — 오늘 누적 인식 횟수(이번 요청
   * 포함). 인증된 사용자에 대해서만, 그리고 서버의 카운트 조회가 성공했을 때만 채워진다(선택
   * 필드). 이 값이 있어도 인식 자체는 절대 차단되지 않는다 — `dailyUsageLimit`을 초과했을 때
   * 경고를 보여줄지는 프론트가 자유롭게 판단한다(별도 boolean 경고 플래그 없음).
   */
  dailyUsageCount: z.number().optional(),
  /** `dailyUsageCount`의 소프트 캡 상한(항상 10). */
  dailyUsageLimit: z.number().optional(),
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

/** POST /api/problems/:problemId/suggestions 응답 스키마(Final QA MEDIUM-4 — 동적 후속 질문 제안). */
export const suggestedQuestionsResponseSchema = z.object({
  questions: z.array(z.string()),
});
export type SuggestedQuestionsResponseDto = z.infer<typeof suggestedQuestionsResponseSchema>;

/** GET /api/problems 응답의 개별 이력 항목 */
export const problemHistoryListItemSchema = z.object({
  problemId: z.string(),
  recognizedText: z.string(),
  conceptTags: z.array(z.string()),
  createdAt: z.string(),
});
export type ProblemHistoryListItemDto = z.infer<typeof problemHistoryListItemSchema>;

/** GET /api/problems 응답 스키마 (마이페이지 풀이 이력 목록).
 *  최신순 정렬은 서버가 처리하므로 클라이언트는 재정렬하지 않는다. */
export const problemHistoryListResponseSchema = z.object({
  items: z.array(problemHistoryListItemSchema),
});
export type ProblemHistoryListResponseDto = z.infer<typeof problemHistoryListResponseSchema>;

/**
 * GET /api/problems/:problemId 응답 스키마 (풀이 이력 상세).
 * `solution`은 recognize만 끝나고 solve가 완료되지 않은 문제를 위해 nullable이다.
 */
export const problemHistoryDetailSchema = z.object({
  problemId: z.string(),
  recognizedText: z.string(),
  recognizedLatex: z.string().nullable(),
  createdAt: z.string(),
  solution: z
    .object({
      conceptMd: z.string().nullable(),
      solutionMd: z.string().nullable(),
      answerMd: z.string(),
      conceptTags: z.array(z.string()),
      aiProvider: z.enum(["openai", "claude"]),
      aiModel: z.string(),
    })
    .nullable(),
  chatMessages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
      createdAt: z.string(),
    }),
  ),
});
export type ProblemHistoryDetailDto = z.infer<typeof problemHistoryDetailSchema>;

/** 줄 단위 인식 결과(`shared-types.WorkLine`) 응답 스키마 — `POST /api/problems/:problemId/work-lines`. */
export const workLinesResponseSchema = z.object({
  workLines: z.array(
    z.object({
      lineNo: z.number(),
      latex: z.string(),
      isLowConfidence: z.boolean(),
    }),
  ),
});
export type WorkLinesResponseDto = z.infer<typeof workLinesResponseSchema>;

/**
 * `POST /api/problems/:problemId/diagnose` 요청 스키마.
 * 클라이언트가 확인/수정한 줄만 보낸다(`isLowConfidence` 등 인식 메타데이터는 서버가 다시 필요로
 * 하지 않는다).
 */
export const diagnoseRequestSchema = z.object({
  workLines: z.array(
    z.object({
      lineNo: z.number(),
      latex: z.string(),
    }),
  ),
});
export type DiagnoseRequestDto = z.infer<typeof diagnoseRequestSchema>;

/** `POST /api/problems/:problemId/diagnose` 응답 스키마(`shared-types.Diagnosis`와 필드 동일). */
export const diagnoseResponseSchema = z.object({
  lastValidLine: z.number(),
  stallLine: z.number().nullable(),
  errorTypeLabel: z.string().nullable(),
  errorDetail: z.string().nullable(),
  relatedConcepts: z.array(z.string()),
  reachedAnswerWithNotes: z.boolean(),
  isLowConfidence: z.boolean(),
  conceptExplanations: z.array(
    z.object({
      name: z.string(),
      title: z.string(),
      explanationMd: z.string(),
    }),
  ),
  identifiedMethod: z
    .object({
      methodId: z.string(),
      methodName: z.string(),
    })
    .nullable(),
  isMethodApplicable: z.boolean(),
  methodApplicabilityNote: z.string().nullable(),
  problemAnswerLatex: z.string(),
});
export type DiagnoseResponseDto = z.infer<typeof diagnoseResponseSchema>;

/**
 * `POST /api/problems/:problemId/resume` 요청 스키마(RESUME). problemId는 URL 파라미터로
 * 전달되므로 body에는 `mode`만 담는다.
 */
export const resumeRequestSchema = z.object({
  mode: z.enum(["own", "alternative"]),
});
export type ResumeRequestDto = z.infer<typeof resumeRequestSchema>;

/**
 * `POST /api/problems/bulk-delete` 요청 스키마(마이페이지 개선 3번, 체크박스 일괄 삭제).
 * `DELETE /api/problems`가 아니라 POST 액션 경로를 쓴다 — 이 라우터의 다른 변형 액션
 * (`POST /api/problems/:problemId/reopen`)과 동일한 컨벤션을 따른다.
 */
export const bulkDeleteProblemsRequestSchema = z.object({
  problemIds: z.array(z.string()).min(1),
});
export type BulkDeleteProblemsRequestDto = z.infer<typeof bulkDeleteProblemsRequestSchema>;

/**
 * `POST /api/problems/bulk-delete` 응답 스키마. `getProblemDetail`과 동일한 정보 노출 방지
 * 원칙(존재하지 않음/타인 소유를 구분하지 않음)에 따라, 실제로 삭제된(=본인 소유로 확인된)
 * `problemId`만 돌려준다 — 요청에 포함됐지만 삭제되지 않은 id가 "없어서"인지 "타인 소유"인지는
 * 응답에서 구분하지 않는다.
 */
export const bulkDeleteProblemsResponseSchema = z.object({
  deletedProblemIds: z.array(z.string()),
});
export type BulkDeleteProblemsResponseDto = z.infer<typeof bulkDeleteProblemsResponseSchema>;
