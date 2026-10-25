/**
 * Stage 4 D-5 — 이어풀기 `## 최종 답` 방어(S4-P5). 정상 입력은 `parseOutput.baseline.test.ts`가 변경 전과 deep-equal을 확인한다.
 */
import { describe, expect, it } from "vitest";
import { parseResumeOutput } from "./parseResumeOutput";

describe("parseResumeOutput D-5", () => {
  it("`## 최종 답`의 줄 맨 앞 `**N단계**` 표지 토큰을 지운다(재작업 1 L-B: 같은 줄의 나머지 내용은 남김)", () => {
    const text = "## 해법\n방법\n\n## 이어풀기\n**1단계** a\n\n## 최종 답\n**2단계** 따라서 답은\n\\[\n-1\n\\]";
    expect(parseResumeOutput(text)).toEqual({ methodName: "방법", solutionMd: "**1단계** a", answerMd: "따라서 답은\n\\[\n-1\n\\]" });
  });

  it("`## 최종 답`의 개념 분류 JSON 줄을 지운다", () => {
    const text = '## 해법\n방법\n\n## 이어풀기\n풀이\n\n## 최종 답\n\\[\n-1\n\\]\n{"concept_tags": ["a"]}';
    expect(parseResumeOutput(text).answerMd).toBe("\\[\n-1\n\\]");
  });

  it("둘 다 섞여도(앞 공백 포함) 표지 토큰과 개념 JSON 줄만 지운다", () => {
    const text = '## 최종 답\n  **3단계** 정리\n-1\n {"concept_tags":["a"]}';
    expect(parseResumeOutput(text).answerMd).toBe("정리\n-1");
  });

  it("재작업 1 L-B: `**3단계** 3`처럼 표지와 같은 줄의 답은 남기고, 표지만 있는 줄은 빠진다", () => {
    expect(parseResumeOutput("## 최종 답\n**3단계** 3").answerMd).toBe("3");
    expect(parseResumeOutput("## 최종 답\n**3단계** \\(2\\sqrt{3}\\)").answerMd).toBe("\\(2\\sqrt{3}\\)");
    expect(parseResumeOutput("## 최종 답\n**3단계**\n\\[\n1\n\\]").answerMd).toBe("\\[\n1\n\\]");
  });

  it("지울 줄이 없으면 원래 문자열 그대로(줄 중간 표지·굵은 글씨·CRLF 유지)", () => {
    expect(parseResumeOutput("## 최종 답\n답은 **1단계**가 아니다\n\\[1\\]").answerMd).toBe("답은 **1단계**가 아니다\n\\[1\\]");
    expect(parseResumeOutput("## 최종 답\r\n2\\sqrt{3}\r\n").answerMd).toBe("2\\sqrt{3}");
    expect(parseResumeOutput("## 최종 답\n**답** 5").answerMd).toBe("**답** 5");
  });

  it("단계 표지는 이어풀기 섹션에서는 그대로 둔다(단계 분할용)", () => {
    const text = "## 이어풀기\n**1단계** a\n**2단계** b\n\n## 최종 답\n-1";
    expect(parseResumeOutput(text).solutionMd).toBe("**1단계** a\n**2단계** b");
  });

  it("후속 정리 N-1: 표지와 개념 JSON이 한 줄이면 둘 다 지운다(다른 줄의 답은 유지)", () => {
    expect(parseResumeOutput('## 최종 답\n**3단계** {"concept_tags":["a"]}\n\\[1\\]').answerMd).toBe("\\[1\\]");
    expect(parseResumeOutput('## 최종 답\n**3단계** {"concept_tags":["a"]}').answerMd).toBe("");
    expect(parseResumeOutput('## 최종 답\n  **2단계**   {"concept_tags": ["a", "b"]}\n-1').answerMd).toBe("-1");
    // 표지 뒤 내용이 JSON이 아니면 기존(L-B)대로 남긴다.
    expect(parseResumeOutput("## 최종 답\n**3단계** 3").answerMd).toBe("3");
  });
});
