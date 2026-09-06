import { Badge } from "../../shared/ui/badge/Badge";

interface RecognizedChipProps {
  recognizedText: string;
}

/**
 * Figma `Solve/Recognized Chip`(마스터 `250:56`) — `/solve/pencilcanvas` WORK 단계 캔버스 상단에
 * 인식된 문제 원문을 보여주는 완전 라운드 글래스 pill. `features/ai-solution/RecognizedProblemBar`
 * (`/solve/landscape` Result Panel 전용)와 달리 이 칩에는 편집 진입점("수정")이 없다 — 이 화면에는
 * 인식 완료 후 텍스트를 고쳐 재제출하는 흐름이 없기 때문이다.
 *
 * 배경/보더는 `bg-glass-fill`/`border-glass-border`(ActionBar/PenRail과 동일 톤), 그림자는
 * `Elevation/Tab Pill`(2겹, `docs/DESIGN_SYSTEM.md` §4) — ActionBar/PenRail이 쓰는
 * `Elevation/Floating Bar`(3겹+inset)와는 다른 값이니 혼동하지 않는다.
 */
export function RecognizedChip({ recognizedText }: RecognizedChipProps) {
  return (
    <div className="bg-glass-fill border-glass-border flex items-center gap-[8px] rounded-full border px-[14px] py-[7px] drop-shadow-[0px_2px_0px_rgba(35,43,56,0.18),0px_7px_13px_rgba(35,43,56,0.11)] shadow-[inset_0px_2px_0px_rgba(255,255,255,0.6)]">
      <Badge variant="tint-green" size="recognized-chip">
        인식됨
      </Badge>
      <p className="text-label-primary flex-1 text-[13px] leading-[18px] font-normal whitespace-pre-wrap">
        {recognizedText}
      </p>
    </div>
  );
}
