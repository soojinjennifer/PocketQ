import { useEffect, useRef, type ReactNode } from "react";
import emailIcon from "../../../assets/icons/email.svg";

type ModalIcon = "check" | "email" | "error";

interface ModalProps {
  /** `content`가 제공되면 아이콘 원은 렌더링되지 않으므로 이 경우 생략할 수 있다. */
  icon?: ModalIcon;
  title: string;
  /** `content`가 제공되면 무시된다(둘 중 하나만 사용). */
  description?: string;
  /** 제공되면 아이콘 원 + `description` 대신 이 콘텐츠를 제목 아래에 렌더링한다(예: 인식된 문제
   *  미리보기 카드). `RecognizedProblemPopup` 전용으로 추가된 슬롯 — 기존 icon/description
   *  사용처는 이 prop을 전달하지 않으므로 동작이 그대로 유지된다. */
  content?: ReactNode;
  /** `true`면 카드 폭을 `w-[690px]`(최대 `calc(100%-3rem)`)로 넓히고 이너 링 그림자를 추가한다.
   *  기본값 `false` — 기존 8곳 이상의 사용처는 이 prop을 전달하지 않아 기존 `w-[342px]` 레이아웃과
   *  그림자가 픽셀 단위로 그대로 유지된다. */
  wide?: boolean;
  actionLabel: string;
  onAction: () => void;
  /** 취소 버튼 라벨. `onCancel`과 함께 제공될 때만 2버튼(확인/취소) 레이아웃으로 전환된다. */
  cancelLabel?: string;
  /** 취소 버튼 클릭 핸들러. `cancelLabel`과 함께 제공될 때만 2버튼(확인/취소) 레이아웃으로 전환된다. */
  onCancel?: () => void;
}

/**
 * Figma `Popup` 컴포넌트(node `97:363`/`97:377`/`98:203`) 실측 스타일.
 * 로그인/회원가입 등 여러 화면에서 재사용하는 범용 알림 팝업이다.
 * 콘텐츠는 모두 props로 주입하며, 하단 버튼 클릭만이 유일한 닫기/진행 경로다.
 *
 * `cancelLabel`/`onCancel`을 모두 전달하면 확인/취소 2버튼 레이아웃으로 렌더링된다
 * (Figma 대응 없는 임시 조치, `docs/COMPONENT_MAP.md` 참고). 둘 중 하나라도 없으면
 * 기존과 동일한 단일 버튼 레이아웃을 유지한다.
 *
 * 접근성: `icon="error"`는 스크린리더에 즉시 통지되어야 하는 오류 상황이므로
 * `role="alertdialog"` + `aria-live="assertive"`를 사용하고, 그 외(check/email)는
 * 일반 `role="dialog"`를 사용한다. 마운트 시 하단 주 액션(확인) 버튼으로 포커스를 이동시켜
 * 키보드/스크린리더 사용자가 즉시 다음 동작을 취할 수 있게 한다.
 */
export function Modal({
  icon,
  title,
  description,
  content,
  wide = false,
  actionLabel,
  onAction,
  cancelLabel,
  onCancel,
}: ModalProps) {
  const actionButtonRef = useRef<HTMLButtonElement>(null);
  const isError = icon === "error";
  const hasCancel = cancelLabel !== undefined && onCancel !== undefined;

  useEffect(() => {
    actionButtonRef.current?.focus();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        role={isError ? "alertdialog" : "dialog"}
        aria-modal="true"
        aria-live={isError ? "assertive" : undefined}
        className={
          wide
            ? "bg-bg-canvas border-modal-border w-[690px] max-w-[calc(100%-3rem)] overflow-hidden rounded-[28px] border shadow-[0px_6px_0px_0px_rgba(35,43,56,0.22),0px_18px_32px_0px_rgba(35,43,56,0.21),0px_34px_56px_0px_rgba(35,43,56,0.11),inset_0px_2px_0px_1px_rgba(255,255,255,0.9),inset_0px_-2px_0px_1px_rgba(35,43,56,0.07)]"
            : "bg-bg-canvas border-modal-border w-[342px] overflow-hidden rounded-[28px] border shadow-[0px_6px_0px_0px_rgba(35,43,56,0.22),0px_18px_32px_0px_rgba(35,43,56,0.21),0px_34px_56px_0px_rgba(35,43,56,0.11)]"
        }
      >
        <div className="flex flex-col items-center gap-3 px-6 pt-8 pb-6">
          {content ? null : (
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
          )}
          <h2 className="text-label-primary text-center text-[19px] font-bold">{title}</h2>
          {content ?? <p className="text-modal-subtitle text-center text-sm">{description}</p>}
        </div>
        <div className="bg-modal-divider h-px" />
        {hasCancel ? (
          <div className="flex">
            <button
              ref={actionButtonRef}
              type="button"
              onClick={onAction}
              className="text-brand-deep outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 flex-1 py-[15px] text-center text-[17px] font-semibold"
            >
              {actionLabel}
            </button>
            <div className="bg-modal-divider w-px self-stretch" />
            <button
              type="button"
              onClick={onCancel}
              className="text-modal-subtitle outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 flex-1 py-[15px] text-center text-[17px] font-semibold"
            >
              {cancelLabel}
            </button>
          </div>
        ) : (
          <button
            ref={actionButtonRef}
            type="button"
            onClick={onAction}
            className="text-brand-deep outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 w-full py-[15px] text-center text-[17px] font-semibold"
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
