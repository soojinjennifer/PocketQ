import { Badge } from "../../shared/ui/badge/Badge";
import { ElevatedCard } from "../../shared/ui/card/ElevatedCard";
import { TEXT_LINK_FOCUS_RING } from "../../shared/ui/text-link/textLinkStyle";

interface RecognizedProblemBarProps {
  recognizedText: string;
  /** "수정" 링크 클릭 시 호출한다. `SolveLandscapePage`의 SOLVE/DIAG 결과 분기 양쪽과
   *  `MyPage`(과거 풀이 다시 보기)가 이미 전달한다 — 전달하지 않으면 링크는 시각적으로만
   *  존재하고 클릭해도 아무 동작이 없다(비활성 표시). */
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
    // 한 줄 배치(S5-V7·V8, `docs/FIGURE_DESIGN.md` §18.12): 배지·버튼은 줄바꿈·축소 없음, 남는 폭은 본문만 쓰고 본문 안에서만 꺾인다
    // (말줄임 없음). 여러 줄 본문에서 배지·버튼이 가운데 뜨지 않게 위 정렬 + 본문 위 여백·버튼 위 바깥 여백 2px(첫 줄을 22px 배지 가운데에 맞춤, S5-V8).
    <ElevatedCard className="flex items-start gap-3">
      <Badge variant="tint-green" size="chip" className="shrink-0 whitespace-nowrap">
        인식됨
      </Badge>
      <p className="text-label-primary min-w-0 flex-1 pt-0.5 text-[13px] leading-[18px] font-normal wrap-anywhere whitespace-pre-wrap">
        {recognizedText}
      </p>
      {/* S5-V10: 텍스트 링크 공용 포커스 링(`TEXT_LINK_FOCUS_RING`). 첫 줄 정렬 2px는 링 바깥 여백(`mt-0.5`)이 맡는다 —
          안쪽 여백이면 링 안에서 글자가 아래로 치우친다(design P3, 재작업 1). */}
      <button
        type="button"
        onClick={onEdit}
        disabled={!onEdit}
        className={`text-brand mt-0.5 shrink-0 text-[13px] leading-[18px] font-[590] whitespace-nowrap disabled:opacity-50 ${TEXT_LINK_FOCUS_RING}`}
      >
        {editLabel}
      </button>
    </ElevatedCard>
  );
}
