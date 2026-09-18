import type { ReactNode } from "react";
import type { DrawingTool } from "../../shared/lib/canvas/useDrawingStrokes";

interface PenRailProps {
  activeTool: DrawingTool;
  onSelectTool: (tool: DrawingTool) => void;
  onUndo: () => void;
  /** 오너 UX 결정: Undo로 되돌린 획을 다시 실행한다. */
  onRedo: () => void;
  onClear: () => void;
  /** 되돌릴 획이 있는지 — false면 Undo 버튼을 톤다운(opacity-40)하고 클릭을 무효화한다(오너 UX 결정). */
  canUndo: boolean;
  /** 다시 실행할 획이 있는지 — false면 Redo 버튼을 톤다운(opacity-40)하고 클릭을 무효화한다(오너 UX
   *  결정). 전체 삭제(`onClear`) 직후에는 항상 `false`다(destructive action, redo로 복원 불가). */
  canRedo: boolean;
  /**
   * PenRail 스스로 화면 위치(세로 중앙 고정)를 가질지 여부. 기본값 `true`(기존 동작 유지) —
   * `/solve/pencilcanvas` INPUT 단계, `/solve/landscape` 등 PenRail 단독 배치에는 그대로 둔다.
   * `false`면 위치 클래스(`absolute top-1/2 left-5 z-10 -translate-y-1/2`)만 빠지고 나머지
   * 스타일(배경/보더/그림자/flex 레이아웃/padding)은 그대로 유지된다 — 상위 컴포넌트가 PenRail을
   * SolveScroll 등과 하나의 그룹으로 묶어 직접 배치할 때 쓴다(`SolvePencilcanvasPage` WORK
   * 단계 참고, 오너 iPad 실기기 보고 수정: PenRail 혼자만 화면 중앙에 오고 SolveScroll이 그 아래로
   * 늘어져 잘리는 문제).
   */
  positioned?: boolean;
}

/**
 * Figma `Pen Rail`(node `42:159`) — `/solve/pencilcanvas`, `/solve/landscape` 좌측 필기 도구 레일.
 * 펜/지우개는 `activeTool`과 비교해 활성 배경(`bg-fill-tint-brand`)을 표시하고 `onSelectTool`을 호출한다.
 * 순서(위→아래): 펜 → 지우개 → 구분선 → Undo → Redo → 구분선 → 전체삭제(오너 UX 결정 재구성 —
 * 이전엔 펜/지우개/구분선/새로고침(Undo)/구분선/취소(전체삭제)/구분선/사진 순서였고 카메라 진입
 * 버튼("사진")이 이 컴포넌트 안에 있었다. 카메라 버튼은 `CameraRailButton`으로 완전히 분리됐다 —
 * 이 컴포넌트는 더 이상 `/camera` 이동 로직을 갖지 않는다).
 *
 * "새로고침"(Figma 슬롯명 `Back`)은 직전 획 1개만 되돌리는 `onUndo`를 호출한다. Figma(`42:158`)
 * 실측 기준 Undo는 `RefreshGlyph`를 좌우 반전(`-scale-x-100`)한 아이콘을 쓰고, Redo는 별도
 * 아이콘을 새로 그리지 않고 동일한 `RefreshGlyph`를 원본 그대로 재사용한다. Undo/Redo 두 버튼은
 * Figma에서 gap 없이 맞붙어 있어(`324:343`) 다른 형제 버튼과 달리 자체 서브 그룹(`flex flex-col
 * items-center`, gap 없음)으로 묶어 컨테이너의 균일 `gap-1.5`가 이 둘 사이에는 적용되지 않게 한다.
 * `canUndo`/`canRedo`가 `false`면 해당 버튼을 톤다운(opacity-40)하고 `disabled` 처리해 클릭이
 * 무효화된다(오너 UX 결정).
 *
 * "전체 삭제"(Figma 슬롯명 `Cancelall`)는 기존 "✕" 단일 글리프 대신 2줄 텍스트("전체"/"삭제")로
 * 바뀌었다 — `onClear`를 호출하는 것은 동일하다.
 */
export function PenRail({
  activeTool,
  onSelectTool,
  onUndo,
  onRedo,
  onClear,
  canUndo,
  canRedo,
  positioned = true,
}: PenRailProps) {
  const containerClassName =
    (positioned
      ? "border-separator bg-glass-fill absolute top-1/2 left-5 z-10 flex w-[52px] -translate-y-1/2 flex-col items-center gap-1.5 rounded-full border py-2.5"
      : "border-separator bg-glass-fill flex w-[52px] flex-col items-center gap-1.5 rounded-full border py-2.5") +
    " drop-shadow-[0px_3px_0px_rgba(35,43,56,0.21),0px_8px_16px_rgba(35,43,56,0.14),0px_20px_34px_rgba(35,43,56,0.08)] " +
    "shadow-[inset_0px_2px_0px_rgba(255,255,255,0.9),inset_0px_-2px_0px_rgba(35,43,56,0.07)]";

  return (
    <div className={containerClassName}>
      <PenRailIcon label="펜" active={activeTool === "pen"} onClick={() => onSelectTool("pen")}>
        <PenGlyph />
      </PenRailIcon>
      <PenRailIcon
        label="지우개"
        active={activeTool === "eraser"}
        onClick={() => onSelectTool("eraser")}
      >
        <EraseGlyph />
      </PenRailIcon>
      <div className="bg-separator h-px w-7" />
      <div className="flex flex-col items-center">
        <PenRailIcon label="새로고침" onClick={onUndo} disabled={!canUndo}>
          <span className="inline-block -scale-x-100">
            <RefreshGlyph />
          </span>
        </PenRailIcon>
        <PenRailIcon label="다시 실행" onClick={onRedo} disabled={!canRedo}>
          <RefreshGlyph />
        </PenRailIcon>
      </div>
      <div className="bg-separator h-px w-7" />
      <button
        type="button"
        aria-label="전체 삭제"
        onClick={onClear}
        className="text-label-secondary flex flex-col items-center text-[12px] leading-[16px] font-[590]"
      >
        <span>전체</span>
        <span>삭제</span>
      </button>
    </div>
  );
}

interface PenRailIconProps {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
  /** Undo/Redo 톤다운(오너 UX 결정) — `true`면 opacity-40 + 네이티브 `disabled`로 클릭을 무효화한다. */
  disabled?: boolean;
}

/** 개별 도구 버튼 — "펜"/"지우개"만 `active` 배경을 가질 수 있다(현재 선택된 도구 표시). */
function PenRailIcon({ label, active, onClick, children, disabled }: PenRailIconProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={
        (active
          ? "bg-fill-tint-brand text-label-primary flex size-9 items-center justify-center rounded-full"
          : "text-label-primary flex size-9 items-center justify-center rounded-full") +
        (disabled ? " opacity-40" : "")
      }
    >
      {children}
    </button>
  );
}

/**
 * Figma `Icon/Edit`(42:139)/`Icon/Erase`(42:141)/`Icon/Refresh`(42:138) 실제 벡터 경로. 색상은
 * 원본 fill(#8A8A8E, 기존 `--color-icon-default` 토큰과 동일값)을 하드코딩하지 않고
 * `currentColor`로 상속한다. `Icon/Cancel`(42:140, 기존 "✕" 텍스트 글리프)은 전체 삭제 버튼이
 * 2줄 텍스트("전체"/"삭제")로 바뀌면서 더 이상 쓰이지 않는다.
 */
function PenGlyph() {
  return (
    <svg viewBox="0 0 13.5019 13.5" fill="none" className="size-[14px]" aria-hidden="true">
      <path
        fill="currentColor"
        d="M8.295 4.515L8.985 5.205L2.19 12H1.5V11.31L8.295 4.515V4.515ZM10.995 0C10.8075 0 10.6125 0.075 10.47 0.2175L9.0975 1.59L11.91 4.4025L13.2825 3.03C13.575 2.7375 13.575 2.265 13.2825 1.9725L11.5275 0.2175C11.3775 0.0675 11.19 0 10.995 0V0ZM8.295 2.3925L0 10.6875V13.5H2.8125L11.1075 5.205L8.295 2.3925V2.3925Z"
      />
    </svg>
  );
}

function EraseGlyph() {
  return (
    <svg viewBox="0 0 18 18" fill="none" className="size-[18px]" aria-hidden="true">
      <path
        transform="translate(2.57 2.2)"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5.22879 13.4788L1.10379 9.35379C0.828945 9.07339 0.675 8.69642 0.675 8.30379C0.675 7.91116 0.828945 7.53418 1.10379 7.25379L7.25379 1.10379C7.53418 0.828945 7.91116 0.675 8.30379 0.675C8.69642 0.675 9.07339 0.828945 9.35379 1.10379L13.1038 4.85379C13.3786 5.13418 13.5326 5.51116 13.5326 5.90379C13.5326 6.29641 13.3786 6.67339 13.1038 6.95379L8.07879 11.9788"
      />
      <path
        transform="translate(5.25 7.12)"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M0.675 0.675L6.3 6.3"
      />
      <path
        transform="translate(7.12 15)"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M0.675 0.675H8.55"
      />
    </svg>
  );
}

function RefreshGlyph() {
  return (
    <svg viewBox="0 0 11.9925 12" fill="none" className="size-[14px]" aria-hidden="true">
      <path
        fill="currentColor"
        d="M10.23 1.7625C9.1425 0.675 7.65 0 5.9925 0C2.6775 0 0 2.685 0 6C0 9.315 2.6775 12 5.9925 12C8.79 12 11.1225 10.0875 11.79 7.5H10.23C9.615 9.2475 7.95 10.5 5.9925 10.5C3.51 10.5 1.4925 8.4825 1.4925 6C1.4925 3.5175 3.51 1.5 5.9925 1.5C7.2375 1.5 8.3475 2.0175 9.1575 2.835L6.7425 5.25H11.9925V0L10.23 1.7625Z"
      />
    </svg>
  );
}
