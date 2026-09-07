import type { HighlightRegion } from "../../shared/lib/solve/deriveHighlightRegion";

interface HandwritingHighlightOverlayProps {
  region: HighlightRegion | null;
}

/**
 * `/solve/landscape`(DIAG) 결과 화면에서, 학생이 WORK 캔버스에 쓴 손글씨 위에 진단이 찾아낸
 * "막힌 지점"(막힌 줄)을 반투명 밴드로 겹쳐 보여주는 순수 장식 레이어(오너 승인, work-order
 * 6단계). Figma(`WhyMath Design System` node `38:21`의 자식 `258:452` "막힌 지점 하이라이트")
 * 실측: `bg-fill-tint-red/60`(기존 `--color-fill-tint-red` 20%에 60% 추가 감쇠 = 12%, Figma
 * 실측 `rgba(201,123,110,0.12)`와 정확히 일치), `rounded-[10px]`. `exact`/`approximate` 신뢰도는
 * 시각적으로 구분하지 않는다(Figma에도 단일 variant).
 *
 * `HandwritingCanvas.tsx` 내부는 절대 수정하지 않는다 — 이 컴포넌트는 같은 좌표계를 공유하기
 * 위해 `HandwritingCanvas`와 동일한 `absolute inset-0` 조상(페이지의 `relative` 컨테이너) 아래
 * 직속 sibling으로 배치되어야 한다(`SolveLandscapePage.tsx`에서 `HandwritingCanvas` 바로 앞에
 * 배치). 캔버스가 잉크 이외 영역은 투명이므로 DOM 순서만으로 하이라이트가 잉크 아래, PenRail/
 * ProblemCard/ActionBar(z-10)/ResultPanelShell(z-20) 아래에 자연스럽게 위치한다 — 별도 z-index
 * 값을 새로 만들 필요가 없다.
 */
export function HandwritingHighlightOverlay({ region }: HandwritingHighlightOverlayProps) {
  if (region === null) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      <div
        className="bg-fill-tint-red/60 absolute rounded-[10px]"
        style={{
          left: region.minX,
          top: region.minY,
          width: region.maxX - region.minX,
          height: region.maxY - region.minY,
        }}
      />
    </div>
  );
}
