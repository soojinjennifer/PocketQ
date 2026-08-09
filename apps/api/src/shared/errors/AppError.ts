import type { ErrorCode } from "shared-types";

/**
 * ErrorCode 기반 커스텀 에러.
 * error-handler 미들웨어가 이 타입을 감지해 일관된 JSON 에러 응답으로 변환한다.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, status: number, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}
