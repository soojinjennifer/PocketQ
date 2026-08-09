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

  const message = err instanceof Error ? err.message : "예상치 못한 오류가 발생했습니다.";
  res.status(500).json({ error: { code: "internal_error", message } });
};
