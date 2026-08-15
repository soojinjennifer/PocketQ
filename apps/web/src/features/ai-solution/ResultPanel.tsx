import { AnswerBox } from "./AnswerBox";
import { RecognizedProblemBar } from "./RecognizedProblemBar";
import { ResultCard } from "./ResultCard";
import { Badge } from "../../shared/ui/badge/Badge";

interface ResultPanelProps {
  /** `solveResult.conceptTags[0]`. 태그가 없으면 배지를 렌더링하지 않는다. */
  category?: string;
  recognizedText: string;
  onEdit?: () => void;
  onNewProblem?: () => void;
  conceptMd: string | null;
  solutionMd: string | null;
  answerMd: string;
}

/**
 * Figma `Result Panel`(`39:28~39:65`, `docs/COMPONENT_MAP.md` §2) — Header(제목/카테고리
 * 배지/"새 문제" 배지) + Body(인식된 문제 바 + 개념/풀이 카드 + 최종 답) 콘텐츠.
 *
 * 위치/폭/배경/모서리/그림자 등 패널 셸 스타일은 `ResultPanelShell`이 담당한다(로딩 중 콘텐츠와
 * 항상 같은 셸을 공유해야 해서 분리했다 — `SolveLandscapePage` 참고). 이 컴포넌트는 그 셸을
 * 꽉 채우는 header(shrink-0) + body(flex-1, 스크롤) 두 블록만 렌더링한다.
 *
 * Footer(`39:54~39:65`, 후속 질문 입력)는 이번 범위에서 제외돼 아예 렌더링하지 않는다(오너 지시:
 * 빈 구조/임시 UI 금지) — Body가 패널 하단까지 자연스럽게 채운다.
 */
export function ResultPanel({
  category,
  recognizedText,
  onEdit,
  onNewProblem,
  conceptMd,
  solutionMd,
  answerMd,
}: ResultPanelProps) {
  return (
    <>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-5 py-3">
        <h2 className="text-label-primary text-[17px] leading-[22px] font-[590]">풀이 결과</h2>
        <div className="flex flex-wrap items-center gap-2">
          {category ? <Badge variant="tint-blue">{category}</Badge> : null}
          <Badge variant="tint-blue" onClick={onNewProblem}>
            새 문제
          </Badge>
        </div>
      </div>

      <div
        className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 pb-5 touch-pan-y"
        aria-live="polite"
      >
        <RecognizedProblemBar recognizedText={recognizedText} onEdit={onEdit} />
        {conceptMd ? <ResultCard kind="concept" body={conceptMd} /> : null}
        {solutionMd ? <ResultCard kind="steps" body={solutionMd} /> : null}
        <AnswerBox answerMd={answerMd} />
      </div>
    </>
  );
}
