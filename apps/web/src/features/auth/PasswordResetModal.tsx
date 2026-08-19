import { useEffect, useRef, useState, type FormEvent } from "react";
import { InputGroup } from "../../shared/ui/input/Input";
import { TEXT_LINK_STYLE } from "../../shared/ui/text-link/textLinkStyle";

interface PasswordResetCodePhaseProps {
  phase: "code";
  /** 인증 코드를 받은 이메일 주소. 부제에 노출해 어느 이메일로 온 코드인지 알려준다. */
  email: string;
  /** 8자리 코드 검증 처리. 실패 시 `{ error }`로 메시지를 돌려주면 팝업 안에 표시하고 닫지 않는다. */
  onVerifyCode: (code: string) => Promise<{ error: string | null }>;
  /** "코드 다시 받기" 클릭 시 재설정 메일(코드)을 재발송한다. */
  onResend: () => Promise<{ error: string | null }>;
  /** "로그인 화면으로 돌아가기" 클릭 시 호출한다. 이 단계에는 아직 recovery 세션이 없으므로
   *  호출부는 signOut()을 호출하지 않는다. */
  onCancel: () => void;
}

interface PasswordResetPasswordPhaseProps {
  phase: "password";
  /** 새 비밀번호를 설정 중인 계정의 이메일 주소. 부제에 노출한다. */
  email: string;
  /** 새 비밀번호 제출 처리. 실패 시 `{ error }`로 메시지를 돌려주면 팝업 안에 표시하고 닫지 않는다. */
  onSubmitPassword: (newPassword: string) => Promise<{ error: string | null }>;
  /** "로그인 화면으로 돌아가기" 클릭 시 호출한다(recovery 세션 종료). 이 팝업의 유일한 탈출 경로다
   *  (design-agent 사후검수 Major 지적, 2026-08-18) — 만료된 링크를 다시 열거나 다른 탭에서
   *  재진입하는 등 recovery 세션이 의도치 않게 남아있으면, 이 경로가 없을 때 제출 성공(또는
   *  새로고침)만이 유일한 탈출구가 되어 사용자가 정상 로그인 화면으로 돌아갈 수 없게 된다. */
  onCancel: () => void;
}

type PasswordResetModalProps = PasswordResetCodePhaseProps | PasswordResetPasswordPhaseProps;

/**
 * AUTH-10 — 비밀번호 재설정 흐름을 2단계로 표시하는 팝업.
 *
 * `phase="code"`: 재설정 메일로 발송된 8자리 인증 코드를 입력받아 검증한다(로그인 화면 위에 표시,
 * 아직 recovery 세션 없음). 검증 성공 시 Supabase가 recovery 세션을 발급하고 호출부가
 * `phase="password"` 인스턴스로 교체한다.
 * `phase="password"`: recovery 세션 상태에서 새 비밀번호를 입력받는다.
 *
 * 오버레이/카드 컨테이너는 공용 `shared/ui/modal/Modal`과 동일한 토큰 클래스를 사용해 시각적으로 일치시킨다
 * (`Modal`은 본문이 텍스트로 고정된 알림 전용이라 입력 폼을 담을 수 없어 별도 컴포넌트로 둔다).
 * 배경 클릭/Esc로는 닫히지 않는다(`Modal`과 동일 관례) — 대신 하단에 "로그인 화면으로 돌아가기"
 * 텍스트 링크를 둬서 제출 없이도 나갈 수 있게 한다.
 */
export function PasswordResetModal(props: PasswordResetModalProps) {
  const { phase, email, onCancel } = props;

  const codeFieldRef = useRef<HTMLDivElement>(null);
  const newPasswordFieldRef = useRef<HTMLDivElement>(null);

  const [code, setCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    if (phase === "code") {
      codeFieldRef.current?.querySelector("input")?.focus();
    } else {
      newPasswordFieldRef.current?.querySelector("input")?.focus();
    }
  }, [phase]);

  const handleVerifyCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (phase !== "code") return;
    setCodeError(null);
    setIsVerifying(true);
    const result = await props.onVerifyCode(code);
    setIsVerifying(false);
    if (result.error) {
      setCodeError(result.error);
    }
  };

  const handleResend = async () => {
    if (phase !== "code") return;
    setCodeError(null);
    setIsResending(true);
    const result = await props.onResend();
    setIsResending(false);
    if (result.error) {
      setCodeError(result.error);
    }
  };

  const handleSubmitPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (phase !== "password") return;
    setPasswordError(null);
    if (newPassword !== confirmPassword) {
      setPasswordError("비밀번호가 일치하지 않습니다");
      return;
    }
    setIsSubmitting(true);
    const result = await props.onSubmitPassword(newPassword);
    setIsSubmitting(false);
    if (result.error) {
      setPasswordError(result.error);
    }
  };

  const dialogLabel = phase === "code" ? "인증 코드 입력" : "새 비밀번호 설정";
  const isBusy = phase === "code" ? isVerifying || isResending : isSubmitting;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={dialogLabel}
        className="bg-bg-canvas border-modal-border w-[342px] overflow-hidden rounded-[28px] border shadow-[0px_6px_0px_0px_rgba(35,43,56,0.22),0px_18px_32px_0px_rgba(35,43,56,0.21),0px_34px_56px_0px_rgba(35,43,56,0.11)]"
      >
        {phase === "code" ? (
          <form onSubmit={(event) => void handleVerifyCode(event)} noValidate>
            <div className="flex flex-col gap-3 px-6 pt-8 pb-6">
              <h2 className="text-label-primary text-center text-[19px] font-bold">인증 코드 입력</h2>
              <p className="text-modal-subtitle text-center text-sm">
                {email}로 보낸 인증 코드를 입력해 주세요
              </p>

              <div ref={codeFieldRef}>
                <InputGroup
                  fields={[
                    {
                      name: "reset-code",
                      placeholder: "인증 코드 8자리 입력",
                      value: code,
                      onChange: setCode,
                      inputMode: "numeric",
                      maxLength: 8,
                    },
                  ]}
                />
              </div>

              <div role="alert" aria-live="polite" className="min-h-5 text-sm">
                {codeError ? <span className="text-accent-orange">{codeError}</span> : null}
              </div>

              <div className="flex justify-center">
                <button
                  type="button"
                  disabled={isResending}
                  onClick={() => void handleResend()}
                  className={`${TEXT_LINK_STYLE} px-2 py-3`}
                >
                  코드 다시 받기
                </button>
              </div>
            </div>
            <div className="bg-modal-divider h-px" />
            <button
              type="submit"
              disabled={isVerifying}
              className="text-brand-deep outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 w-full py-[15px] text-center text-[17px] font-semibold disabled:opacity-50"
            >
              확인
            </button>
          </form>
        ) : (
          <form onSubmit={(event) => void handleSubmitPassword(event)} noValidate>
            <div className="flex flex-col gap-3 px-6 pt-8 pb-6">
              <h2 className="text-label-primary text-center text-[19px] font-bold">새 비밀번호 설정</h2>
              <p className="text-modal-subtitle text-center text-sm">
                {email}의 새 비밀번호를 설정해 주세요
              </p>

              <div ref={newPasswordFieldRef}>
                <InputGroup
                  fields={[
                    {
                      name: "new-password",
                      type: "password",
                      placeholder: "새 비밀번호",
                      value: newPassword,
                      onChange: setNewPassword,
                      autoComplete: "new-password",
                    },
                    {
                      name: "confirm-password",
                      type: "password",
                      placeholder: "비밀번호 확인",
                      value: confirmPassword,
                      onChange: setConfirmPassword,
                      autoComplete: "new-password",
                    },
                  ]}
                />
              </div>

              <div role="alert" aria-live="polite" className="min-h-5 text-sm">
                {passwordError ? <span className="text-accent-orange">{passwordError}</span> : null}
              </div>
            </div>
            <div className="bg-modal-divider h-px" />
            <button
              type="submit"
              disabled={isSubmitting}
              className="text-brand-deep outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 w-full py-[15px] text-center text-[17px] font-semibold disabled:opacity-50"
            >
              비밀번호 변경하기
            </button>
          </form>
        )}
        <div className="bg-modal-divider h-px" />
        <button
          type="button"
          disabled={isBusy}
          onClick={onCancel}
          className="text-label-secondary outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 w-full py-[15px] text-center text-[15px] font-semibold disabled:opacity-50"
        >
          로그인 화면으로 돌아가기
        </button>
      </div>
    </div>
  );
}
