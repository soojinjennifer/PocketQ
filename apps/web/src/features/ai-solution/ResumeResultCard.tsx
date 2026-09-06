import type { ResumeMode, ResumeSolution } from "shared-types";
import { renderMathText } from "../../shared/lib/katex/renderMathText";
import { AnswerBox } from "./AnswerBox";
import { ELEVATED_CARD_STYLE } from "./elevatedCardStyle";

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
 * `AnswerBox`(`tone="resume"`, RESUME 전용 신규 토큰 3종 적용)를 재사용한다.
 *
 * 2026-09 design-agent Figma 실측(`255:92`) 결과에 맞춰 재작성했다:
 * - 상단 라벨은 "{모드 라벨} · {methodName}"이 아니라 "이어풀기 · {모드 라벨}"(모드만)이고
 *   색상은 `accent-purple`이 아니라 `accent-orange`다.
 * - `solution.methodName`(필드명은 유지, 의미는 "이어가는 지점 요약"으로 재정의 —
 *   `shared-types`의 `ResumeSolution.methodName` JSDoc 참고)을 15px Semibold 헤드라인으로 새로
 *   보여준다.
 * - "검증됨" Badge는 제거한다 — Figma엔 이 카드에 배지 자체가 없고, CAS가 스텁이라 항상 true인
 *   값을 배지로 보여주는 것도 의미가 없다는 오너 판단이다(`solution.verified`는 여전히 타입에
 *   남아있지만 이 카드는 렌더링하지 않는다).
 * - 카드 패딩은 Figma 실측값(14px/12px) 대신 기존 `ELEVATED_CARD_STYLE`(16px/16px)을 그대로
 *   유지한다(다른 카드들과의 스타일 일관성 우선, 오너 승인).
 */
export function ResumeResultCard({ solution }: ResumeResultCardProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className={`${ELEVATED_CARD_STYLE} flex flex-col gap-2`}>
        <p className="text-accent-orange text-[12px] leading-[16px] font-[590]">
          이어풀기 · {MODE_LABEL[solution.mode]}
        </p>
        <p className="text-label-primary text-[15px] leading-[20px] font-[590] whitespace-pre-wrap">
          {renderMathText(solution.methodName)}
        </p>
        <p className="text-label-primary text-[13px] leading-[18px] font-normal whitespace-pre-wrap">
          {renderMathText(solution.solutionMd)}
        </p>
      </div>
      <AnswerBox answerMd={solution.answerMd} tone="resume" />
    </div>
  );
}
