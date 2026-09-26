import { Fragment } from "react";

/** `"upload"`는 UI 전용 모드다 — 서버 계약상 업로드 사진도 `inputType: "photo"`로 전송된다. */
export type InputMode = "photo" | "upload" | "handwriting";

interface InputModeToggleProps {
  mode: InputMode;
  onSelectMode: (mode: InputMode) => void;
}

const SEGMENT_LABEL: Record<InputMode, string> = {
  photo: "사진으로 문제 인식",
  upload: "사진 업로드",
  handwriting: "필기로 문제 인식",
};

const SEGMENTS: readonly InputMode[] = ["photo", "upload", "handwriting"];

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
 * 폭 0 슬롯 안에 1px 선을 absolute로 두어 컨테이너 총 폭(370px)에 기여하지 않게 한다.
 */
function SegmentDivider() {
  return (
    <span aria-hidden="true" data-testid="input-mode-divider" className="relative h-[17px] w-0">
      <span className="bg-accent-green absolute inset-y-0 left-0 w-px" />
    </span>
  );
}

/**
 * Figma `Input Mode Toggle`(node `342-833`, fileKey `ltyPrCk8UT8DsB3tFuw7Sr`) —
 * `/solve/pencilcanvas` INPUT 단계 전용 "사진으로 문제 인식" / "사진 업로드" / "필기로 문제 인식"
 * 3분할 세그먼트 토글. NavTabBar 바로 아래 화면 상단 중앙에 배치된다(배치는 이
 * 컴포넌트를 쓰는 페이지가 담당한다, `PenRail`/`SolveHeader`와 동일한 패턴).
 *
 * 오너 UX 결정(2026-09): "사진으로 문제 인식"이 시각적으로 강조돼 있을 뿐, 카메라는 자동
 * 호출되지 않는다 — 사용자가 이 탭을 명시적으로 눌러야 상위(`SolvePencilcanvasPage`)가
 * `navigate("/camera")`를 실행한다. "사진 업로드"는 상위가 숨은 파일 input을 열어 기기의 사진
 * 선택 창을 띄운다(INPUT-4). 이 컴포넌트 자체는 라우팅/파일 로직을 갖지 않고 `onSelectMode`만
 * 호출하는 순수 컴포넌트다.
 *
 * 컨테이너는 `bg-fill-tint-green`(기존 토큰) 배경 위에 `Elevation/Well Inset`(신규, 안쪽으로
 * 눌린 느낌의 inset 그림자, `docs/DESIGN_SYSTEM.md` §4 참고)을 적용해 "홈(well)"처럼 보이게 하고,
 * 선택된 세그먼트만 그 위에 떠 있는 칩처럼 `Elevation/Chip Raised` 그림자를 얹는다.
 *
 * 접근성: 이 프로젝트 기존 관례(`PenRail.tsx`의 펜/지우개 토글 버튼)를 따라 `aria-pressed`를 쓴다.
 */
export function InputModeToggle({ mode, onSelectMode }: InputModeToggleProps) {
  return (
    <div
      className={
        "bg-fill-tint-green flex h-[36px] max-w-full items-center gap-[8px] rounded-[6px] p-[6px] " +
        "shadow-[inset_0px_-1px_0px_rgba(255,255,255,0.7),inset_0px_2px_4px_rgba(35,43,56,0.14)]"
      }
    >
      {SEGMENTS.map((segment, index) => {
        const isSelected = mode === segment;
        return (
          <Fragment key={segment}>
            {index > 0 ? <SegmentDivider /> : null}
            <button
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelectMode(segment)}
              className={`${SEGMENT_BASE_STYLE} ${isSelected ? SELECTED_SEGMENT_STYLE : UNSELECTED_SEGMENT_STYLE}`}
            >
              {SEGMENT_LABEL[segment]}
            </button>
          </Fragment>
        );
      })}
    </div>
  );
}
