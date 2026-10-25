/**
 * Stage 4 WU0·WU1 — 스트리밍 파서 보강 전 출력 기준값(오라클) 비교.
 *
 * `parseStreamingSolve.corpus.json`은 파서를 바꾸기 **전**(HEAD 74ddd3b)에 서버 말뭉치(`apps/api/.../__baseline__/
 * parseSolveOutput.corpus.json`)의 전문과 접두(25·50·75%, 마커 직전·직후)로 캡처했다. `normal`은 보강 뒤에도
 * deep-equal이어야 한다. `abnormal`(원문이 비정상이거나 접두가 마커 일부(`{"`…)로 끝남)은 의도적으로 바뀐다.
 */
import { describe, expect, it } from "vitest";
import { parseStreamingSolve, type StreamingSolveSections } from "../parseStreamingSolve";
import corpusJson from "./parseStreamingSolve.corpus.json";

interface StreamingCase {
  id: string;
  category: "normal" | "abnormal";
  input: string;
  output: StreamingSolveSections;
}

const corpus = (corpusJson as { cases: StreamingCase[] }).cases;

describe("parseStreamingSolve 기준값(정상 입력은 변경 전과 deep-equal)", () => {
  it.each(corpus.filter((c) => c.category === "normal").map((c) => [c.id, c] as const))("%s", (_id, c) => {
    expect(parseStreamingSolve(c.input)).toEqual(c.output);
  });
});
