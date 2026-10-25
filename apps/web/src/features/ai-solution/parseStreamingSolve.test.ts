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

const TAGS = '{"concept_tags": ["일차방정식 > 풀이"]}';

describe("parseStreamingSolve Stage 4 보강(S4-P6)", () => {
  it("`## 최종 답` 바로 아래 JSON 뒤에 답 문장이 오면 JSON 조각 없이 답 문장을 보인다", () => {
    const result = parseStreamingSolve(`## 풀이\nx=5\n## 최종 답\n${TAGS}\n최종 답은 \\(\\boxed{5}\\)입니다.`);
    expect(result.answerSoFar).toBe("최종 답은 \\(\\boxed{5}\\)입니다.");
    expect(result.stepsSoFar).toBe("x=5");
  });

  it("스트리밍 순서대로 어느 접두에서도 답 칸에 JSON 조각(`{\"`·concept_tags)이 보이지 않는다", () => {
    const full = `## 풀이\n\\(\\boxed{5}\\)\n## 최종 답\n${TAGS}\n최종 답은 5입니다.`;
    for (let cut = 0; cut <= full.length; cut += 1) {
      const { answerSoFar, stepsSoFar } = parseStreamingSolve(full.slice(0, cut));
      for (const part of [answerSoFar, stepsSoFar]) {
        expect(part ?? "").not.toContain("concept_tags");
        expect(part ?? "").not.toContain('{"');
      }
    }
    expect(parseStreamingSolve(full).answerSoFar).toBe("최종 답은 5입니다.");
  });

  it("마커가 완성되기 전 꼬리(`{\"`, `{\"concept_ta`)는 숨기고, `{` 하나는 그대로 둔다", () => {
    expect(parseStreamingSolve('## 최종 답\nx=2\n{"').answerSoFar).toBe("x=2");
    expect(parseStreamingSolve('## 최종 답\nx=2\n{"concept_ta').answerSoFar).toBe("x=2");
    expect(parseStreamingSolve("## 최종 답\n\\boxed{").answerSoFar).toBe("\\boxed{");
  });

  it("JSON이 아직 닫히지 않았으면 기존처럼 마커부터 숨긴다", () => {
    expect(parseStreamingSolve('## 최종 답\nx=2\n{"concept_tags": ["이차').answerSoFar).toBe("x=2");
  });

  it("D-4: JSON만 있는 답은 풀이의 마지막 \\boxed{…}를 보인다(없으면 null)", () => {
    expect(parseStreamingSolve(`## 풀이\n\\[\\boxed{x=3}\\]\n## 최종 답\n${TAGS}`).answerSoFar).toBe("\\[\\boxed{x=3}\\]");
    expect(parseStreamingSolve(`## 풀이\nx는 3\n## 최종 답\n${TAGS}`).answerSoFar).toBeNull();
  });

  it("문자열 안 `}`가 있는 JSON도 구간만 지운다", () => {
    expect(parseStreamingSolve('## 최종 답\n{"concept_tags": ["집합 {1} > }"]}\n답').answerSoFar).toBe("답");
  });
});
