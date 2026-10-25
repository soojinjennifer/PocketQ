/**
 * Stage 4 WU0·WU1 — 파서 보강 전 출력 기준값(오라클) 비교(S4-P3·S4-P5 정상 입력 동일).
 *
 * `__baseline__/parseSolveOutput.corpus.json`·`parseResumeOutput.corpus.json`은 파서를 바꾸기 **전**(HEAD 74ddd3b)에
 * 캡처했다. 입력: 합성 경계 사례, Stage 3 실제 모델 전문(`.omc/research/figures-stage3-textcheck.json`),
 * Stage 3 평가 섹션 재구성, Fake 어댑터 출력. `category: "normal"`은 보강 뒤에도 deep-equal이어야 하고,
 * `"abnormal"`(개념 분류 JSON이 끝이 아닌 곳에 있음·JSON만 있는 답·resume 답 칸의 단계 표지)은 의도적으로 바뀐다.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseResumeOutput, type ParsedResumeOutput } from "./parseResumeOutput";
import { parseSolveOutput, type ParsedSolveOutput } from "./parseSolveOutput";

interface CorpusCase<T> {
  id: string;
  source: string;
  category: "normal" | "abnormal";
  input: string;
  output: T;
}

const here = dirname(fileURLToPath(import.meta.url));
function load<T>(name: string): CorpusCase<T>[] {
  return (JSON.parse(readFileSync(join(here, "__baseline__", name), "utf8")) as { cases: CorpusCase<T>[] }).cases;
}

const solveCorpus = load<ParsedSolveOutput>("parseSolveOutput.corpus.json");
const resumeCorpus = load<ParsedResumeOutput>("parseResumeOutput.corpus.json");

describe("parseSolveOutput 기준값(정상 입력은 변경 전과 deep-equal)", () => {
  it("말뭉치 규모: 약 50건 이상, 정상·비정상 모두 있음", () => {
    expect(solveCorpus.length).toBeGreaterThanOrEqual(50);
    expect(solveCorpus.some((c) => c.category === "abnormal")).toBe(true);
  });

  it.each(solveCorpus.filter((c) => c.category === "normal").map((c) => [c.id, c] as const))("%s", (_id, c) => {
    expect(parseSolveOutput(c.input)).toEqual(c.output);
  });
});

describe("parseResumeOutput 기준값(정상 입력은 변경 전과 deep-equal)", () => {
  it.each(resumeCorpus.filter((c) => c.category === "normal").map((c) => [c.id, c] as const))("%s", (_id, c) => {
    expect(parseResumeOutput(c.input)).toEqual(c.output);
  });
});
