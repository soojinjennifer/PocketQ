import { RESUME_HEADERS } from "./prompts/system";

export interface ParsedResumeOutput {
  methodName: string;
  solutionMd: string;
  answerMd: string;
}

const HEADER_ORDER = [RESUME_HEADERS.method, RESUME_HEADERS.solution, RESUME_HEADERS.answer];

/**
 * 스트리밍이 끝난 뒤 누적된 전체 마크다운 텍스트를, `prompts/system.ts`의 `buildResumePrompt`가
 * 지시한 헤더(`## 해법`/`## 이어풀기`/`## 최종 답`) 구조를 기준으로 파싱한다.
 *
 * `parseSolveOutput`과 동일하게 방어적으로 동작한다 — 모델이 헤더 지시를 정확히 따르지 않아도
 * 예외를 던지지 않고 합리적인 값으로 폴백한다(전체 텍스트를 solutionMd로, methodName은 빈 문자열로).
 */
export function parseResumeOutput(fullText: string): ParsedResumeOutput {
  const sections = splitByHeaders(fullText, HEADER_ORDER);

  return {
    methodName: sections[RESUME_HEADERS.method]?.trim() ?? "",
    solutionMd: sections[RESUME_HEADERS.solution] ?? fullText.trim(),
    answerMd: sections[RESUME_HEADERS.answer] ?? "",
  };
}

function splitByHeaders(text: string, headers: string[]): Record<string, string> {
  const positions = headers
    .map((header) => ({ header, index: text.indexOf(header) }))
    .filter((position) => position.index !== -1)
    .sort((a, b) => a.index - b.index);

  const sections: Record<string, string> = {};

  for (let i = 0; i < positions.length; i++) {
    const current = positions[i];
    if (!current) continue;
    const next = positions[i + 1];
    const end = next ? next.index : text.length;
    sections[current.header] = text.slice(current.index + current.header.length, end).trim();
  }

  return sections;
}
