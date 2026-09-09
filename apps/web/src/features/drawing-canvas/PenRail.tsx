import type { ReactNode } from "react";
import { useNavigate } from "react-router";
import type { DrawingTool } from "../../shared/lib/canvas/useDrawingStrokes";

interface PenRailProps {
  activeTool: DrawingTool;
  onSelectTool: (tool: DrawingTool) => void;
  onUndo: () => void;
  onClear: () => void;
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
 * "새로고침"(Figma 슬롯명 `Back`)은 직전 획 1개만 되돌리는 `onUndo`를, "취소"(Figma 슬롯명 `Cancelall`)는
 * 전체 삭제하는 `onClear`를 호출한다. PenRail 자체는 필기 상태를 갖지 않는다(상위 페이지가 소유).
 * "사진" 항목만 `/camera`로 이동시킨다.
 */
export function PenRail({
  activeTool,
  onSelectTool,
  onUndo,
  onClear,
  positioned = true,
}: PenRailProps) {
  const navigate = useNavigate();

  const containerClassName = positioned
    ? "border-glass-border bg-glass-fill absolute top-1/2 left-5 z-10 flex w-[52px] -translate-y-1/2 flex-col items-center gap-3 rounded-full border py-4 drop-shadow-[0px_7px_6.5px_rgba(35,43,56,0.11),0px_2px_0px_rgba(35,43,56,0.18)]"
    : "border-glass-border bg-glass-fill flex w-[52px] flex-col items-center gap-3 rounded-full border py-4 drop-shadow-[0px_7px_6.5px_rgba(35,43,56,0.11),0px_2px_0px_rgba(35,43,56,0.18)]";

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
      <PenRailIcon label="새로고침" onClick={onUndo}>
        <RefreshGlyph />
      </PenRailIcon>
      <PenRailIcon label="취소" onClick={onClear}>
        <CancelGlyph />
      </PenRailIcon>
      <div className="bg-separator h-px w-7" />
      <button
        type="button"
        onClick={() => void navigate("/camera")}
        className="text-label-secondary text-[12px] font-semibold"
      >
        사진
      </button>
    </div>
  );
}

interface PenRailIconProps {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}

/** 개별 도구 버튼 — "펜"/"지우개"만 `active` 배경을 가질 수 있다(현재 선택된 도구 표시). */
function PenRailIcon({ label, active, onClick, children }: PenRailIconProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      onClick={onClick}
      className={
        active
          ? "bg-fill-tint-brand text-label-primary flex size-9 items-center justify-center rounded-full"
          : "text-label-primary flex size-9 items-center justify-center rounded-full"
      }
    >
      {children}
    </button>
  );
}

/**
 * Figma `Icon/Edit`(42:139)/`Icon/Erase`(42:141)/`Icon/Refresh`(42:138) 실제 벡터 경로,
 * `Icon/Cancel`(42:140)은 텍스트 글리프("✕")를 그대로 사용한다. 색상은 원본 fill(#8A8A8E,
 * 기존 `--color-icon-default` 토큰과 동일값)을 하드코딩하지 않고 `currentColor`로 상속한다.
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

function CancelGlyph() {
  return (
    <span className="text-[15px] leading-[20px] font-[590]" aria-hidden="true">
      ✕
    </span>
  );
}
