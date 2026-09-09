import type { RefObject } from "react";
import type { HandwritingCanvasHandle } from "./HandwritingCanvas";

interface SolveScrollProps {
  /** WORK 단계 `HandwritingCanvas`의 imperative handle — 마커 탭 시 `scrollToRatio`를 호출한다. */
  canvasRef: RefObject<HandwritingCanvasHandle | null>;
  /** 현재 스크롤 비율(0=맨 위 ~ 1=맨 아래). 가장 가까운 마커를 "선택됨"으로 강조하는 데 쓴다. */
  currentRatio: number;
  /**
   * `true`면 스크롤이 불필요한 상태(풀이가 짧아 캔버스가 실제로 스크롤되지 않음)라는 뜻이다 —
   * 오너 요청: 이 경우에도 마커/트랙/힌트카드는 그대로 보여주고(없애지 않음) 탭 인터랙션만
   * 비활성화한다. 기본값 `false`(기존 동작 그대로).
   */
  disabled?: boolean;
}

/** 마커가 가리키는 스크롤 비율(0, 1/3, 2/3, 1) — 4개 마커를 등간격 비율로 배치한다. */
const MARKER_RATIOS = [0, 1 / 3, 2 / 3, 1] as const;

/**
 * 컴포넌트(64×252) 기준 마커 중심 y좌표(px) — Figma `Solve Scroll (Step=First)`(fileKey
 * `ltyPrCk8UT8DsB3tFuw7Sr`, node `302:167`) MCP `get_metadata` 재조회로 확정한 값.
 *
 * (design-agent 사후검수 수정, 2026-09) 이전 값(10 / 63.5 / 126.5 / 182.5)은 "스크롤 도트 트랙"
 * 하위 프레임(`302:168`, 컴포넌트 내부 y=15에서 시작) *내부* 상대좌표였고, 컴포넌트 전체(302:167)
 * 기준으로 변환하지 않은 채(즉 트랙 프레임 자신의 y=15 오프셋을 누락한 채) 그대로 top에 사용해
 * 전체 마커/트랙/힌트카드가 15px씩 위로 밀려 있었다. 아래 값은 트랙 프레임 오프셋을 반영해
 * 재계산한 컴포넌트-절대 좌표다: 도트(302:168 하위) 중심 = 트랙 프레임 y(15) + 각 도트의
 * (상대 y + 상대 height/2) → 15+(0+10)=25, 15+(58+5.5)=78.5, 15+(121+5.5)=141.5,
 * 15+(177+5.5)=197.5.
 */
const MARKER_Y_PX = [25, 78.5, 141.5, 197.5] as const;

/** 트랙 라인 두께(px)이자 상/하단 y좌표 — Figma 실측값(`302:169` "트랙 라인", 컴포넌트 기준 top=20, height=178). */
const TRACK_THICKNESS_PX = 2;
const TRACK_TOP_PX = 20;
const TRACK_HEIGHT_PX = 178;

/**
 * 힌트 카드 top(px), 컴포넌트(302:167) 기준 절대좌표 — Figma `302:177` "스크롤 힌트" 실측값
 * (x=0, y=213, w=64, h=36). 트랙 라인 하단(20+178=198)과의 gap은 213-198=15px.
 * (design-agent 수정) 기존엔 이 값을 "마지막 마커 *중심*(182.5, 그마저도 15px 밀린 값) + 10"으로
 * 유도해 실제보다 한참 위(192.5)에 그려지고 있었다 — 마커 중심이 아니라 트랙 라인 하단에서부터
 * gap을 재는 것이 Figma 구조와 맞으므로, 파생 계산 대신 실측 절대값을 그대로 상수화한다.
 */
const HINT_TOP_PX = 213;

/** 현재 비율과 가장 가까운 마커의 인덱스를 구한다(동률이면 먼저 나오는 인덱스). */
function getNearestMarkerIndex(currentRatio: number): number {
  let nearestIndex = 0;
  let minDiff = Number.POSITIVE_INFINITY;
  MARKER_RATIOS.forEach((ratio, index) => {
    const diff = Math.abs(ratio - currentRatio);
    if (diff < minDiff) {
      minDiff = diff;
      nearestIndex = index;
    }
  });
  return nearestIndex;
}

/**
 * Figma `Solve Scroll (Step=First)`(node `302:167`) — 스크롤 가능한 필기 캔버스(`scrollable`
 * `HandwritingCanvas`) 위에 얹는 스크롤 인디케이터. 최초엔 `/solve/pencilcanvas` WORK 단계
 * 캔버스 전용이었지만, `/solve/landscape`도 동일한 좌측 PenRail+SolveScroll 그룹을 갖도록
 * 확장되어(오너 iPad 실기기 보고, `38:21` 재실측, design-agent 사후검수 수정 2026-09) 두 페이지
 * 모두에서 쓰인다 — 특정 라우트에 종속되지 않는 범용 컴포넌트로 취급한다. 트랙 위 마커 4개를
 * 펜/마우스로 탭하면 해당 비율 지점으로 캔버스를 스크롤 이동시킨다(`canvasRef.current?.scrollToRatio`).
 * `currentRatio`와 가장 가까운 마커를 "선택됨"(이중 원, 20×20)으로, 나머지는 "선택안됨"(단일 링,
 * 11×11)으로 그린다.
 *
 * 펜이 캔버스에 그리는 도중(`isPenActive()`)엔 마커 탭을 무시한다 — 필기 중 우연히 손이 스쳐도
 * 스크롤이 튀지 않게 하기 위함(팜 리젝션과 동일한 취지).
 *
 * `disabled`(오너 요청): 풀이가 짧아 스크롤할 필요가 없을 때도 이 컴포넌트 자체를 없애지 않고
 * 계속 보여준다 — 마커/트랙/힌트카드는 그대로 렌더링하되 톤 다운(`opacity-40`, `ActionBar.tsx`의
 * `disabled:opacity-40` 관례와 동일 값)하고, 마커 버튼에 네이티브 `disabled`(이 프로젝트의
 * `ActionBar` 세그먼트 버튼과 동일하게 탭 포커스에서도 제외한다) + `aria-disabled`를 함께 표시해
 * 마커 탭이 아무 동작도 하지 않게 한다.
 *
 * 위치(부모가 배치): 이 컴포넌트 자체는 크기(64×252, `relative`)만 가지며, 화면상 절대 위치
 * (PenRail 바로 아래 16px, x축 중심 정렬)는 이 컴포넌트를 쓰는 페이지(`SolvePencilcanvasPage`/
 * `SolveLandscapePage`)가 각각 동일한 wrapper 클래스로 부여한다.
 */
export function SolveScroll({ canvasRef, currentRatio, disabled = false }: SolveScrollProps) {
  const activeIndex = getNearestMarkerIndex(currentRatio);

  const handleActivate = (ratio: number) => {
    if (disabled) {
      return;
    }
    const handle = canvasRef.current;
    if (!handle || handle.isPenActive()) {
      return;
    }
    handle.scrollToRatio(ratio);
  };

  return (
    <div className={`relative h-[252px] w-16 ${disabled ? "opacity-40" : ""}`}>
      <div
        className="bg-brand absolute left-1/2 -translate-x-1/2"
        style={{
          top: TRACK_TOP_PX,
          height: TRACK_HEIGHT_PX,
          width: TRACK_THICKNESS_PX,
        }}
        aria-hidden="true"
      />

      {MARKER_RATIOS.map((ratio, index) => {
        const isActive = index === activeIndex;
        return (
          <button
            key={ratio}
            type="button"
            aria-label={`풀이 ${Math.round(ratio * 100)}% 지점으로 스크롤 이동`}
            aria-pressed={isActive}
            aria-disabled={disabled}
            disabled={disabled}
            onClick={() => handleActivate(ratio)}
            className="absolute left-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center disabled:cursor-not-allowed"
            style={{ top: MARKER_Y_PX[index] }}
          >
            {isActive ? <SelectedMarker /> : <UnselectedMarker />}
          </button>
        );
      })}

      <div
        className={
          "border-glass-border bg-glass-fill absolute inset-x-0 flex h-9 w-16 items-center justify-center rounded-[6px] border " +
          // `Math/Shadow Rest`(Figma `302:177` 실측) == 기존 `Elevation/Floating Bar`와 레이어 수치가
          // 동일해 신규 값을 만들지 않고 `ActionBar.tsx` `EMPHASIZED_SEGMENT_STYLE`과 동일한 문자열을
          // 재사용한다(docs/DESIGN_SYSTEM.md §4 `Math/Shadow Rest` 항목 참고).
          "drop-shadow-[0px_3px_0px_rgba(35,43,56,0.21),0px_8px_16px_rgba(35,43,56,0.14),0px_20px_34px_rgba(35,43,56,0.08)] " +
          "shadow-[inset_0px_2px_0px_rgba(255,255,255,0.9),inset_0px_-2px_0px_rgba(35,43,56,0.07)]"
        }
        style={{ top: HINT_TOP_PX }}
      >
        <p className="text-label-secondary text-center text-[12px] leading-[16px]">
          펜으로 눌러
          <br />
          스크롤
        </p>
      </div>
    </div>
  );
}

/**
 * "현재 선택됨" 마커(20×20) — Figma MCP `get_metadata`로 확인한 3겹 원 구조를 그대로 재현한다
 * (`307:1455` "도트 2 · 현재" 하위: `307:1456` "링" 20×20/`brand-indigo` 보더,
 * `307:1457` "여백" 14×14(inset 3px)/`glass-fill` 채움, `307:1458` "코어" 10×10(inset 5px)/`brand-indigo` 채움).
 *
 * (design-agent 사후검수 수정, 2026-09) 기존엔 flex 중앙정렬로 안쪽 원을 근사해 "여백"(글래스 채움)
 * 레이어가 아예 빠져 있었다 — 외곽 링과 코어 사이가 캔버스 배경색이 그대로 비치는 완전 투명이었다.
 * 3겹을 각각 절대 위치(`inset`)로 배치해 Figma 실측 오프셋과 정확히 일치시킨다. 링 보더 두께는
 * Figma에 stroke weight 수치가 노출되지 않아 트랙 라인과 동일 값(2px)을 재사용한 기존 유도값을 유지한다.
 */
function SelectedMarker() {
  return (
    <span className="relative block size-5" aria-hidden="true">
      <span
        className="border-brand absolute inset-0 rounded-full"
        style={{ borderWidth: TRACK_THICKNESS_PX }}
      />
      <span className="bg-glass-fill absolute rounded-full" style={{ inset: 3 }} />
      <span className="bg-brand absolute rounded-full" style={{ inset: 5 }} />
    </span>
  );
}

/**
 * "선택안됨" 마커(11×11) — 단일 링. Figma MCP `get_variable_defs`(`302:175` 등) 확인 결과 보더는
 * `label-primary`(navy)가 아니라 `brand-indigo`이고, 속은 완전 투명이 아니라 `glass-fill`로
 * 채워져 있다.
 *
 * (design-agent 사후검수 수정, 2026-09) 두 가지 버그가 있었다: (1) 색 토큰이 `border-label-primary`
 * + `bg-transparent`로 잘못 지정돼 있었고, (2) 더 심각하게 `border` 두께 유틸리티 클래스가 전혀
 * 없어(`border-label-primary`는 보더 *색상*만 지정하고, Tailwind preflight 기본 `border-width: 0`
 * 때문에) 실제로는 보더가 전혀 렌더링되지 않는 상태였다(선택되지 않은 마커 3개가 사실상 완전히
 * 안 보임). 이 프로젝트의 기존 관례(`PenRail.tsx`, `ActionBar.tsx`가 `border-{token}` 옆에 항상
 * bare `border` 클래스를 함께 쓰는 패턴)를 따라 `border`를 추가했다.
 */
function UnselectedMarker() {
  return (
    <span
      className="border-brand bg-glass-fill border block size-[11px] rounded-full"
      aria-hidden="true"
    />
  );
}
