import { useEffect, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { Spinner } from "../../shared/ui/spinner/Spinner";
import { useAuth } from "./useAuth";

interface ProtectedRouteProps {
  children: ReactNode;
}

/**
 * 인증이 필요한 라우트 공용 가드.
 * /grade-setup, /solve, /mypage, /camera, /camera/preview 전체가 이 컴포넌트 하나를 재사용한다.
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { status } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (status === "unauthenticated") {
      void navigate("/login", { replace: true });
    }
  }, [status, navigate]);

  if (status === "loading") {
    return (
      <div className="bg-bg-primary flex min-h-screen items-center justify-center">
        <Spinner label="세션 확인 중" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return null;
  }

  return <>{children}</>;
}
