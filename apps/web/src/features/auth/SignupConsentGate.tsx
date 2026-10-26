import { useEffect, useId, useRef } from "react";
import { Button } from "../../shared/ui/button/Button";
import { CenteredScreen } from "../../shared/ui/centered-screen/CenteredScreen";
import { Logo } from "../../shared/ui/logo/Logo";
import { Modal } from "../../shared/ui/modal/Modal";
import { Spinner } from "../../shared/ui/spinner/Spinner";
import { TEXT_LINK_STYLE } from "../../shared/ui/text-link/textLinkStyle";
import { ConsentChecklist } from "./ConsentChecklist";
import { useAuthActions } from "./useAuthActions";
import { useSignupConsent } from "./useSignupConsent";

/** 보조 링크 2개("만 14세 미만이에요", "다른 계정으로 로그인")가 공유하는 44pt 텍스트 버튼. */
const SECONDARY_LINK_STYLE = `${TEXT_LINK_STYLE} inline-flex min-h-11 items-center`;

interface SignupConsentGateProps {
  /** 저장 응답으로 동의가 확인되면 호출한다(R5). `ProtectedRoute`가 같은 경로에서 원래 화면을 렌더한다. */
  onConsented: (userId: string) => void;
}

/**
 * 가입 동의 게이트(Gate A, PRD AUTH-11, `docs/SIGNUP_CONSENT_DESIGN.md` §2).
 * `ProtectedRoute`가 인증됐지만 동의 기록이 없는 사용자에게 원래 화면 대신 렌더한다. 경로 이동은 없다.
 *
 * Figma 프레임이 없는 임시 화면이다(D7, C-8). 값은 Grade Setup·Register·Popup 실측과 기존 공용
 * 컴포넌트에서만 가져왔다.
 */
export function SignupConsentGate({ onConsented }: SignupConsentGateProps) {
  const {
    consent,
    setConsent,
    isComplete,
    isSubmitting,
    isBusy,
    errorMessage,
    submit,
    isUnderAgeModalOpen,
    openUnderAgeModal,
    closeUnderAgeModal,
    leaveAsUnderAge,
  } = useSignupConsent({ onConsented });
  const { signOut } = useAuthActions();
  const hintId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const underAgeButtonRef = useRef<HTMLButtonElement>(null);
  const wasModalOpenRef = useRef(false);

  // A-1: 경로 이동 없이 내용이 바뀌므로, 스크린리더가 화면 전환을 알 수 있게 제목으로 포커스를 옮긴다.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  // 팝업이 닫히면(취소·삭제 실패·409) 팝업을 연 "만 14세 미만이에요"로 포커스를 돌려준다(§5 P2).
  useEffect(() => {
    if (wasModalOpenRef.current && !isUnderAgeModalOpen) {
      underAgeButtonRef.current?.focus();
    }
    wasModalOpenRef.current = isUnderAgeModalOpen;
  }, [isUnderAgeModalOpen]);

  return (
    <CenteredScreen>
      <div className="flex flex-col items-center gap-3 text-center">
        <Logo size="large" />
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-label-primary text-[28px] leading-[34px] font-bold outline-none"
        >
          시작하기 전에 확인해 주세요
        </h1>
        <p className="text-label-secondary text-[16px] leading-[21px]">
          수풀잉을 이용하려면 아래 내용에 동의해 주세요
        </p>
      </div>

      <div className="flex w-full max-w-sm flex-col gap-3">
        <ConsentChecklist value={consent} onChange={setConsent} disabled={isBusy} hintId={hintId} />

        <div role="alert" aria-live="polite" className="min-h-5 text-sm">
          {errorMessage ? <span className="text-accent-orange">{errorMessage}</span> : null}
        </div>

        <Button
          type="button"
          variant="primary"
          disabled={isBusy || !isComplete}
          aria-busy={isSubmitting}
          aria-describedby={isComplete ? undefined : hintId}
          onClick={() => void submit()}
        >
          동의하고 시작하기
        </Button>

        <div className="flex justify-center gap-[23px]">
          <button
            ref={underAgeButtonRef}
            type="button"
            className={SECONDARY_LINK_STYLE}
            disabled={isBusy}
            onClick={openUnderAgeModal}
          >
            만 14세 미만이에요
          </button>
          <button
            type="button"
            className={SECONDARY_LINK_STYLE}
            disabled={isBusy}
            onClick={() => void signOut()}
          >
            다른 계정으로 로그인
          </button>
        </div>

        {isBusy ? (
          <div className="flex justify-center">
            <Spinner label="처리 중" />
          </div>
        ) : null}
      </div>

      {isUnderAgeModalOpen ? (
        <Modal
          icon="error"
          title="만 14세 미만은 정식 서비스 때 이용할 수 있어요"
          description="보호자 동의 절차를 준비하고 있어요. 지금 만든 계정과 기록은 삭제할 수 있어요."
          actionLabel="삭제하고 나가기"
          onAction={() => void leaveAsUnderAge()}
          cancelLabel="취소"
          onCancel={closeUnderAgeModal}
          initialFocus="cancel"
        />
      ) : null}
    </CenteredScreen>
  );
}
