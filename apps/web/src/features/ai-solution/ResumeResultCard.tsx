import { renderMathText } from "../../shared/lib/katex/renderMathText";
import { Badge } from "../../shared/ui/badge/Badge";
import { AnswerBox } from "./AnswerBox";
import { ELEVATED_CARD_STYLE } from "./elevatedCardStyle";
import type { ResumeMode } from "./ResumeModeBar";

export interface ResumeSolution {
  mode: ResumeMode;
  /** 식별/제안된 해법명(`method_catalog.method_name`). */
  methodName: string;
  /** 이어풀기 각 단계("무엇을"과 "왜", RESUME-3)를 담은 본문. */
  solutionMd: string;
  answerMd: string;
  /** RESUME-5: CAS 최종 답 검증 통과 여부. 통과한 결과만 화면에 표시된다는 전제이므로 이 배지는
   *  "검증 완료"임을 재확인시켜주는 용도다. */
  verified: boolean;
}

interface ResumeResultCardProps {
  solution: ResumeSolution;
}

const MODE_LABEL: Record<ResumeMode, string> = {
  own: "내 방법으로 계속",
  alternative: "다른 방법으로",
};

/**
 * `docs/COMPONENT_MAP.md` §2 `features/ai-solution/ResumeResultCard` — 이어풀기 결과(RESUME-1~5)를
 * 보여준다. 학생이 이미 쓴 줄은 다시 설명하지 않고(RESUME-2), 이어지는 단계마다 "무엇을"과 "왜"를
 * 함께 서술한다(RESUME-3)는 전제로 `solutionMd`를 그대로 렌더링한다. 최종 답은 같은 feature의
 * `AnswerBox`(확정 Figma 실측)를 재사용해 `ResultPanel`과 동일한 톤을 유지한다.
 *
 * 이번 단계는 하드코딩된 목업 `ResumeSolution`만 렌더링한다 — 이어풀기 생성/CAS 검증 백엔드
 * 연동은 5단계 범위다.
 */
export function ResumeResultCard({ solution }: ResumeResultCardProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className={`${ELEVATED_CARD_STYLE} flex flex-col gap-2`}>
        <div className="flex items-center justify-between gap-2">
          <p className="text-accent-purple text-[12px] leading-[16px] font-[590]">
            {MODE_LABEL[solution.mode]} · {solution.methodName}
          </p>
          {solution.verified ? (
            <Badge variant="tint-green" size="chip">
              검증됨
            </Badge>
          ) : null}
        </div>
        <p className="text-label-primary text-[13px] leading-[18px] font-normal whitespace-pre-wrap">
          {renderMathText(solution.solutionMd)}
        </p>
      </div>
      <AnswerBox answerMd={solution.answerMd} />
    </div>
  );
}
