import { createContext } from "react";
import type { User } from "@supabase/supabase-js";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  holdPublicRedirect: boolean;
  setHoldPublicRedirect: (hold: boolean) => void;
  /**
   * 비밀번호 재설정 이메일 링크로 복귀해 recovery 세션이 발급된 상태(AUTH-10).
   * 이 값이 true면 인증 세션이 있어도 정상 로그인으로 취급하지 않고
   * 로그인 화면 위에 새 비밀번호 팝업을 띄운다.
   */
  isPasswordRecovery: boolean;
  setIsPasswordRecovery: (value: boolean) => void;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
