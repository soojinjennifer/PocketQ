import type { ReactNode } from "react";
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
  /** Body 최하단(최종 답 아래)에 렌더링할 후속 질문 콘텐츠 — 제안 질문 pill + 대화 버블 목록
   *  (`features/follow-up-chat`). `ResultPanel`(`features/ai-solution`)은 이 슬롯을 통해서만
   *  받는다 — feature 간 직접 참조를 금지하는 규칙(`.claude/rules/frontend.md` §1) 때문에
   *  실제 조립은 페이지 레이어(`pages/solve/landscape/SolveLandscapePage`)가 담당한다. 없으면
   *  아무 것도 렌더링하지 않는다. */
  chatContent?: ReactNode;
  /** 패널 최하단 고정 Footer(해시태그 pill 행 + 입력창 + 전송 버튼, `features/follow-up-chat/ChatFooter`).
   *  위와 같은 이유로 슬롯으로만 받는다. 없으면 Footer 없이 Body가 패널 하단까지 채운다(기존 동작
   *  유지 — 로딩 중 콘텐츠 등 채팅이 필요 없는 곳에서도 이 컴포넌트를 그대로 쓸 수 있게 한다). */
  chatFooter?: ReactNode;
}

/**
 * Figma `Result Panel`(`39:28~39:65`, `docs/COMPONENT_MAP.md` §2) — Header(제목/카테고리
 * 배지/"새 문제" 배지) + Body(인식된 문제 바 + 개념/풀이 카드 + 최종 답 + 후속 질문 콘텐츠) +
 * Footer(후속 질문 입력, 있을 때만) 3블록.
 *
 * 위치/폭/배경/모서리/그림자 등 패널 셸 스타일은 `ResultPanelShell`이 담당한다(로딩 중 콘텐츠와
 * 항상 같은 셸을 공유해야 해서 분리했다 — `SolveLandscapePage` 참고). 이 컴포넌트는 그 셸을
 * 꽉 채우는 header(shrink-0) + body(flex-1, 스크롤) + footer(shrink-0, `chatFooter`가 있을 때만)
 * 블록을 렌더링한다.
 */
export function ResultPanel({
  category,
  recognizedText,
  onEdit,
  onNewProblem,
  conceptMd,
  solutionMd,
  answerMd,
  chatContent,
  chatFooter,
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
        {chatContent}
      </div>

      {chatFooter ? <div className="shrink-0 px-5 pt-2 pb-5">{chatFooter}</div> : null}
    </>
  );
}
