import { useId, useRef, useState } from "react";
import { CANVAS_OCCLUDER_PROPS } from "../../shared/lib/canvas/useOccluderMask";
import { ActionMenu, type ActionMenuItem } from "../../shared/ui/action-menu/ActionMenu";

/** INPUT 단계 문제 입력 방식. 사진(촬영/보관함 공통)과 필기 2가지다. */
export type InputMode = "photo" | "handwriting";

/** "사진으로 문제 인식" 메뉴에서 고르는 사진 출처 — 보관함(파일 선택 창) 또는 앱 내 카메라. */
export type PhotoSource = "library" | "camera";

interface InputModeToggleProps {
  mode: InputMode;
  onSelectHandwriting: () => void;
  /** 메뉴 항목 클릭 핸들러 안에서 동기적으로 호출된다(보관함 선택 창은 사용자 제스처 안에서 열어야 한다). */
  onSelectPhotoSource: (source: PhotoSource) => void;
  /** 업로드 처리 중 등 — 두 버튼을 모두 비활성화하고 메뉴도 열지 않는다. */
  disabled?: boolean;
}

/** 공통 세그먼트 라벨 스타일(선택/비선택 공통) — Figma 재실측(2026-09, get_variable_defs raw
 *  Variable "SF Pro/Semibold" 직접 확인): SF Pro Semibold(590) 11px, line-height Auto → 같은
 *  11px 폰트 크기의 기승인 line-height 13px(Caption 2, docs/DESIGN_SYSTEM.md §3) 재사용.
 *  `flex items-center justify-center`는 Figma 원본 reference 코드의 컨테이너 구조를 그대로
 *  반영한 것 — 이게 빠져 있던 게 세로 정렬이 위로 치우쳐 보이던 버그의 실제 원인이었다(block
 *  레이아웃에서 padding-top/bottom이 콘텐츠 오버플로우 시 비대칭으로 깎이는 문제, flexbox는
 *  대칭 분배). 이전 라운드의 "14px Medium"은 Figma MCP 변환기 오차로 확정됨(오너 확인). */
const SEGMENT_BASE_STYLE =
  "flex items-center justify-center px-[18px] py-[8px] text-[11px] leading-[13px] font-[590] whitespace-nowrap";

/**
 * "선택됨" 세그먼트 — `bg-bg-canvas` + `rounded-[6px]` + `Elevation/Chip Raised`(신규,
 * `docs/DESIGN_SYSTEM.md` §4 참고). 라벨 색상은 `text-icon-default`(기존 토큰, `#8a8a8e`).
 * `h-[26px]`는 Figma 실측값 — 선택된 pill 자체에 명시적 `height: 26px`가 박혀 있으며 컨테이너
 * 패딩에서 파생되는 값이 아니다(오너 확인, 2026-09). 미선택 세그먼트는 이 고정 높이를 갖지 않는다.
 */
const SELECTED_SEGMENT_STYLE =
  "bg-bg-canvas text-icon-default h-[26px] rounded-[6px] " +
  "drop-shadow-[0px_20px_17px_rgba(35,43,56,0.08),0px_8px_8px_rgba(35,43,56,0.14)]";

/** "선택안됨" 세그먼트 — 배경 없이 완전 라운드, 라벨은 `text-label-secondary`(기존 토큰). */
const UNSELECTED_SEGMENT_STYLE = "text-label-secondary rounded-[999px]";

/**
 * 세그먼트 사이 세로 구분선(Figma 실측: 높이 17px, 두께 1px, `#6FA898` = `accent-green` 토큰).
 * 폭 0 슬롯 안에 1px 선을 absolute로 두어 컨테이너 총 폭에 기여하지 않게 한다.
 */
function SegmentDivider() {
  return (
    <span aria-hidden="true" data-testid="input-mode-divider" className="relative h-[17px] w-0">
      <span className="bg-accent-green absolute inset-y-0 left-0 w-px" />
    </span>
  );
}

function segmentClassName(isSelected: boolean) {
  return `${SEGMENT_BASE_STYLE} ${isSelected ? SELECTED_SEGMENT_STYLE : UNSELECTED_SEGMENT_STYLE}`;
}

/**
 * Figma `Input Mode Toggle`(node `342-833`, fileKey `ltyPrCk8UT8DsB3tFuw7Sr`) —
 * `/solve/pencilcanvas` INPUT 단계 전용 [필기로 문제 인식 | 사진으로 문제 인식] 2분할 세그먼트
 * 토글(왼쪽 필기, 오른쪽 사진 — Figma `342:833` 실측과 오너 원 요청 순서. 2026-10 오너 결정: 기존
 * "카메라로 문제인식"/"사진 업로드" 2개 탭을 "사진으로 문제 인식" 1개로 합쳤다). NavTabBar 바로 아래 화면 상단 중앙에 배치된다(배치는 이 컴포넌트를 쓰는 페이지가 담당한다).
 *
 * "사진으로 문제 인식"은 모드를 바꾸지 않고 앱 자체 메뉴(`ActionMenu`, [사진 보관함] [사진 찍기])만
 * 연다 — 항목을 고르면 `onSelectPhotoSource("library" | "camera")`를 호출한다. 실제 모드 전환/라우팅/
 * 파일 선택 창 열기는 상위(`SolvePencilcanvasPage`)가 담당한다. 이 컴포넌트는 메뉴 열림 상태만
 * 소유하고 라우팅/파일 로직은 갖지 않는다.
 *
 * 컨테이너는 `bg-fill-tint-green`(기존 토큰) 배경 위에 `Elevation/Well Inset`(`docs/DESIGN_SYSTEM.md`
 * §4)을 적용해 "홈(well)"처럼 보이게 하고, 선택된 세그먼트만 `Elevation/Chip Raised` 그림자를 얹는다.
 *
 * 접근성: 선택 상태는 이 프로젝트 기존 관례(`PenRail.tsx`)대로 `aria-pressed`, 사진 버튼은 메뉴
 * 트리거이므로 `aria-haspopup`/`aria-expanded`/`aria-controls`를 함께 단다.
 */
export function InputModeToggle({
  mode,
  onSelectHandwriting,
  onSelectPhotoSource,
  disabled = false,
}: InputModeToggleProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const photoButtonRef = useRef<HTMLButtonElement>(null);
  // 메뉴가 열린 채 "필기로 문제 인식"을 탭하면 메뉴를 닫고 필기를 바로 선택한다(오너 결정) — 토글
  // 컨테이너 전체를 바깥 탭 차단 예외 영역으로 넘긴다.
  const toggleRef = useRef<HTMLDivElement>(null);
  const photoButtonId = useId();
  const menuId = useId();

  // 메뉴가 열린 채 비활성화되면 닫는다("Adjusting state when a prop changes" 패턴).
  if (disabled && isMenuOpen) {
    setIsMenuOpen(false);
  }

  const menuItems: readonly ActionMenuItem[] = [
    { id: "library", label: "사진 보관함", onSelect: () => onSelectPhotoSource("library") },
    { id: "camera", label: "사진 찍기", onSelect: () => onSelectPhotoSource("camera") },
  ];

  return (
    <div
      ref={toggleRef}
      className={
        "bg-fill-tint-green relative flex h-[36px] max-w-full items-center gap-[8px] rounded-[6px] p-[6px] " +
        "shadow-[inset_0px_-1px_0px_rgba(255,255,255,0.7),inset_0px_2px_4px_rgba(35,43,56,0.14)]"
      }
    >
      <button
        type="button"
        aria-pressed={mode === "handwriting"}
        disabled={disabled}
        onClick={onSelectHandwriting}
        className={segmentClassName(mode === "handwriting")}
      >
        필기로 문제 인식
      </button>
      <SegmentDivider />
      <button
        ref={photoButtonRef}
        id={photoButtonId}
        type="button"
        aria-pressed={mode === "photo"}
        aria-haspopup="menu"
        aria-expanded={isMenuOpen}
        aria-controls={menuId}
        disabled={disabled}
        onClick={() => setIsMenuOpen((prev) => !prev)}
        className={segmentClassName(mode === "photo")}
      >
        사진으로 문제 인식
      </button>
      {/* 메뉴 위치(임시 디자인, Figma 확정 대기): 오른쪽 사진 세그먼트 바로 아래, 오른쪽 정렬. 토글과의
      간격 6px은 신규 값이 아니라 이 토글 컨테이너 패딩(p-[6px]) 재사용이다. 메뉴는 토글 wrapper의 박스
      밖으로 넘치므로 캔버스 잉크 가림 표식을 메뉴 루트에 별도로 붙인다. */}
      <ActionMenu
        id={menuId}
        labelledBy={photoButtonId}
        items={menuItems}
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        triggerRef={photoButtonRef}
        passThroughRef={toggleRef}
        className="absolute top-full right-0 mt-[6px]"
        dataAttributes={CANVAS_OCCLUDER_PROPS}
      />
    </div>
  );
}
