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
