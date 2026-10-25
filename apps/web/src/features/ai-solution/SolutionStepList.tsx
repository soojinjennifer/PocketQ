import { splitSolutionSteps } from "validation";
import { renderMathText } from "../../shared/lib/katex/renderMathText";
import { hidePartialStepMarker } from "./hidePartialStepMarker";

interface SolutionStepListProps {
  /** 풀이 섹션 본문(최초 풀이 `## 풀이`, 이어풀기 `## 이어풀기`). */
  body: string;
  /** 그림에 표시 중인 전역 단계 번호(1~N). null/미지정이면 최종(강조 블록 없음). */
  currentStep?: number | null;
  /** 스트리밍 중이면 마지막 줄의 미완성 표지(`**2단` 등)를 숨긴다(§17.11). */
  streaming?: boolean;
}

/** 본문 문단 타이포(기존 `ResultCard`·`ResumeResultCard` 본문과 같은 클래스). */
const BODY_CLASS = "text-label-primary text-[13px] leading-[18px] font-normal whitespace-pre-wrap";

/** 줄 맨 앞 `**N단계**` 표지와 바로 뒤 공백. */
const LEADING_MARKER = /^\*\*([1-9][0-9]?)단계\*\*[ \t]?/;

/**
 * 풀이 단계 블록(Stage 4, `docs/FIGURE_DESIGN.md` §17.3). 데이터 기준(§17.12): 줄 맨 앞 `**N단계**` 표지로
 * `splitSolutionSteps`가 성공할 때만 머리말 + `<ol>` 블록으로 그린다. 실패하면 기존 카드 본문 `<p>`와 DOM이 같다.
 *
 * - 머리 라벨 "N단계"는 별표를 지우고 같은 줄 본문 앞에 인라인 Footnote Semibold로 둔다.
 * - 블록은 항상 `-mx-2 px-2 py-1.5`(선택이 바뀌어도 레이아웃 불변). 현재 단계 블록만
 *   `rounded-[10px] bg-fill-tint-brand ring-1 ring-brand` + `aria-current="step"` + sr-only "(그림에 표시 중)".
 * - 블록은 버튼이 아니다(탭해도 단계가 바뀌지 않음, §17.4). 전환 애니메이션 없음(§17.8).
 */
export function SolutionStepList({ body, currentStep = null, streaming = false }: SolutionStepListProps) {
  const text = hidePartialStepMarker(body, streaming);
  const split = splitSolutionSteps(text);
  if (!split.ok) {
    return <p className={BODY_CLASS}>{renderMathText(text)}</p>;
  }

  const firstMarker = text.split(/\r?\n/).findIndex((line) => LEADING_MARKER.test(line));
  const preamble = firstMarker > 0 ? text.split(/\r?\n/).slice(0, firstMarker).join("\n").trim() : "";

  return (
    <>
      {preamble ? <p className={BODY_CLASS}>{renderMathText(preamble)}</p> : null}
      <ol className="flex list-none flex-col gap-1">
        {split.steps.map((step, index) => {
          const number = index + 1;
          const selected = currentStep === number;
          const rest = step.text.replace(LEADING_MARKER, "");
          return (
            <li
              key={step.stepId}
              aria-current={selected ? "step" : undefined}
              className={selected ? "-mx-2 rounded-[10px] bg-fill-tint-brand px-2 py-1.5 ring-1 ring-brand" : "-mx-2 px-2 py-1.5"}
            >
              <p className={BODY_CLASS}>
                <span className="font-[590]">{`${number}단계`}</span>
                {selected ? <span className="sr-only">(그림에 표시 중)</span> : null}
                {rest ? " " : null}
                {renderMathText(rest)}
              </p>
            </li>
          );
        })}
      </ol>
    </>
  );
}
