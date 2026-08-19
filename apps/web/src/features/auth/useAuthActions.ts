import { useCallback } from "react";
import { useNavigate } from "react-router";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../../shared/lib/supabase/client";
import { getUserNickname } from "./getUserNickname";

export type OAuthProvider = "kakao" | "google";

export interface AuthActionResult {
  error: string | null;
}

export interface SignInActionResult extends AuthActionResult {
  /** 로그인 성공 시 발급된 사용자 정보. 실패 시 null. 팝업 표시/이동 목적지 판단에 사용한다. */
  user: User | null;
  /** true면 이메일/비밀번호가 일치하지 않아 실패했음을 의미한다(오류 팝업 표시에 사용). */
  isInvalidCredentials: boolean;
}

export interface SignUpActionResult extends AuthActionResult {
  /** true면 Supabase 콘솔의 이메일 인증 설정으로 인해 즉시 세션이 발급되지 않았음을 의미한다. */
  needsEmailConfirmation: boolean;
  /** true면 가입은 성공했지만 자동 로그인 세션을 강제로 종료했음을 의미한다. */
  forcedSignOut: boolean;
  /** true면 이미 가입된 이메일로 재가입을 시도했음을 의미한다(오류 응답 또는 obfuscated 성공 응답 둘 다 포함). */
  alreadyRegistered: boolean;
}

/** 이 기기에 남아있는 세션에서 읽어낸 계정 정보(AUTH-9 이메일 찾기). */
export interface LocalAccountInfo {
  nickname: string | null;
  email: string;
}

/**
 * Supabase 인증 액션(이메일 로그인/가입, 소셜 로그인, 로그아웃).
 * 이메일 로그인/가입 성공 시에는 이 훅이 즉시 이동하지 않는다 — 호출부(페이지)가 결과를 받아
 * 팝업을 띄우고, 팝업의 버튼 클릭 시점에 이동을 수행한다.
 * 로그아웃 성공 시에는 그대로 /login으로 replace 이동해 뒤로가기로 이전 화면에 복귀하지 않게 한다.
 */
export function useAuthActions() {
  const navigate = useNavigate();

  const signInWithEmail = useCallback(
    async (email: string, password: string): Promise<SignInActionResult> => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        return {
          error: error.message,
          user: null,
          isInvalidCredentials: error.code === "invalid_credentials",
        };
      }
      return { error: null, user: data.user, isInvalidCredentials: false };
    },
    [],
  );

  const signUpWithEmail = useCallback(
    async (email: string, password: string, nickname: string): Promise<SignUpActionResult> => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { nickname } },
      });
      if (error) {
        const isAlreadyRegistered =
          error.code === "user_already_exists" ||
          error.code === "email_exists" ||
          /already registered/i.test(error.message);
        return {
          error: error.message,
          needsEmailConfirmation: false,
          forcedSignOut: false,
          alreadyRegistered: isAlreadyRegistered,
        };
      }
      if (data.session) {
        // 이메일 확인이 꺼져 있어 가입과 동시에 세션이 발급되더라도,
        // 가입 직후 자동 로그인 상태로 두지 않고 별도 로그인을 요구한다.
        // navigate는 팝업의 버튼 클릭 시점으로 미룬다.
        await supabase.auth.signOut();
        return {
          error: null,
          needsEmailConfirmation: false,
          forcedSignOut: true,
          alreadyRegistered: false,
        };
      }
      // Supabase 프로젝트의 "Confirm email" 설정이 켜져 있으면, 이미 가입된 이메일로 재가입 시도 시
      // 에러 없이 성공 응답이 오되 session이 null이고 identities 배열이 비어있다(obfuscated 응답).
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        return {
          error: null,
          needsEmailConfirmation: false,
          forcedSignOut: false,
          alreadyRegistered: true,
        };
      }
      // 세션이 없으면 Supabase 콘솔의 이메일 인증 설정에 의해 가입이 즉시 완료되지 않은 것이다.
      return {
        error: null,
        needsEmailConfirmation: true,
        forcedSignOut: false,
        alreadyRegistered: false,
      };
    },
    [],
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
      // 인증 상태를 확인해 목적지(getPostAuthDestination)로 이동시킨다(별도 콜백 라우트 없음).
      return { error: null };
    },
    [],
  );

  /**
   * AUTH-9 — 이 기기에 남아있는 Supabase 세션에서 닉네임/이메일을 읽는다.
   * 서버에 이메일을 조회하지 않으며, 세션이 없거나 이메일이 없으면 null을 반환한다.
   */
  const findLocalAccount = useCallback(async (): Promise<LocalAccountInfo | null> => {
    const { data } = await supabase.auth.getSession();
    const sessionUser = data.session?.user ?? null;
    if (!sessionUser?.email) {
      return null;
    }
    return { nickname: getUserNickname(sessionUser), email: sessionUser.email };
  }, []);

  /** AUTH-10 — 비밀번호 재설정 이메일을 발송한다(표준 Supabase 흐름, 세션 유무 무관). */
  const resetPasswordForEmail = useCallback(
    async (email: string): Promise<AuthActionResult> => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (error) {
        return { error: error.message };
      }
      return { error: null };
    },
    [],
  );

  /**
   * AUTH-10 — 비밀번호 재설정 이메일로 발송된 8자리 인증 코드를 검증한다.
   * 검증 성공 시 Supabase가 recovery 세션을 발급한다(PASSWORD_RECOVERY 이벤트 발생).
   * Supabase 원본 에러 메시지를 그대로 반환한다 — 사용자에게 노출할 때 일반화하는 것은
   * 호출부(LoginPage)의 책임이다(이메일 존재 여부 비노출 요구사항).
   */
  const verifyPasswordResetOtp = useCallback(
    async (email: string, code: string): Promise<AuthActionResult> => {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: "recovery",
      });
      if (error) {
        return { error: error.message };
      }
      return { error: null };
    },
    [],
  );

  /**
   * AUTH-10 — recovery 세션 상태에서 비밀번호를 갱신한다.
   * 갱신 후 recovery 세션 종료(signOut)는 호출부의 책임이다(이 함수는 갱신만 담당).
   */
  const updatePassword = useCallback(async (newPassword: string): Promise<AuthActionResult> => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      return { error: error.message };
    }
    return { error: null };
  }, []);

  const signOut = useCallback(async (): Promise<AuthActionResult> => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      return { error: error.message };
    }
    void navigate("/login", { replace: true });
    return { error: null };
  }, [navigate]);

  return {
    signInWithEmail,
    signUpWithEmail,
    signInWithOAuth,
    signOut,
    findLocalAccount,
    resetPasswordForEmail,
    verifyPasswordResetOtp,
    updatePassword,
  };
}
