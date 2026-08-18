import type { ErrorRequestHandler } from "express";
import { AppError } from "../shared/errors/AppError";

/**
 * 모든 라우트 뒤에 등록하는 전역 에러 핸들러.
 * AppError는 code/status/message/details를 그대로 사용하고,
 * 그 외 예상치 못한 에러는 500 + internal_error로 감싼다.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined ? { details: err.details } : {}),
      },
    });
    return;
  }

  // AppError가 아닌 예상 못한 에러(Supabase/OpenAI SDK 원본 에러 등)는 서버 로그에만 원본을
  // 남기고, 클라이언트에는 일반 메시지만 노출한다(Final QA MEDIUM-1 — 원본 메시지가 그대로
  // 노출되면 내부 구현 세부사항이 새어나갈 수 있다).
  console.error("[errorHandler] 예상치 못한 오류", err);
  res.status(500).json({ error: { code: "internal_error", message: "예상치 못한 오류가 발생했습니다." } });
};
