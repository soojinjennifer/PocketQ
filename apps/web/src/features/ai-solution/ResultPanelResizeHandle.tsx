export type ResultPanelWidth = "default" | "extend" | "close";

interface ResultPanelResizeHandleProps {
  width: ResultPanelWidth;
  onExtend: () => void;
  onBackToDefault: () => void;
  onClose: () => void;
  onOpen: () => void;
}

/**
 * `/solve/landscape` Result Panel 좌측에 튀어나온 드래그 핸들(Figma 컴포넌트 갤러리 `174:639` 근방,
 * `Width=Default`(`174:638`)/`Width=Extend`(`174:640`)/`Width=Close`(`174:743`)). 폭이
 * 다른 3가지 패널 상태에서도 핸들 자체는 항상 같은 크기(24×88px)·같은 위치(패널 세로 중앙,
 * 좌측 모서리 바깥)를 유지하며, 위/아래 아이콘 버튼 2개로 상태를 전환한다.
 *
 * 아이콘은 정확한 Figma 벡터 대신 의미가 통하는 인라인 SVG로 구성한다(`PenRail.tsx`의
 * `PenGlyph`/`EraseGlyph` 등과 동일 패턴 — `currentColor` 상속 + `text-icon-default`).
 * - 위쪽 버튼: `Default`/`Close`에서는 "막대+좌측화살표"(Extend로 전환), `Extend`에서는
 *   좌우 반전된 "우측화살표+막대"(Default로 되돌림) — 같은 `BarArrowIcon`을 `flip`으로 재사용한다.
 * - 아래쪽 버튼: `Default`/`Extend`에서는 우측 쉐브런 `>`(Close로 전환), `Close`에서는 180도
 *   회전한 좌측 쉐브런 `<`(Default로 되돌림) — 같은 `ChevronIcon`을 `open`으로 재사용한다.
 */
export function ResultPanelResizeHandle({
  width,
  onExtend,
  onBackToDefault,
  onClose,
  onOpen,
}: ResultPanelResizeHandleProps) {
  const topAction =
    width === "extend"
      ? { label: "기본 크기로 되돌리기", onClick: onBackToDefault, icon: <BarArrowIcon flip /> }
      : { label: "넓게 보기", onClick: onExtend, icon: <BarArrowIcon /> };
  const bottomAction =
    width === "close"
      ? { label: "패널 열기", onClick: onOpen, icon: <ChevronIcon open /> }
      : { label: "패널 접기", onClick: onClose, icon: <ChevronIcon /> };

  return (
    <div className="bg-glass-fill border-glass-border pointer-events-auto absolute top-1/2 -left-6 z-10 flex h-[88px] w-6 -translate-y-1/2 flex-col items-stretch overflow-hidden rounded-l-[8px] border shadow-[0px_4px_0px_rgba(35,43,56,0.21),0px_13px_24px_rgba(35,43,56,0.18),0px_25px_45px_rgba(35,43,56,0.1),inset_0px_2px_0px_rgba(255,255,255,0.9),inset_0px_-2px_0px_rgba(35,43,56,0.07)]">
      <button
        type="button"
        aria-label={topAction.label}
        title={topAction.label}
        onClick={topAction.onClick}
        className="text-icon-default flex flex-1 items-center justify-center"
      >
        {topAction.icon}
      </button>
      <button
        type="button"
        aria-label={bottomAction.label}
        title={bottomAction.label}
        onClick={bottomAction.onClick}
        className="text-icon-default flex flex-1 items-center justify-center"
      >
        {bottomAction.icon}
      </button>
    </div>
  );
}

interface BarArrowIconProps {
  flip?: boolean;
}

/** 막대+화살표 아이콘. 기본은 "막대(우)+좌측화살표"(Extend), `flip`이면 좌우 반전되어 "우측화살표+막대(좌)"(Back to default)가 된다. */
function BarArrowIcon({ flip }: BarArrowIconProps) {
  return (
    <svg
      viewBox="0 0 14 14"
      fill="none"
      className={flip ? "size-[14px] -scale-x-100" : "size-[14px]"}
      aria-hidden="true"
    >
      <path
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11.5 2V12"
      />
      <path
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.5 7H2.5M5 4L2.5 7L5 10"
      />
    </svg>
  );
}

interface ChevronIconProps {
  open?: boolean;
}

/** 쉐브런 아이콘. 기본은 우측 쉐브런 `>`(Close), `open`이면 180도 회전되어 좌측 쉐브런 `<`(Open)이 된다. */
function ChevronIcon({ open }: ChevronIconProps) {
  return (
    <svg
      viewBox="0 0 14 14"
      fill="none"
      className={open ? "size-[12px] rotate-180" : "size-[12px]"}
      aria-hidden="true"
    >
      <path
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 3L9.5 7L5 11"
      />
    </svg>
  );
}
