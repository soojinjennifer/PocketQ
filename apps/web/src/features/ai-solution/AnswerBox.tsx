import { renderMathText } from "../../shared/lib/katex/renderMathText";

interface AnswerBoxProps {
  answerMd: string;
  /**
   * `"resume"`(신규, Figma `255:96` 이어풀기 최종 답 배너 실측) — `"default"`(V1.0 solve 결과,
   * `39:50~39:51`)와 배경/모서리/그림자/텍스트 색상이 다르다. 기존 `"default"` 사용처(Result
   * Panel/스트리밍 중간 표시)는 전혀 건드리지 않는다. @default "default"
   */
  tone?: "default" | "resume";
}

/**
 * Figma `AnswerBox` — "최종 답 · {answerMd}" 형태의 한 줄 강조 배너.
 * `answerMd`가 여러 줄/수식을 포함할 수 있어 한 줄에 억지로 맞추지 않고 자연스럽게 줄바꿈한다.
 *
 * 참고(수정 범위 아님, 기록만): 이 컴포넌트가 원래 인용하던 Figma 노드(`39:50`~`39:51`)는
 * design-agent 조회 결과 파일에 존재하지 않는 노드였다(`ActionBar`가 무효 노드를 인용했던 사례와
 * 동일 패턴, `docs/PROJECT_STATUS.md` 참고) — 이번 작업 범위가 아니라 노드 인용만 제거하고 실제
 * 수정은 하지 않는다.
 */
export function AnswerBox({ answerMd, tone = "default" }: AnswerBoxProps) {
  return (
    <div className={CONTAINER_STYLE[tone]}>
      <p className={`${TEXT_STYLE[tone]} text-[15px] leading-[20px] font-[590] whitespace-pre-wrap`}>
        <span>최종 답 · </span>
        {renderMathText(answerMd)}
      </p>
    </div>
  );
}

const CONTAINER_STYLE: Record<NonNullable<AnswerBoxProps["tone"]>, string> = {
  default: "bg-fill-tint-brand rounded-[14px] p-4",
  // `brand/tint`(불투명, `--color-brand-tint`) + `radius/18` + `Math/Shadow Rest`(5겹 그림자,
  // `Elevation/Floating Bar`와 레이어 수치가 동일해 그 클래스를 그대로 재사용한다 —
  // `docs/DESIGN_SYSTEM.md` §4 참고).
  resume:
    "bg-brand-tint rounded-[18px] p-4 drop-shadow-[0px_3px_0px_rgba(35,43,56,0.21),0px_8px_16px_rgba(35,43,56,0.14),0px_20px_34px_rgba(35,43,56,0.08)] shadow-[inset_0px_2px_0px_rgba(255,255,255,0.9),inset_0px_-2px_0px_rgba(35,43,56,0.07)]",
};

const TEXT_STYLE: Record<NonNullable<AnswerBoxProps["tone"]>, string> = {
  default: "text-brand-deep",
  resume: "text-label-primary",
};
