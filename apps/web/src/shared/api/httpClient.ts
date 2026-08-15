import { supabase } from "../lib/supabase/client";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;

if (!apiBaseUrl) {
  console.error(
    "VITE_API_BASE_URL 환경변수가 설정되지 않았습니다. apps/web/.env.example을 참고해 설정하세요.",
  );
}

/** `apps/api` 라우트 경로(`/api/...`)를 받아 베이스 URL과 합친 전체 URL을 반환한다. */
export function buildApiUrl(path: string): string {
  return `${apiBaseUrl ?? ""}${path}`;
}

/**
 * 스트리밍이 아닌 단발성 요청(예: 문제 인식)의 기본 타임아웃. API 서버 호스트가 응답 없이 멈춰있는
 * 경우(예: 잘못된/오래된 LAN IP, 네트워크 단절) `fetch()`가 브라우저 TCP 타임아웃까지 무한정 대기하며
 * "로딩 스피너가 멈추지 않는" 것처럼 보이는 문제를 막기 위해 사용한다. SSE 스트리밍 요청(`solve`)은
 * 정상적으로도 오래 걸릴 수 있어 이 타임아웃을 적용하지 않는다.
 */
export const DEFAULT_FETCH_TIMEOUT_MS = 30_000;

/** `fetch()`의 `signal`로 바로 전달할 수 있는, 지정한 시간 후 자동 abort되는 `AbortSignal`을 만든다. */
export function createTimeoutSignal(ms: number = DEFAULT_FETCH_TIMEOUT_MS): AbortSignal {
  return AbortSignal.timeout(ms);
}

/**
 * 매 요청마다 `supabase.auth.getSession()`으로 access token을 새로 읽어 `Authorization` 헤더를
 * 만든다. 토큰을 캐싱하지 않는 이유는 만료된 토큰으로 요청을 보내는 문제를 피하기 위함이다
 * (Supabase 클라이언트가 `autoRefreshToken`으로 세션을 최신 상태로 유지하므로 매번 읽어도 비용이
 * 크지 않다).
 */
export async function getAuthHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}
