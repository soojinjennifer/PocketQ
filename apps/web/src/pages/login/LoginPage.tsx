import type { User } from "@supabase/supabase-js";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { useAuthActions, type OAuthProvider } from "../../features/auth/useAuthActions";
import { PasswordResetModal } from "../../features/auth/PasswordResetModal";
import { getPostAuthDestination } from "../../features/auth/postAuthDestination";
import { useAuth } from "../../features/auth/useAuth";
import { Button } from "../../shared/ui/button/Button";
import { InputGroup } from "../../shared/ui/input/Input";
import { Logo } from "../../shared/ui/logo/Logo";
import { Modal } from "../../shared/ui/modal/Modal";
import { NavTabBar } from "../../shared/ui/nav-tab-bar/NavTabBar";
import { Spinner } from "../../shared/ui/spinner/Spinner";
import { TEXT_LINK_STYLE } from "../../shared/ui/text-link/textLinkStyle";

const NAV_TAB_ITEMS = [
  { id: "register", label: "회원가입" },
  { id: "login", label: "로그인" },
];

type LoginModalState =
  | { kind: "none" }
  | { kind: "success"; user: User }
  | { kind: "invalid-credentials" }
  | { kind: "email-found"; nickname: string | null; email: string }
  | { kind: "email-not-found" }
  | { kind: "otp-code" }
  | { kind: "password-updated"; email: string };

/**
 * 최소 기술 로그인 UI (Figma 최종 디자인 아님).
 * 이메일/비밀번호 필드 2개, 이메일 로그인 제출, Kakao/Google 소셜 로그인,
 * 오류 메시지 영역, 로딩 인디케이터만 구현한다.
 * 이메일 로그인 성공 시에는 즉시 이동하지 않고 완료 팝업을 띄운 뒤,
 * 팝업의 "계속하기" 버튼 클릭 시점에 목적지로 이동한다.
 *
 * 추가로 이메일 찾기(AUTH-9)와 비밀번호 찾기/재설정(AUTH-10) 진입점을 제공한다.
 * 이메일 찾기는 이 기기에 남아있는 세션만 조회하며(서버 조회 없음), 재설정 링크로 복귀한
 * recovery 세션 상태(`isPasswordRecovery`)에서는 이 화면 위에 `PasswordResetModal`을 띄운다.
 */
export function LoginPage() {
  const navigate = useNavigate();
  const {
    signInWithEmail,
    signInWithOAuth,
    signOut,
    findLocalAccount,
    resetPasswordForEmail,
    verifyPasswordResetOtp,
    updatePassword,
  } = useAuthActions();
  const { user, setHoldPublicRedirect, isPasswordRecovery, setIsPasswordRecovery } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingProvider, setPendingProvider] = useState<OAuthProvider | null>(null);
  const [modalState, setModalState] = useState<LoginModalState>({ kind: "none" });
  const [passwordResetEmail, setPasswordResetEmail] = useState<string | null>(null);

  const isBusy =
    isSubmitting || pendingProvider !== null || modalState.kind !== "none" || isPasswordRecovery;

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

  /** AUTH-9 — 이 기기의 세션에서 가입 이메일을 찾아 팝업으로 안내한다(서버 조회 없음). */
  const handleFindEmail = async () => {
    setErrorMessage(null);
    const account = await findLocalAccount();
    if (!account) {
      setModalState({ kind: "email-not-found" });
      return;
    }
    setModalState({ kind: "email-found", nickname: account.nickname, email: account.email });
  };

  /** AUTH-10 — 입력된 이메일로 비밀번호 재설정 인증 코드를 발송하고 코드 입력 팝업으로 전환한다. */
  const handleForgotPassword = async () => {
    setErrorMessage(null);
    if (email.trim().length === 0) {
      setErrorMessage("이메일을 먼저 입력해주세요");
      return;
    }
    setIsSubmitting(true);
    const result = await resetPasswordForEmail(email);
    setIsSubmitting(false);
    if (result.error) {
      setErrorMessage(result.error);
      return;
    }
    setPasswordResetEmail(email);
    setModalState({ kind: "otp-code" });
  };

  /**
   * AUTH-10 — 인증 코드를 검증한다. 성공 시 Supabase가 recovery 세션을 발급하지만
   * (`PASSWORD_RECOVERY` 이벤트로 `AuthProvider`가 이미 `isPasswordRecovery`/`holdPublicRedirect`를
   * 세팅해줄 수도 있으나) 이 훅 호출 경로에서도 명시적으로 세팅해 타이밍 의존 없이 즉시 전환한다.
   * `holdPublicRedirect`를 빠뜨리면 `PublicOnlyRoute`가 recovery 세션을 일반 로그인으로 오인해
   * 로그인 화면을 이탈시킨다.
   */
  const handleVerifyResetCode = async (code: string): Promise<{ error: string | null }> => {
    const result = await verifyPasswordResetOtp(passwordResetEmail ?? "", code);
    if (result.error) {
      // 이메일 존재 여부를 노출하지 않는 일반적인 오류 메시지로 대체한다.
      return { error: "인증 코드가 올바르지 않거나 만료됐어요" };
    }
    setIsPasswordRecovery(true);
    setHoldPublicRedirect(true);
    setModalState({ kind: "none" });
    return { error: null };
  };

  /** AUTH-10 — "코드 다시 받기": 동일 이메일로 재설정 인증 코드를 다시 발송한다. */
  const handleResendCode = async (): Promise<{ error: string | null }> => {
    return resetPasswordForEmail(passwordResetEmail ?? "");
  };

  /**
   * AUTH-10 — 새 비밀번호를 저장한다. 성공 시 recovery 세션을 종료해
   * 인증된 사용자로 취급되지 않게 하고(=로그인 화면 유지) 완료 팝업을 띄운다.
   * signOut()으로 세션이 사라지기 전에 이메일을 미리 캡처해 완료 팝업 확인 시
   * 로그인 화면 이메일 입력란을 채우는 데 사용한다.
   */
  const handlePasswordUpdate = async (newPassword: string) => {
    const recoveredEmail = user?.email ?? passwordResetEmail ?? null;
    const result = await updatePassword(newPassword);
    if (result.error) {
      return result;
    }
    await signOut();
    setModalState({ kind: "password-updated", email: recoveredEmail ?? "" });
    return { error: null };
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

        <div className="flex justify-center gap-[23px]">
          <button
            type="button"
            disabled={isBusy}
            onClick={() => void handleFindEmail()}
            className={TEXT_LINK_STYLE}
          >
            이메일을 잊었어요!
          </button>
          <button
            type="button"
            disabled={isBusy}
            onClick={() => void handleForgotPassword()}
            className={TEXT_LINK_STYLE}
          >
            비밀번호를 잊었어요!
          </button>
        </div>

        <p className="text-label-tertiary text-center text-xs">
          소셜 로그인과 이메일 로그인 모두 가능해요.
        </p>

        {isBusy && modalState.kind === "none" && !isPasswordRecovery ? (
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

      {modalState.kind === "email-found" ? (
        <Modal
          icon="email"
          title="가입하신 이메일을 찾았어요"
          description={`${modalState.nickname ?? "회원"}님, 가입하신 이메일은 ${modalState.email}입니다`}
          actionLabel="이메일 입력하기"
          onAction={() => {
            setEmail(modalState.email);
            setModalState({ kind: "none" });
          }}
        />
      ) : null}

      {modalState.kind === "email-not-found" ? (
        <Modal
          icon="email"
          title="이 기기에서 로그인한 기록이 없어요"
          description="회원가입을 진행하시겠어요?"
          actionLabel="회원가입하기"
          onAction={() => void navigate("/register")}
          cancelLabel="취소"
          onCancel={() => setModalState({ kind: "none" })}
        />
      ) : null}

      {modalState.kind === "password-updated" ? (
        <Modal
          icon="check"
          title="비밀번호가 변경되었습니다"
          description="새 비밀번호로 로그인해 주세요"
          actionLabel="확인"
          onAction={() => {
            const updatedEmail = modalState.email;
            setModalState({ kind: "none" });
            if (updatedEmail) {
              setEmail(updatedEmail);
            }
          }}
        />
      ) : null}

      {modalState.kind === "otp-code" && passwordResetEmail ? (
        <PasswordResetModal
          phase="code"
          email={passwordResetEmail}
          onVerifyCode={handleVerifyResetCode}
          onResend={handleResendCode}
          onCancel={() => {
            setModalState({ kind: "none" });
            setPasswordResetEmail(null);
          }}
        />
      ) : null}

      {isPasswordRecovery ? (
        <PasswordResetModal
          phase="password"
          email={user?.email ?? passwordResetEmail ?? ""}
          onSubmitPassword={handlePasswordUpdate}
          onCancel={() => {
            void signOut();
            setPasswordResetEmail(null);
          }}
        />
      ) : null}
    </div>
  );
}
