/**
 * Stage 4 WU0 — 단계 표지가 없는 결과 카드의 DOM 기준값(S4-6 "표지 없으면 WU0 DOM 동일").
 *
 * `resultDom.baseline.json`은 Stage 4 코드를 바꾸기 **전**(HEAD 74ddd3b)에 `resultDom.cases.json`의 입력으로
 * 렌더링한 `container.innerHTML`이다. 이 테스트는 현재 코드로 같은 입력을 렌더링해 비교한다.
 *
 * WU5(D-6, `docs/FIGURE_DESIGN.md` §17.10)에서 카드 표면을 `ElevatedCard`로 바꾸면서 `ResultCard`·`RecognizedProblemBar`의
 * class 문자열 **순서**만 바뀌었다(Tailwind는 순서와 무관). 그래서 비교 전에 모든 요소의 class 토큰을 정렬한다 —
 * 태그·속성·텍스트·class 토큰 집합은 여전히 문자 단위로 같아야 한다.
 */
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import type { ResumeSolution } from "shared-types";
import { ResultCard } from "../ResultCard";
import { ResultPanel } from "../ResultPanel";
import { ResumeResultCard } from "../ResumeResultCard";
import baselineJson from "./resultDom.baseline.json";
import casesJson from "./resultDom.cases.json";

interface ResultCardCase {
  id: string;
  component: "ResultCard";
  props: { kind: "concept" | "steps"; title?: string; body: string };
}
interface ResumeResultCardCase {
  id: string;
  component: "ResumeResultCard";
  props: { solution: ResumeSolution };
}
interface ResultPanelCase {
  id: string;
  component: "ResultPanel";
  props: {
    category?: string;
    recognizedText: string;
    editLabel?: string;
    hasOnEdit?: boolean;
    conceptMd: string | null;
    solutionMd: string | null;
    answerMd: string;
    chatContentText?: string;
    chatFooterText?: string;
  };
}
type DomCase = ResultCardCase | ResumeResultCardCase | ResultPanelCase;

const cases = (casesJson as { cases: DomCase[] }).cases;
const baseline = (baselineJson as { html: Record<string, string> }).html;

/** 모든 요소의 class 토큰을 정렬한 innerHTML(토큰 집합이 같으면 같은 문자열). */
function normalizeClassOrder(html: string): string {
  const template = document.createElement("template");
  template.innerHTML = html;
  for (const node of template.content.querySelectorAll("[class]")) {
    node.setAttribute("class", [...node.classList].sort().join(" "));
  }
  return template.innerHTML;
}

function element(c: DomCase): ReactElement {
  switch (c.component) {
    case "ResultCard":
      return <ResultCard kind={c.props.kind} title={c.props.title} body={c.props.body} />;
    case "ResumeResultCard":
      return <ResumeResultCard solution={c.props.solution} />;
    case "ResultPanel": {
      const p = c.props;
      return (
        <ResultPanel
          category={p.category}
          recognizedText={p.recognizedText}
          onEdit={p.hasOnEdit ? () => undefined : undefined}
          editLabel={p.editLabel}
          conceptMd={p.conceptMd}
          solutionMd={p.solutionMd}
          answerMd={p.answerMd}
          chatContent={p.chatContentText ? <p>{p.chatContentText}</p> : undefined}
          chatFooter={p.chatFooterText ? <p>{p.chatFooterText}</p> : undefined}
        />
      );
    }
  }
}

describe("결과 카드 DOM 기준값(변경 전 캡처, 단계 표지 없음)", () => {
  it("기준값이 모든 입력을 덮는다", () => {
    expect(Object.keys(baseline).sort()).toEqual(cases.map((c) => c.id).sort());
  });

  it.each(cases.map((c) => [c.id, c] as const))("%s", (id, c) => {
    const { container } = render(element(c));
    expect(normalizeClassOrder(container.innerHTML)).toBe(normalizeClassOrder(baseline[id] ?? ""));
  });
});
