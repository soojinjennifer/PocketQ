import { useCallback } from "react";
import { useNavigate } from "react-router";
import { supabase } from "../../shared/lib/supabase/client";

export type OAuthProvider = "kakao" | "google";

export interface AuthActionResult {
  error: string | null;
}

export interface SignUpActionResult extends AuthActionResult {
  /** true면 Supabase 콘솔의 이메일 인증 설정으로 인해 즉시 세션이 발급되지 않았음을 의미한다. */
  needsEmailConfirmation: boolean;
}

/**
 * Supabase 인증 액션(이메일 로그인/가입, 소셜 로그인, 로그아웃).
 * 로그인/가입 성공 시 /solve로, 로그아웃 성공 시 /login으로 replace 이동해
 * 뒤로가기로 이전 화면에 복귀하지 않게 한다.
 */
export function useAuthActions() {
  const navigate = useNavigate();

  const signInWithEmail = useCallback(
    async (email: string, password: string): Promise<AuthActionResult> => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        return { error: error.message };
      }
      void navigate("/solve", { replace: true });
      return { error: null };
    },
    [navigate],
  );

  const signUpWithEmail = useCallback(
    async (email: string, password: string): Promise<SignUpActionResult> => {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        return { error: error.message, needsEmailConfirmation: false };
      }
      if (data.session) {
        void navigate("/solve", { replace: true });
        return { error: null, needsEmailConfirmation: false };
      }
      // 세션이 없으면 Supabase 콘솔의 이메일 인증 설정에 의해 가입이 즉시 완료되지 않은 것이다.
      return { error: null, needsEmailConfirmation: true };
    },
    [navigate],
  );

  const signInWithOAuth = useCallback(
    async (provider: OAuthProvider): Promise<AuthActionResult> => {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: window.location.origin },
      });
      if (error) {
        return { error: error.message };
      }
      // 성공 시 브라우저가 Provider로 리다이렉트된다 — 복귀 후 "/" 인덱스 라우트가
      // 인증 상태를 확인해 /solve로 이동시킨다(별도 콜백 라우트 없음).
      return { error: null };
    },
    [],
  );

  const signOut = useCallback(async (): Promise<AuthActionResult> => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      return { error: error.message };
    }
    void navigate("/login", { replace: true });
    return { error: null };
  }, [navigate]);

  return { signInWithEmail, signUpWithEmail, signInWithOAuth, signOut };
}
