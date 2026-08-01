import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { useAuthActions, type OAuthProvider } from "../../features/auth/useAuthActions";
import { Logo } from "../../shared/ui/logo/Logo";
import { NavTabBar } from "../../shared/ui/nav-tab-bar/NavTabBar";
import { Spinner } from "../../shared/ui/spinner/Spinner";

const NAV_TAB_ITEMS = [
  { id: "register", label: "회원가입" },
  { id: "login", label: "로그인" },
];

/**
 * 최소 기술 회원가입 UI (Figma 최종 디자인 아님).
 * 이메일/비밀번호 필드 2개, 이메일 가입 제출, Kakao/Google 소셜 가입,
 * 오류/안내 메시지 영역, 로딩 인디케이터만 구현한다.
 */
export function RegisterPage() {
  const navigate = useNavigate();
  const { signUpWithEmail, signInWithOAuth } = useAuthActions();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingProvider, setPendingProvider] = useState<OAuthProvider | null>(null);

  const isBusy = isSubmitting || pendingProvider !== null;

  const handleSignUp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);
    setIsSubmitting(true);
    const result = await signUpWithEmail(email, password);
    setIsSubmitting(false);
    if (result.error) {
      setErrorMessage(result.error);
      return;
    }
    if (result.needsEmailConfirmation) {
      setInfoMessage("가입 요청이 접수되었습니다. 이메일 인증 절차는 안내에 따라 진행해 주세요.");
    }
  };

  const handleOAuth = async (provider: OAuthProvider) => {
    setErrorMessage(null);
    setInfoMessage(null);
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
    <div className="bg-bg-primary flex min-h-screen items-center justify-center px-6">
      <div className="bg-bg-elevated w-full max-w-sm rounded-lg p-6">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Logo size="large" />
          <h1 className="text-label-primary text-lg font-semibold">왜?수학</h1>
          <p className="text-label-secondary text-sm">
            궁금증이 풀릴 때까지 답해주는 수학 개념 튜터
          </p>
          <NavTabBar items={NAV_TAB_ITEMS} activeId="register" onSelect={handleTabSelect} />
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={isBusy}
            onClick={() => void handleOAuth("kakao")}
            className="bg-kakao-bg text-kakao-label rounded px-4 py-2 disabled:opacity-50"
          >
            카카오로 가입하기
          </button>
          <button
            type="button"
            disabled={isBusy}
            onClick={() => void handleOAuth("google")}
            className="border-separator text-label-primary rounded border px-4 py-2 disabled:opacity-50"
          >
            Google로 가입하기
          </button>
        </div>

        <div className="my-4 flex items-center gap-2">
          <div className="bg-separator h-px flex-1" />
          <span className="text-label-secondary text-xs">또는 이메일로</span>
          <div className="bg-separator h-px flex-1" />
        </div>

        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => void handleSignUp(event)}
          noValidate
        >
          <label className="text-label-secondary flex flex-col gap-1 text-sm">
            이메일
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="border-separator text-label-primary rounded border px-3 py-2"
            />
          </label>

          <label className="text-label-secondary flex flex-col gap-1 text-sm">
            비밀번호
            <input
              type="password"
              name="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="border-separator text-label-primary rounded border px-3 py-2"
            />
          </label>

          <div role="alert" aria-live="polite" className="min-h-5 text-sm">
            {errorMessage ? <span className="text-accent-orange">{errorMessage}</span> : null}
          </div>
          {infoMessage ? <p className="text-label-secondary text-sm">{infoMessage}</p> : null}

          <button
            type="submit"
            disabled={isBusy}
            className="bg-brand text-label-on-dark rounded px-4 py-2 disabled:opacity-50"
          >
            이메일로 가입하기
          </button>
        </form>

        <p className="text-label-tertiary mt-4 text-center text-xs">
          가입하면 이메일·학년만 수집해요
        </p>

        {isBusy ? (
          <div className="mt-4 flex justify-center">
            <Spinner label="처리 중" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
