import { describe, expect, it } from "vitest";
import { parseStreamingSolve } from "./parseStreamingSolve";

describe("parseStreamingSolve", () => {
  it("헤더가 하나도 없으면 모든 섹션이 null이다", () => {
    expect(parseStreamingSolve("아직 헤더가 오지 않은 텍스트")).toEqual({
      conceptSoFar: null,
      stepsSoFar: null,
      answerSoFar: null,
    });
  });

  it("첫 헤더만 온 경우 해당 섹션만 채워지고 나머지는 null이다(마지막 섹션은 끝까지 잘려도 그대로 나온다)", () => {
    const result = parseStreamingSolve("## 관련 개념\n이차함수는");

    expect(result.conceptSoFar).toBe("이차함수는");
    expect(result.stepsSoFar).toBeNull();
    expect(result.answerSoFar).toBeNull();
  });

  it("여러 헤더가 순서대로 오면 각 섹션이 다음 헤더 전까지로 나뉜다", () => {
    const raw = "## 관련 개념\n개념 설명\n## 풀이\n1단계\n2단계\n## 최종 답\nx=2";

    const result = parseStreamingSolve(raw);

    expect(result.conceptSoFar).toBe("개념 설명");
    expect(result.stepsSoFar).toBe("1단계\n2단계");
    expect(result.answerSoFar).toBe("x=2");
  });

  it("최종 답 섹션이 아직 스트리밍 중이라 뒤가 잘려 있어도 지금까지 온 부분을 그대로 반환한다", () => {
    const raw = "## 최종 답\nx=2이고 y=";

    const result = parseStreamingSolve(raw);

    expect(result.answerSoFar).toBe("x=2이고 y=");
  });

  it("말미의 concept_tags JSON 마커가 완전한 형태로 들어오면 최종 답 섹션에서 잘라낸다", () => {
    const raw = '## 최종 답\nx=2\n{"concept_tags": ["이차함수"]}';

    const result = parseStreamingSolve(raw);

    expect(result.answerSoFar).toBe("x=2");
  });

  it("빈 문자열은 모든 섹션이 null이다", () => {
    expect(parseStreamingSolve("")).toEqual({
      conceptSoFar: null,
      stepsSoFar: null,
      answerSoFar: null,
    });
  });
});
