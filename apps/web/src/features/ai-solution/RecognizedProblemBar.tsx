import { Badge } from "../../shared/ui/badge/Badge";

interface RecognizedProblemBarProps {
  recognizedText: string;
  /** "수정" 링크 클릭 시 호출한다. 현재 코드베이스에는 인식 완료 후 텍스트를 고쳐 재제출하는
   *  확정된 흐름이 없어(plan-agent 조사 결과), 상위에서 아직 전달하지 않는다. 전달하지 않으면
   *  링크는 시각적으로만 존재하고 클릭해도 아무 동작이 없다. */
  onEdit?: () => void;
  /** "수정" 버튼의 표시 텍스트. 마이페이지 과거 풀이 다시 보기에서는 "다시 풀기"로 바뀐다.
   *  @default "수정" */
  editLabel?: string;
}

/**
 * Figma `RecognizedProblemBar`(`39:37~39:41`) — Result Panel Body 최상단, 인식된 문제 원문을
 * 보여주는 바. "인식됨" 배지는 비상호작용 표시 배지, "수정"은 텍스트 링크다.
 */
export function RecognizedProblemBar({
  recognizedText,
  onEdit,
  editLabel = "수정",
}: RecognizedProblemBarProps) {
  return (
    <div className="bg-bg-elevated flex items-center gap-3 rounded-[14px] p-4 drop-shadow-[0px_2px_0px_rgba(35,43,56,0.18),0px_7px_13px_rgba(35,43,56,0.11)]">
      <Badge variant="tint-green" size="chip">
        인식됨
      </Badge>
      <p className="text-label-primary flex-1 text-[13px] leading-[18px] font-normal whitespace-pre-wrap">
        {recognizedText}
      </p>
      <button
        type="button"
        onClick={onEdit}
        disabled={!onEdit}
        className="text-brand shrink-0 text-[13px] leading-[18px] font-[590] disabled:opacity-50"
      >
        {editLabel}
      </button>
    </div>
  );
}
