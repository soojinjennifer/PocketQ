import { useEffect, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { getPostAuthDestination } from "./postAuthDestination";
import { useAuth } from "./useAuth";

interface PublicOnlyRouteProps {
  children: ReactNode;
}

/**
 * /login, /register 등 공개 전용 라우트 가드 — 이미 인증된 사용자는
 * 학년 설정 여부에 따라 /grade-setup 또는 /solve로 이동시킨다.
 */
export function PublicOnlyRoute({ children }: PublicOnlyRouteProps) {
  const { status, user, holdPublicRedirect } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (status === "authenticated" && !holdPublicRedirect) {
      void navigate(getPostAuthDestination(user), { replace: true });
    }
  }, [status, user, holdPublicRedirect, navigate]);

  if (status === "authenticated" && !holdPublicRedirect) {
    return null;
  }

  return <>{children}</>;
}
