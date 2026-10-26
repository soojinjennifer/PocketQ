import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { Spinner } from "../../shared/ui/spinner/Spinner";
import { hasSignupConsent } from "./signupConsent";
import { SignupConsentGate } from "./SignupConsentGate";
import { useAuth } from "./useAuth";

interface ProtectedRouteProps {
  children: ReactNode;
}

/**
 * 인증이 필요한 라우트 공용 가드.
 * /grade-setup, /solve, /mypage, /camera, /camera/preview 전체가 이 컴포넌트 하나를 재사용한다.
 *
 * 인증됐지만 가입 동의 기록이 없는 사용자(PRD AUTH-11)에게는 원래 화면 대신 가입 동의 게이트를
 * 렌더한다(Gate A, D2). 새 라우트나 이동 없이 같은 경로에서 바꿔 그리므로, 동의가 끝나면 원래 화면이
 * 그대로 이어진다. 동의 판단은 `AuthProvider`의 `user`(→ `USER_UPDATED`)가 기준이며, 저장 응답에서
 * 먼저 동의가 확인되면 그 사용자 id를 기억해 이벤트를 기다리지 않는다(R5).
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { status, user } = useAuth();
  const navigate = useNavigate();
  const [consentedUserId, setConsentedUserId] = useState<string | null>(null);

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

  const isConsentConfirmed =
    hasSignupConsent(user) || (user !== null && consentedUserId === user.id);
  if (!isConsentConfirmed) {
    return <SignupConsentGate onConsented={setConsentedUserId} />;
  }

  return <>{children}</>;
}
