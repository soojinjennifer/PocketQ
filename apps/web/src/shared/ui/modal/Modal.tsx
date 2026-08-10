import { useEffect, useRef } from "react";
import emailIcon from "../../../assets/icons/email.svg";

type ModalIcon = "check" | "email" | "error";

interface ModalProps {
  icon: ModalIcon;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}

/**
 * Figma `Popup` 컴포넌트(node `97:363`/`97:377`/`98:203`) 실측 스타일.
 * 로그인/회원가입 등 여러 화면에서 재사용하는 범용 알림 팝업이다.
 * 콘텐츠는 모두 props로 주입하며, 하단 버튼 클릭만이 유일한 닫기/진행 경로다.
 *
 * 접근성: `icon="error"`는 스크린리더에 즉시 통지되어야 하는 오류 상황이므로
 * `role="alertdialog"` + `aria-live="assertive"`를 사용하고, 그 외(check/email)는
 * 일반 `role="dialog"`를 사용한다. 마운트 시 하단 액션 버튼으로 포커스를 이동시켜
 * 키보드/스크린리더 사용자가 즉시 다음 동작을 취할 수 있게 한다.
 */
export function Modal({ icon, title, description, actionLabel, onAction }: ModalProps) {
  const actionButtonRef = useRef<HTMLButtonElement>(null);
  const isError = icon === "error";

  useEffect(() => {
    actionButtonRef.current?.focus();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        role={isError ? "alertdialog" : "dialog"}
        aria-modal="true"
        aria-live={isError ? "assertive" : undefined}
        className="bg-bg-canvas border-modal-border w-[342px] overflow-hidden rounded-[28px] border shadow-[0px_6px_0px_0px_rgba(35,43,56,0.22),0px_18px_32px_0px_rgba(35,43,56,0.21),0px_34px_56px_0px_rgba(35,43,56,0.11)]"
      >
        <div className="flex flex-col items-center gap-3 px-6 pt-8 pb-6">
          <div
            className={`flex size-14 items-center justify-center rounded-full shadow-[0px_3px_0px_rgba(35,43,56,0.21),0px_8px_8px_rgba(35,43,56,0.14),0px_20px_17px_rgba(35,43,56,0.08)] ${icon === "error" ? "bg-accent-orange" : "bg-brand"}`}
          >
            {icon === "check" ? (
              <span className="text-2xl font-bold text-white">✓</span>
            ) : icon === "error" ? (
              <span className="text-2xl font-bold text-white">!</span>
            ) : (
              <img src={emailIcon} className="size-[19px]" alt="" />
            )}
          </div>
          <h2 className="text-label-primary text-center text-[19px] font-bold">{title}</h2>
          <p className="text-modal-subtitle text-center text-sm">{description}</p>
        </div>
        <div className="bg-modal-divider h-px" />
        <button
          ref={actionButtonRef}
          type="button"
          onClick={onAction}
          className="text-brand-deep w-full py-[15px] text-center text-[17px] font-semibold"
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
}
