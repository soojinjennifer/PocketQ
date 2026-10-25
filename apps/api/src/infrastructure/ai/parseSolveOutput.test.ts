import { describe, expect, it, vi } from "vitest";
import { findJsonObjectEnd, lastBoxed, parseSolveOutput } from "./parseSolveOutput";

describe("parseSolveOutput", () => {
  it("개념/풀이/답 3개 섹션과 concept_tags를 모두 정확히 분리한다", () => {
    const text = [
      "## 관련 개념",
      "이차함수의 최솟값은 꼭짓점의 y좌표입니다.",
      "",
      "## 풀이",
      "1. 완전제곱식으로 변형합니다.",
      "2. 꼭짓점의 좌표를 구합니다.",
      "",
      "## 최종 답",
      "최솟값은 -1입니다.",
      '{"concept_tags": ["이차함수 > 최대·최소"]}',
    ].join("\n");

    const result = parseSolveOutput(text);

    expect(result.conceptMd).toBe("이차함수의 최솟값은 꼭짓점의 y좌표입니다.");
    expect(result.solutionMd).toContain("완전제곱식으로 변형합니다.");
    expect(result.answerMd).toBe("최솟값은 -1입니다.");
    expect(result.conceptTags).toEqual(["이차함수 > 최대·최소"]);
  });

  it("개념 옵션이 요청되지 않아 헤더가 없으면 conceptMd는 null이다", () => {
    const text = ["## 풀이", "완전제곱식으로 변형합니다.", "", "## 최종 답", "답은 3입니다."].join("\n");

    const result = parseSolveOutput(text);

    expect(result.conceptMd).toBeNull();
    expect(result.solutionMd).toContain("완전제곱식으로 변형합니다.");
    expect(result.answerMd).toBe("답은 3입니다.");
  });

  it("concept_tags JSON이 없거나 손상돼도 예외를 던지지 않고 빈 배열로 폴백한다", () => {
    const text = ["## 최종 답", "답은 3입니다."].join("\n");

    const result = parseSolveOutput(text);

    expect(result.conceptTags).toEqual([]);
    expect(result.answerMd).toBe("답은 3입니다.");
  });

  it("최종 답에 \\boxed{} 같은 중괄호가 있어도 잘리지 않고 concept_tags를 정확히 분리한다", () => {
    const text = [
      "## 최종 답",
      String.raw`\[\boxed{x=2,\ 3}\]`,
      "",
      '{"concept_tags":["이차방정식 > 인수분해를 이용한 풀이"]}',
    ].join("\n");

    const result = parseSolveOutput(text);

    expect(result.answerMd).toBe(String.raw`\[\boxed{x=2,\ 3}\]`);
    expect(result.conceptTags).toEqual(["이차방정식 > 인수분해를 이용한 풀이"]);
  });

  it("헤더가 전혀 없으면 전체 텍스트를 answerMd로 폴백한다", () => {
    const result = parseSolveOutput("그냥 아무 텍스트");

    expect(result.conceptMd).toBeNull();
    expect(result.solutionMd).toBeNull();
    expect(result.answerMd).toBe("그냥 아무 텍스트");
    expect(result.conceptTags).toEqual([]);
  });
});

const TAGS = '{"concept_tags": ["일차방정식 > 풀이"]}';

describe("parseSolveOutput Stage 4 보강(S4-P1·P2·P3)", () => {
  it("S4-P1: `## 최종 답` 바로 아래 JSON + 답 문장 → 태그 보존, answerMd에 JSON 0, 답 문장 유지", () => {
    const text = ["## 풀이", "x = 5", "", "## 최종 답", TAGS, String.raw`최종 답은 \(\boxed{5}\)입니다.`].join("\n");
    const onAnswerFallback = vi.fn();

    const result = parseSolveOutput(text, { onAnswerFallback });

    expect(result.conceptTags).toEqual(["일차방정식 > 풀이"]);
    expect(result.answerMd).toBe(String.raw`최종 답은 \(\boxed{5}\)입니다.`);
    expect(result.answerMd).not.toContain("concept_tags");
    expect(result.solutionMd).toBe("x = 5");
    expect(onAnswerFallback).not.toHaveBeenCalled();
  });

  it("S4-P1: 실제 모델 사례(X4 on) — JSON 뒤 답 문장이 남고 태그가 살아난다", () => {
    const text =
      "## 풀이\n**1단계** 그림이 없어 조건을 알 수 없습니다.\n\n## 최종 답\n" +
      '{"concept_tags": ["사각형 > 내각과 외각"]}\n그림을 첨부하거나, 그림에 적힌 각의 크기와 평행 표시 등을 글로 알려 주세요.';

    const result = parseSolveOutput(text, { onAnswerFallback: () => undefined });

    expect(result.conceptTags).toEqual(["사각형 > 내각과 외각"]);
    expect(result.answerMd).toBe("그림을 첨부하거나, 그림에 적힌 각의 크기와 평행 표시 등을 글로 알려 주세요.");
  });

  it("S4-P2(D-4): JSON만 있는 답 → 태그 보존, 풀이 섹션 마지막 \\boxed{…}를 답으로(폴백 boxed 1회)", () => {
    const text = ["## 풀이", String.raw`**1단계** \[\boxed{x=3}\]`, String.raw`**2단계** \(\boxed{\frac{1}{2}}\)`, "", "## 최종 답", TAGS].join("\n");
    const onAnswerFallback = vi.fn();

    const result = parseSolveOutput(text, { onAnswerFallback });

    expect(result.conceptTags).toEqual(["일차방정식 > 풀이"]);
    expect(result.answerMd).toBe(String.raw`\[\boxed{\frac{1}{2}}\]`);
    expect(onAnswerFallback).toHaveBeenCalledTimes(1);
    expect(onAnswerFallback).toHaveBeenCalledWith("boxed");
  });

  it("S4-P2(D-4): JSON만 있는 답 + 풀이에 \\boxed 없음 → 빈 값(근거 없는 답 생성 금지), 폴백 empty", () => {
    const text = ["## 풀이", "정리하면 x는 3입니다.", "", "## 최종 답", TAGS].join("\n");
    const onAnswerFallback = vi.fn();

    const result = parseSolveOutput(text, { onAnswerFallback });

    expect(result.conceptTags).toEqual(["일차방정식 > 풀이"]);
    expect(result.answerMd).toBe("");
    expect(onAnswerFallback).toHaveBeenCalledWith("empty");
  });

  it("S4-P2(D-4): `## 최종 답` 아래 JSON만 있고 그 뒤가 공백뿐이어도 같은 규칙", () => {
    const text = `## 풀이\n\\(\\boxed{7}\\)\n\n## 최종 답\n\n${TAGS}\n  \n`;
    expect(parseSolveOutput(text, { onAnswerFallback: () => undefined }).answerMd).toBe(String.raw`\[\boxed{7}\]`);
  });

  it("JSON이 풀이 중간에 있으면 그 구간만 지우고 앞뒤 문장을 보존한다", () => {
    const text = `## 풀이\n풀이 앞\n${TAGS}\n풀이 뒤\n\n## 최종 답\n5`;
    const result = parseSolveOutput(text);
    expect(result.solutionMd).toBe("풀이 앞\n풀이 뒤");
    expect(result.answerMd).toBe("5");
    expect(result.conceptTags).toEqual(["일차방정식 > 풀이"]);
  });

  it("JSON이 코드 펜스 안에 있으면 펜스까지 지운다", () => {
    const text = "## 최종 답\n5\n```json\n" + TAGS + "\n```\n";
    const result = parseSolveOutput(text);
    expect(result.answerMd).toBe("5");
    expect(result.conceptTags).toEqual(["일차방정식 > 풀이"]);
  });

  it("S4-P3: 문자열 안 `}`·`{`가 있는 JSON 뒤에 답 문장이 와도 JSON 구간만 정확히 지운다", () => {
    const text = '## 최종 답\n{"concept_tags": ["집합 {1, 2} > 원소}"]}\n' + String.raw`\(\{1, 2\}\)`;
    const result = parseSolveOutput(text);
    expect(result.conceptTags).toEqual(["집합 {1, 2} > 원소}"]);
    expect(result.answerMd).toBe(String.raw`\(\{1, 2\}\)`);
  });

  it("S4-P3: 정상 입력(JSON 맨 끝·없음·깨진 JSON·\\boxed 중괄호·문자열 안 `}`·마커 2회)은 기존과 같다", () => {
    expect(parseSolveOutput(`## 최종 답\n\\boxed{5}\n${TAGS}`)).toEqual({ conceptMd: null, solutionMd: null, answerMd: "\\boxed{5}", conceptTags: ["일차방정식 > 풀이"] });
    expect(parseSolveOutput("## 최종 답\n5")).toEqual({ conceptMd: null, solutionMd: null, answerMd: "5", conceptTags: [] });
    expect(parseSolveOutput('## 최종 답\n5\n{"concept_tags": ["a",]}')).toEqual({ conceptMd: null, solutionMd: null, answerMd: '5\n{"concept_tags": ["a",]}', conceptTags: [] });
    expect(parseSolveOutput('## 최종 답\n5\n{"concept_tags": ["a } b"]}')).toEqual({ conceptMd: null, solutionMd: null, answerMd: "5", conceptTags: ["a } b"] });
    expect(parseSolveOutput('## 최종 답\n5\n{"concept_tags": ["a"]}\n{"concept_tags": ["b"]}')).toEqual({ conceptMd: null, solutionMd: null, answerMd: '5\n{"concept_tags": ["a"]}', conceptTags: ["b"] });
  });

  it("짝이 맞아도 JSON이 아니면(파싱 실패) 기존 폴백 — 전체 텍스트, 태그 []", () => {
    const text = '## 최종 답\n{"concept_tags": [a]}\n답 5';
    expect(parseSolveOutput(text)).toEqual({ conceptMd: null, solutionMd: null, answerMd: '{"concept_tags": [a]}\n답 5', conceptTags: [] });
  });

  it("답 헤더가 없으면 D-4를 적용하지 않는다(기존 body 폴백)", () => {
    const onAnswerFallback = vi.fn();
    expect(parseSolveOutput(TAGS, { onAnswerFallback }).answerMd).toBe("");
    expect(onAnswerFallback).not.toHaveBeenCalled();
  });

  it("폴백 콜백이 throw해도 파싱은 계속된다", () => {
    const text = `## 최종 답\n${TAGS}`;
    expect(() =>
      parseSolveOutput(text, {
        onAnswerFallback: () => {
          throw new Error("log");
        },
      }),
    ).not.toThrow();
  });
});

describe("findJsonObjectEnd / lastBoxed", () => {
  it("문자열·이스케이프를 인식하고, 짝이 없거나 문자열이 줄바꿈 전에 안 닫히면 -1", () => {
    expect(findJsonObjectEnd('{"a":"}"}x', 0)).toBe(9);
    expect(findJsonObjectEnd('{"a":"\\"}"}x', 0)).toBe(11);
    expect(findJsonObjectEnd('{"a":{"b":1}}', 0)).toBe(13);
    expect(findJsonObjectEnd('{"a":[1', 0)).toBe(-1);
    expect(findJsonObjectEnd('{"a":"x\n"}', 0)).toBe(-1);
  });

  it("마지막 \\boxed{…}를 중첩·이스케이프 중괄호까지 짝 맞춰 찾는다", () => {
    expect(lastBoxed(String.raw`\boxed{1} 그리고 \boxed{\frac{1}{2}}`)).toBe(String.raw`\boxed{\frac{1}{2}}`);
    expect(lastBoxed(String.raw`\boxed{\{1, 2\}}`)).toBe(String.raw`\boxed{\{1, 2\}}`);
    expect(lastBoxed(String.raw`\boxed{1`)).toBeNull();
    expect(lastBoxed(null)).toBeNull();
    expect(lastBoxed("없음")).toBeNull();
  });
});
