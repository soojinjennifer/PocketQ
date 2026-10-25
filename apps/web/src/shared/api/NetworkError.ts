/**
 * 서버에 도달하지 못해 응답 자체를 받지 못한 요청을 표현하는 에러 클래스.
 * 서버가 4xx/5xx로 응답한 경우는 `ApiError`이며 이 클래스로 감싸지 않는다.
 *
 * - `unreachable`: `fetch()`가 `TypeError`로 reject한 경우(네트워크 단절, CORS, TLS, 잘못된 호스트/IP).
 * - `timeout`: `AbortSignal.timeout`(`createTimeoutSignal`)이 만료돼 `TimeoutError`로 reject한 경우.
 *
 * 사용자가 직접 취소한 `AbortError`는 연결 오류가 아니므로 이 클래스로 바꾸지 않는다.
 */
export type NetworkErrorKind = "unreachable" | "timeout";

export class NetworkError extends Error {
  readonly kind: NetworkErrorKind;

  constructor(kind: NetworkErrorKind, options?: { cause?: unknown }) {
    super(kind === "timeout" ? "서버 응답 시간이 초과되었습니다." : "서버에 연결하지 못했습니다.", options);
    this.name = "NetworkError";
    this.kind = kind;
  }
}

export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError;
}
