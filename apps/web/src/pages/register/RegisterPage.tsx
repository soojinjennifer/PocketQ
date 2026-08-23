import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { useAuthActions, type OAuthProvider } from "../../features/auth/useAuthActions";
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

type RegisterModalState =
  | { kind: "none" }
  | { kind: "completed" }
  | { kind: "email-confirmation" }
  | { kind: "already-registered" };

/**
 * 최소 기술 회원가입 UI (Figma 최종 디자인 아님).
 * 닉네임/이메일/비밀번호 필드 3개, 이메일 가입 제출, Kakao/Google 소셜 가입,
 * 오류 메시지 영역, 로딩 인디케이터만 구현한다.
 * 가입 성공 시에는 즉시 이동하지 않고 완료/이메일 인증 대기 팝업을 띄운 뒤,
 * 팝업의 버튼 클릭 시점에 이동(또는 팝업 닫기만) 처리한다.
 */
export function RegisterPage() {
  const navigate = useNavigate();
  const { signUpWithEmail, signInWithOAuth } = useAuthActions();
  const { setHoldPublicRedirect } = useAuth();

  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingProvider, setPendingProvider] = useState<OAuthProvider | null>(null);
  const [modalState, setModalState] = useState<RegisterModalState>({ kind: "none" });

  const isBusy = isSubmitting || pendingProvider !== null || modalState.kind !== "none";

  const handleSignUp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);
    setHoldPublicRedirect(true);
    const result = await signUpWithEmail(email, password, nickname);
    setIsSubmitting(false);
    if (result.alreadyRegistered) {
      setHoldPublicRedirect(false);
      setModalState({ kind: "already-registered" });
      return;
    }
    if (result.error) {
      setHoldPublicRedirect(false);
      setErrorMessage(result.error);
      return;
    }
    if (result.needsEmailConfirmation) {
      setModalState({ kind: "email-confirmation" });
      setHoldPublicRedirect(false);
      return;
    }
    if (result.forcedSignOut) {
      setModalState({ kind: "completed" });
    }
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
    if (id === "login") {
      void navigate("/login");
    }
  };

  return (
    <div className="bg-bg-primary flex min-h-screen flex-col items-center justify-center gap-6 px-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <Logo size="large" />
        <h1 className="text-label-primary text-lg font-semibold">포켓큐</h1>
        <p className="text-label-secondary text-sm">
          궁금증이 풀릴 때까지 답해주는 수학 개념 튜터
        </p>
        <NavTabBar items={NAV_TAB_ITEMS} activeId="register" onSelect={handleTabSelect} />
      </div>

      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Button variant="social-kakao" disabled={isBusy} onClick={() => void handleOAuth("kakao")}>
            카카오로 가입하기
          </Button>
          <Button variant="social-google" disabled={isBusy} onClick={() => void handleOAuth("google")}>
            Google로 가입하기
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <div className="bg-separator h-px flex-1" />
          <span className="text-label-secondary text-xs">또는 이메일로</span>
          <div className="bg-separator h-px flex-1" />
        </div>

        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => void handleSignUp(event)}
          noValidate
        >
          <InputGroup
            fields={[
              {
                name: "nickname",
                type: "text",
                placeholder: "제가 부를 수 있는 닉네임을 입력해 주세요",
                value: nickname,
                onChange: setNickname,
                autoComplete: "nickname",
              },
            ]}
          />

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
                autoComplete: "new-password",
              },
            ]}
          />

          <div role="alert" aria-live="polite" className="min-h-5 text-sm">
            {errorMessage ? <span className="text-accent-orange">{errorMessage}</span> : null}
          </div>

          <Button type="submit" variant="primary" disabled={isBusy}>
            이메일로 가입하기
          </Button>
        </form>

        <p className="text-label-tertiary text-center text-xs">
          가입하면 이메일·닉네임·학년만 수집해요
        </p>

        {isBusy && modalState.kind === "none" ? (
          <div className="flex justify-center">
            <Spinner label="처리 중" />
          </div>
        ) : null}
      </div>

      {modalState.kind === "completed" ? (
        <Modal
          icon="check"
          title="회원가입이 완료 되었습니다"
          description={`안녕하세요, 이제 우리"포켓큐"에서 매일 만나요!`}
          actionLabel="로그인하기"
          onAction={() => {
            setHoldPublicRedirect(false);
            void navigate("/login", { replace: true });
          }}
        />
      ) : null}

      {modalState.kind === "email-confirmation" ? (
        <Modal
          icon="email"
          title="이메일 인증 대기중"
          description="이메일을 확인해 주세요"
          actionLabel="계속하기"
          onAction={() => setModalState({ kind: "none" })}
        />
      ) : null}

      {modalState.kind === "already-registered" ? (
        <Modal
          icon="check"
          title="이미 가입되어 있습니다"
          description="로그인을 해주세요"
          actionLabel="로그인하러 가기"
          onAction={() => void navigate("/login", { replace: true })}
        />
      ) : null}
    </div>
  );
}
