import type { ReactNode } from "react";
import type { ResumeMode, ResumeSolution } from "shared-types";
import { renderMathText } from "../../shared/lib/katex/renderMathText";
import { AnswerBox } from "./AnswerBox";
import { ElevatedCard } from "../../shared/ui/card/ElevatedCard";
import { FigureSlot } from "./FigureSlot";
import { SolutionStepList } from "./SolutionStepList";

interface ResumeResultCardProps {
  solution: ResumeSolution;
  /** 그림에 표시 중인 전역 단계 번호(Stage 4). null/미지정이면 최종(강조 없음). */
  currentStep?: number | null;
  /**
   * 이어풀기 카드와 AnswerBox 사이에 둘 도형 슬롯(Stage 4 §17.1). `features/figure-visualization`을 직접
   * import하지 않도록 페이지가 조립해 넘긴다. 없으면(`undefined`) 아무것도 렌더하지 않는다(기존 DOM 동일).
   * `null`이면 내용 없이 `aria-live="off"` 슬롯 래퍼만 미리 렌더한다(`FigureSlot`).
   */
  figureContent?: ReactNode;
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
 * - 카드 패딩은 Figma 실측값(14px/12px) 대신 기존 카드 표면(`ElevatedCard`, 16px/16px)을 그대로
 *   유지한다(다른 카드들과의 스타일 일관성 우선, 오너 승인).
 */
export function ResumeResultCard({ solution, currentStep = null, figureContent }: ResumeResultCardProps) {
  return (
    <div className="flex flex-col gap-3">
      <ElevatedCard className="flex flex-col gap-2">
        <p className="text-accent-orange text-[12px] leading-[16px] font-[590]">
          이어풀기 · {MODE_LABEL[solution.mode]}
        </p>
        <p className="text-label-primary text-[15px] leading-[20px] font-[590] whitespace-pre-wrap">
          {renderMathText(solution.methodName)}
        </p>
        <SolutionStepList body={solution.solutionMd} currentStep={currentStep} />
      </ElevatedCard>
      {figureContent !== undefined ? <FigureSlot>{figureContent}</FigureSlot> : null}
      <AnswerBox answerMd={solution.answerMd} tone="resume" />
    </div>
  );
}
