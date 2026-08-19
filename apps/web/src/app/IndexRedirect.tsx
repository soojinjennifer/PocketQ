import { useEffect } from "react";
import { useNavigate } from "react-router";
import { getPostAuthDestination } from "../features/auth/postAuthDestination";
import { useAuth } from "../features/auth/useAuth";
import { Spinner } from "../shared/ui/spinner/Spinner";

/**
 * "/" 인덱스 라우트 — 인증 상태에 따라 /login 또는 (/grade-setup | /solve)로 replace 이동한다.
 * 세션 확인이 끝나기 전(loading)에는 리다이렉트하지 않고 최소 로딩 화면만 보여준다.
 * 비밀번호 재설정 링크로 복귀한 경우(recovery 세션)에는 인증 상태여도 /login으로 보내
 * 로그인 화면 위에서 새 비밀번호 팝업을 처리하게 한다(AUTH-10).
 */
export function IndexRedirect() {
  const { status, user, isPasswordRecovery } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (status === "unauthenticated") {
      void navigate("/login", { replace: true });
    } else if (status === "authenticated") {
      void navigate(isPasswordRecovery ? "/login" : getPostAuthDestination(user), {
        replace: true,
      });
    }
  }, [status, user, isPasswordRecovery, navigate]);

  return (
    <div className="bg-bg-primary flex min-h-screen items-center justify-center">
      <Spinner label="세션 확인 중" />
    </div>
  );
}
