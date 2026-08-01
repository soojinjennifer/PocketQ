import emailIcon from "../../../assets/icons/email.svg";

type ModalIcon = "check" | "email";

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
 */
export function Modal({ icon, title, description, actionLabel, onAction }: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-bg-canvas border-modal-border w-[342px] overflow-hidden rounded-[28px] border shadow-[0px_6px_0px_0px_rgba(35,43,56,0.22),0px_18px_32px_0px_rgba(35,43,56,0.21),0px_34px_56px_0px_rgba(35,43,56,0.11)]">
        <div className="flex flex-col items-center gap-3 px-6 pt-8 pb-6">
          <div className="bg-brand flex size-14 items-center justify-center rounded-full shadow-[0px_3px_0px_rgba(35,43,56,0.21),0px_8px_8px_rgba(35,43,56,0.14),0px_20px_17px_rgba(35,43,56,0.08)]">
            {icon === "check" ? (
              <span className="text-2xl font-bold text-white">✓</span>
            ) : (
              <img src={emailIcon} className="size-[19px]" alt="" />
            )}
          </div>
          <h2 className="text-label-primary text-center text-[19px] font-bold">{title}</h2>
          <p className="text-modal-subtitle text-center text-sm">{description}</p>
        </div>
        <div className="bg-modal-divider h-px" />
        <button
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
