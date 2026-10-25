/**
 * Stage 4 WU5(D-6) — 카드 표면을 `ElevatedCard`로 바꾼 사용처의 시각 변화 0.
 * 기준: 교체 전 각 사용처 루트 요소의 class 문자열(아래 리터럴, HEAD 74ddd3b 원문)과 **토큰 집합**·**태그**가 같다.
 * (FigurePreviewPage는 `pages/dev/figures/FigurePreviewPage.card.test.tsx`)
 */
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Diagnosis } from "shared-types";
import { DiagnosisCard } from "./DiagnosisCard";
import { RecognizedProblemBar } from "./RecognizedProblemBar";
import { ResultCard } from "./ResultCard";
import { ResumeResultCard } from "./ResumeResultCard";
import { WorkLineList } from "./WorkLineList";

const SURFACE = "bg-bg-elevated rounded-[14px] p-4 drop-shadow-[0px_2px_0px_rgba(35,43,56,0.18),0px_7px_13px_rgba(35,43,56,0.11)]";

function tokens(className: string | null | undefined): string[] {
  return (className ?? "").split(/\s+/).filter(Boolean).sort();
}

const DIAGNOSIS: Diagnosis = {
  lastValidLine: 1,
  stallLine: 2,
  errorTypeLabel: "부호 오류",
  errorDetail: "x",
  relatedConcepts: ["이차함수"],
  reachedAnswerWithNotes: false,
  isLowConfidence: false,
  conceptExplanations: [],
  identifiedMethod: null,
  isMethodApplicable: true,
  methodApplicabilityNote: null,
  problemAnswerLatex: "-1",
};

const CASES: { name: string; before: string; root: () => Element | null }[] = [
  {
    name: "ResultCard(복사본이던 클래스, 순서만 다름)",
    before: "bg-bg-elevated flex flex-col gap-2 rounded-[14px] p-4 drop-shadow-[0px_2px_0px_rgba(35,43,56,0.18),0px_7px_13px_rgba(35,43,56,0.11)]",
    root: () => render(<ResultCard kind="steps" body="풀이" />).container.firstElementChild,
  },
  {
    name: "RecognizedProblemBar(복사본)",
    before: "bg-bg-elevated flex items-center gap-3 rounded-[14px] p-4 drop-shadow-[0px_2px_0px_rgba(35,43,56,0.18),0px_7px_13px_rgba(35,43,56,0.11)]",
    root: () => render(<RecognizedProblemBar recognizedText="문제" />).container.firstElementChild,
  },
  {
    name: "DiagnosisCard",
    before: `${SURFACE} flex flex-col gap-2`,
    root: () => render(<DiagnosisCard diagnosis={DIAGNOSIS} />).container.firstElementChild,
  },
  {
    name: "WorkLineList",
    before: `${SURFACE} flex flex-col gap-3`,
    root: () => render(<WorkLineList lines={[{ lineNo: 1, latex: "x", isValid: true }]} />).container.firstElementChild,
  },
  {
    name: "ResumeResultCard 안쪽 카드",
    before: `${SURFACE} flex flex-col gap-2`,
    root: () =>
      render(<ResumeResultCard solution={{ mode: "own", methodName: "m", solutionMd: "s", answerMd: "1", verified: true }} />).container
        .firstElementChild?.firstElementChild ?? null,
  },
];

describe("ElevatedCard 교체 — 클래스 토큰 집합·태그 동일", () => {
  it.each(CASES.map((c) => [c.name, c] as const))("%s", (_name, c) => {
    const root = c.root();
    expect(root?.tagName).toBe("DIV");
    expect(tokens(root?.getAttribute("class"))).toEqual(tokens(c.before));
  });
});
