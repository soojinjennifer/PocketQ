import { renderMathText } from "../../shared/lib/katex/renderMathText";
import { Badge } from "../../shared/ui/badge/Badge";
import { ELEVATED_CARD_STYLE } from "./elevatedCardStyle";

export interface Diagnosis {
  /** 마지막으로 유효했던 줄 번호(1-base). 첫 줄부터 막혔으면 0. */
  lastValidLine: number;
  /** 최초로 부적합했던 줄 번호(DIAG-2 "막힌 지점"). 오류 없이 중단된 경우(DIAG-4 "중단형")면 `null`. */
  stallLine: number | null;
  /** `error_taxonomy.name`(DIAG-3). 오류가 없으면 `null`. */
  errorTypeLabel: string | null;
  /** 오류 상세 설명(DIAG-2). */
  errorDetail: string | null;
  /** 막힌 지점과 연결된 개념(DIAG-2 "관련 개념"). */
  relatedConcepts: string[];
  /** 정답에 도달했지만 표기·논리 비약이 있는 경우(DIAG-6). */
  reachedAnswerWithNotes: boolean;
  /** 진단 신뢰도가 임계값 미만이면 단정하지 않고 완화 표현으로 전환한다(DIAG-5). */
  isLowConfidence: boolean;
}

interface DiagnosisCardProps {
  diagnosis: Diagnosis;
}

/**
 * `docs/COMPONENT_MAP.md` §2 `features/ai-solution/DiagnosisCard` — 진단(DIAG) 결과 4요소
 * (유효 구간·막힌 지점·오류 유형·관련 개념, DIAG-2)를 한 카드에 보여준다. 오류 없이 중단된
 * 경우(DIAG-4 "중단형")와 오류가 있는 경우(DIAG-4 "오류형")를 다른 문구로 안내하고, 진단
 * 신뢰도가 낮으면 완화 표현으로 전환한다(DIAG-5). 정답에 도달했지만 표기·논리 비약이 있으면
 * 정답임을 먼저 인정한다(DIAG-6).
 *
 * 이번 단계는 하드코딩된 목업 `Diagnosis`만 렌더링한다 — CAS 검증/오류 분류 백엔드 연동은
 * 4단계 범위다. 정확한 Figma 프레임이 아직 확인되지 않아, 톤·구조는 같은 feature의
 * `ResultCard`(확정 Figma 실측) 카드 스타일을 재사용했다.
 */
export function DiagnosisCard({ diagnosis }: DiagnosisCardProps) {
  const {
    lastValidLine,
    stallLine,
    errorTypeLabel,
    errorDetail,
    relatedConcepts,
    reachedAnswerWithNotes,
    isLowConfidence,
  } = diagnosis;

  // "중단형"(DIAG-4): 오류는 없지만 다음 단계를 몰라 멈춘 경우.
  const isStoppedWithoutError = stallLine === null && errorTypeLabel === null;

  const summary = reachedAnswerWithNotes
    ? "정답입니다! 다만 표기나 전개 과정에서 조금 더 다듬을 부분이 있어요."
    : isStoppedWithoutError
      ? `${lastValidLine}번째 줄까지 정확해요. 다음 단계를 함께 볼까요?`
      : `${lastValidLine}번째 줄까지 정확합니다. ${stallLine}번째 줄에서 막혔어요.`;

  return (
    <div className={`${ELEVATED_CARD_STYLE} flex flex-col gap-2`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-accent-purple text-[12px] leading-[16px] font-[590]">진단 결과</p>
        {errorTypeLabel ? (
          <Badge variant="tint-blue" size="chip">
            {errorTypeLabel}
          </Badge>
        ) : null}
      </div>

      <p className="text-label-primary text-[13px] leading-[18px] font-normal whitespace-pre-wrap">
        {isLowConfidence ? "이 부분을 다시 확인해 볼까요 — " : null}
        {summary}
      </p>

      {errorDetail ? (
        <p className="text-label-secondary text-[13px] leading-[18px] font-normal whitespace-pre-wrap">
          {renderMathText(errorDetail)}
        </p>
      ) : null}

      {relatedConcepts.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {relatedConcepts.map((concept) => (
            <Badge key={concept} variant="tint-blue-flat" size="tag-sm">
              {concept}
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}
