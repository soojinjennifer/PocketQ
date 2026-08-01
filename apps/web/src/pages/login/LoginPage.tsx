import type { User } from "@supabase/supabase-js";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { useAuthActions, type OAuthProvider } from "../../features/auth/useAuthActions";
import { getPostAuthDestination } from "../../features/auth/postAuthDestination";
import { useAuth } from "../../features/auth/useAuth";
import { Button } from "../../shared/ui/button/Button";
import { InputGroup } from "../../shared/ui/input/Input";
import { Logo } from "../../shared/ui/logo/Logo";
import { Modal } from "../../shared/ui/modal/Modal";
import { NavTabBar } from "../../shared/ui/nav-tab-bar/NavTabBar";
import { Spinner } from "../../shared/ui/spinner/Spinner";

const NAV_TAB_ITEMS = [
  { id: "register", label: "회원가입" },
  { id: "login", label: "로그인" },
];

type LoginModalState =
  | { kind: "none" }
  | { kind: "success"; user: User }
  | { kind: "invalid-credentials" };

/**
 * 최소 기술 로그인 UI (Figma 최종 디자인 아님).
 * 이메일/비밀번호 필드 2개, 이메일 로그인 제출, Kakao/Google 소셜 로그인,
 * 오류 메시지 영역, 로딩 인디케이터만 구현한다.
 * 이메일 로그인 성공 시에는 즉시 이동하지 않고 완료 팝업을 띄운 뒤,
 * 팝업의 "계속하기" 버튼 클릭 시점에 목적지로 이동한다.
 */
export function LoginPage() {
  const navigate = useNavigate();
  const { signInWithEmail, signInWithOAuth } = useAuthActions();
  const { setHoldPublicRedirect } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingProvider, setPendingProvider] = useState<OAuthProvider | null>(null);
  const [modalState, setModalState] = useState<LoginModalState>({ kind: "none" });

  const isBusy = isSubmitting || pendingProvider !== null || modalState.kind !== "none";

  const handleSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);
    setHoldPublicRedirect(true);
    const result = await signInWithEmail(email, password);
    setIsSubmitting(false);
    if (result.isInvalidCredentials) {
      setHoldPublicRedirect(false);
      setPassword("");
      setModalState({ kind: "invalid-credentials" });
      return;
    }
    if (result.error || !result.user) {
      setHoldPublicRedirect(false);
      setErrorMessage(result.error ?? "로그인 처리 중 오류가 발생했습니다.");
      return;
    }
    setModalState({ kind: "success", user: result.user });
  };

  const handleOAuth = async (provider: OAuthProvider) => {
    setErrorMessage(null);
    setPendingProvider(provider);
    const result = await signInWithOAuth(provider);
    setPendingProvider(null);
    if (result.error) {
      setErrorMessage(result.error);
    }
  };

  const handleTabSelect = (id: string) => {
    if (id === "register") {
      void navigate("/register");
    }
  };

  const signedInUser = modalState.kind === "success" ? modalState.user : null;
  const nickname =
    typeof signedInUser?.user_metadata?.nickname === "string"
      ? signedInUser.user_metadata.nickname
      : null;
  const welcomeMessage = nickname
    ? `${nickname}님, 다시 오셨네요. 오늘도 풀어볼까요?`
    : "다시 오셨네요. 오늘도 풀어볼까요?";

  return (
    <div className="bg-bg-primary flex min-h-screen flex-col items-center justify-center gap-6 px-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <Logo size="large" />
        <h1 className="text-label-primary text-lg font-semibold">왜?수학</h1>
        <p className="text-label-secondary text-sm">
          궁금증이 풀릴 때까지 답해주는 수학 개념 튜터
        </p>
        <NavTabBar items={NAV_TAB_ITEMS} activeId="login" onSelect={handleTabSelect} />
      </div>

      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Button variant="social-kakao" disabled={isBusy} onClick={() => void handleOAuth("kakao")}>
            카카오로 계속하기
          </Button>
          <Button variant="social-google" disabled={isBusy} onClick={() => void handleOAuth("google")}>
            Google로 계속하기
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <div className="bg-separator h-px flex-1" />
          <span className="text-label-secondary text-xs">또는 이메일로</span>
          <div className="bg-separator h-px flex-1" />
        </div>

        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => void handleSignIn(event)}
          noValidate
        >
          <InputGroup
            fields={[
              {
                name: "email",
                type: "email",
                placeholder: "이메일",
                value: email,
                onChange: setEmail,
                autoComplete: "email",
              },
              {
                name: "password",
                type: "password",
                placeholder: "비밀번호",
                value: password,
                onChange: setPassword,
                autoComplete: "current-password",
              },
            ]}
          />

          <div role="alert" aria-live="polite" className="min-h-5 text-sm">
            {errorMessage ? <span className="text-accent-orange">{errorMessage}</span> : null}
          </div>

          <Button type="submit" variant="primary" disabled={isBusy}>
            이메일로 계속하기
          </Button>
        </form>

        <p className="text-label-tertiary text-center text-xs">
          소셜 로그인과 이메일 로그인 모두 가능해요.
        </p>

        {isBusy && modalState.kind === "none" ? (
          <div className="flex justify-center">
            <Spinner label="처리 중" />
          </div>
        ) : null}
      </div>

      {modalState.kind === "success" ? (
        <Modal
          icon="check"
          title="로그인 되었습니다"
          description={welcomeMessage}
          actionLabel="계속하기"
          onAction={() => {
            setHoldPublicRedirect(false);
            void navigate(getPostAuthDestination(modalState.user), { replace: true });
          }}
        />
      ) : null}

      {modalState.kind === "invalid-credentials" ? (
        <Modal
          icon="email"
          title="이메일이나 비밀번호가 틀렸습니다"
          description="다시 확인하고 시도해 주세요"
          actionLabel="확인"
          onAction={() => setModalState({ kind: "none" })}
        />
      ) : null}
    </div>
  );
}
