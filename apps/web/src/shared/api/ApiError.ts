import type { ErrorCode } from "shared-types";

/**
 * 백엔드 에러 응답(`{ error: { code, message } }`)을 그대로 표현하는 에러 클래스.
 * `apps/api/src/middleware/error-handler.ts`가 만드는 응답 형태와 1:1로 대응한다.
 */
export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;

  constructor(code: ErrorCode, message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === "string";
}

interface ApiErrorBody {
  error?: {
    code?: unknown;
    message?: unknown;
  };
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return typeof value === "object" && value !== null;
}

/** 표준 에러 응답 JSON(`{ error: { code, message } }`)을 `ApiError`로 변환한다. */
export function parseApiErrorBody(body: unknown, status: number, fallbackMessage: string): ApiError {
  if (isApiErrorBody(body) && typeof body.error === "object" && body.error !== null) {
    const code = isErrorCode(body.error.code) ? body.error.code : "internal_error";
    const message = typeof body.error.message === "string" ? body.error.message : fallbackMessage;
    return new ApiError(code, message, status);
  }
  return new ApiError("internal_error", fallbackMessage, status);
}
