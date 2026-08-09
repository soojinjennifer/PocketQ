import { describe, expect, it } from "vitest";
import { parseSolveOutput } from "./parseSolveOutput";

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
