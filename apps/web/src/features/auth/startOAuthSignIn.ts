import { supabase } from "../../shared/lib/supabase/client";

export type OAuthProvider = "kakao" | "google";

export interface AuthActionResult {
  error: string | null;
}

/**
 * 소셜 로그인(Supabase OAuth)을 시작한다. 라우터에 의존하지 않는 순수 함수라서 `useAuthActions`(앱, `/login`)와
 * 라우터가 없는 랜딩(`/home.html`)이 같은 흐름을 공유한다.
 *
 * 성공하면 브라우저가 Provider로 리다이렉트된다. 복귀 주소는 서비스 루트(`window.location.origin` = `/`)이고,
 * 거기서 인덱스 라우트가 인증 상태를 확인해 목적지(`getPostAuthDestination`)로 이동시킨다(별도 콜백 라우트 없음).
 */
export async function startOAuthSignIn(provider: OAuthProvider): Promise<AuthActionResult> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: window.location.origin },
  });
  if (error) {
    return { error: error.message };
  }
  return { error: null };
}
