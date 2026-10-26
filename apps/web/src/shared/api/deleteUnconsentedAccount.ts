import { parseApiErrorBody } from "./ApiError";
import { buildApiUrl, createTimeoutSignal, fetchWithNetworkError, getAuthHeaders } from "./httpClient";

/**
 * 미동의 계정 삭제 결과.
 * - `deleted`: 서버가 계정을 지웠다(204).
 * - `already-consented`: 서버가 가입 동의 기록을 찾아 삭제를 거부했다(409, 다른 탭에서 이미 동의한 경우 등).
 */
export type DeleteUnconsentedAccountResult = "deleted" | "already-consented";

/**
 * `DELETE /api/account/unconsented` — 가입 동의 게이트에서 "만 14세 미만이에요"를 고른 사용자가
 * 자신의 계정을 지운다(PRD AUTH-11). 서버가 동의 기록 유무를 다시 확인하므로, 동의가 기록된 계정은
 * 이 경로로 지워지지 않는다.
 *
 * 세션 정리(`signOut`)와 화면 이동은 호출부(features/auth)의 책임이다. 그 밖의 실패는 `ApiError`
 * 또는 `NetworkError`로 던진다.
 */
export async function deleteUnconsentedAccount(): Promise<DeleteUnconsentedAccountResult> {
  const authHeaders = await getAuthHeaders();
  const response = await fetchWithNetworkError(buildApiUrl("/api/account/unconsented"), {
    method: "DELETE",
    headers: authHeaders,
    signal: createTimeoutSignal(),
  });

  if (response.status === 204) {
    return "deleted";
  }

  const body: unknown = await response.json().catch(() => null);

  if (response.status === 409) {
    return "already-consented";
  }

  throw parseApiErrorBody(body, response.status, "계정 정보를 삭제하지 못했습니다.");
}
