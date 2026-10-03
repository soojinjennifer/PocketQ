import { CANVAS_OCCLUDER_PROPS } from "../../shared/lib/canvas/useOccluderMask";
import { Logo } from "../../shared/ui/logo/Logo";
import { SolveNavTabs } from "./SolveNavTabs";

/**
 * `/solve/pencilcanvas`, `/solve/landscape` 공통 상단부 — 좌측 상단 Logo + 중앙 상단 SolveNavTabs.
 * 두 화면에서 동일하게 반복되어 재사용 가능한 단위로 추출했다(화면 전체를 감싸지 않는다).
 * 두 wrapper 모두 캔버스 잉크 가림 영역(`CANVAS_OCCLUDER_PROPS`)으로 표시한다.
 */
export function SolveHeader() {
  return (
    <>
      <div {...CANVAS_OCCLUDER_PROPS} className="absolute top-6 left-6 z-10">
        <Logo size="small" />
      </div>
      <div {...CANVAS_OCCLUDER_PROPS} className="absolute top-6 left-1/2 z-10 -translate-x-1/2">
        <SolveNavTabs />
      </div>
    </>
  );
}
