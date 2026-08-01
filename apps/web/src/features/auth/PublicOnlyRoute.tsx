import { useEffect, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "./useAuth";

interface PublicOnlyRouteProps {
  children: ReactNode;
}

/** /login, /register 등 공개 전용 라우트 가드 — 이미 인증된 사용자는 /solve로 이동시킨다. */
export function PublicOnlyRoute({ children }: PublicOnlyRouteProps) {
  const { status } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (status === "authenticated") {
      void navigate("/solve", { replace: true });
    }
  }, [status, navigate]);

  if (status === "authenticated") {
    return null;
  }

  return <>{children}</>;
}
