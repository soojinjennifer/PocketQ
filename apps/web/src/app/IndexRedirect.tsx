import { useEffect } from "react";
import { useNavigate } from "react-router";
import { getPostAuthDestination } from "../features/auth/postAuthDestination";
import { useAuth } from "../features/auth/useAuth";
import { Spinner } from "../shared/ui/spinner/Spinner";

/**
 * "/" 인덱스 라우트 — 인증 상태에 따라 /login 또는 (/grade-setup | /solve)로 replace 이동한다.
 * 세션 확인이 끝나기 전(loading)에는 리다이렉트하지 않고 최소 로딩 화면만 보여준다.
 */
export function IndexRedirect() {
  const { status, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (status === "unauthenticated") {
      void navigate("/login", { replace: true });
    } else if (status === "authenticated") {
      void navigate(getPostAuthDestination(user), { replace: true });
    }
  }, [status, user, navigate]);

  return (
    <div className="bg-bg-primary flex min-h-screen items-center justify-center">
      <Spinner label="세션 확인 중" />
    </div>
  );
}
