import { useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../../shared/lib/supabase/client";
import { AuthContext, type AuthStatus } from "./AuthContext";

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * 인증 상태(Context) 제공자.
 * 마운트 시 getSession()으로 세션 복원을 시도하고 onAuthStateChange로 이후 변화를 반영한다.
 * 세션 복원이 끝나기 전(loading)에는 어떤 리다이렉트도 발생시키지 않는다 — 리다이렉트는
 * 이 Context를 구독하는 라우트 가드(ProtectedRoute/PublicOnlyRoute/IndexRedirect)의 책임이다.
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [holdPublicRedirect, setHoldPublicRedirect] = useState(false);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  useEffect(() => {
    let isMounted = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      setUser(data.session?.user ?? null);
      setStatus(data.session ? "authenticated" : "unauthenticated");
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      setUser(session?.user ?? null);
      setStatus(session ? "authenticated" : "unauthenticated");
      if (event === "PASSWORD_RECOVERY") {
        // 재설정 메일 링크로 복귀한 경우다. 발급된 recovery 세션 때문에 PublicOnlyRoute가
        // 로그인 화면을 떠나버리지 않도록 공개 라우트 리다이렉트를 함께 보류한다(AUTH-10).
        setIsPasswordRecovery(true);
        setHoldPublicRedirect(true);
      }
      if (!session) {
        setHoldPublicRedirect(false);
        setIsPasswordRecovery(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        status,
        user,
        holdPublicRedirect,
        setHoldPublicRedirect,
        isPasswordRecovery,
        setIsPasswordRecovery,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
