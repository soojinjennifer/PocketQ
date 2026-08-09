import { SOLVE_HEADERS } from "./prompts/system";

export interface ParsedSolveOutput {
  conceptMd: string | null;
  solutionMd: string | null;
  answerMd: string;
  conceptTags: string[];
}

const HEADER_ORDER = [SOLVE_HEADERS.concept, SOLVE_HEADERS.solution, SOLVE_HEADERS.answer];

/**
 * 스트리밍이 끝난 뒤 누적된 전체 마크다운 텍스트를, `prompts/system.ts`의
 * `buildSystemPrompt`가 지시한 헤더(`## 관련 개념`/`## 풀이`/`## 최종 답`) 구조와
 * 말미의 `{"concept_tags": [...]}` JSON 블록을 기준으로 순수하게 파싱한다.
 *
 * 방어적으로 동작한다 — 모델이 지시를 정확히 따르지 않아도(헤더 누락, JSON 파싱 실패 등)
 * 예외를 던지지 않고 최대한 합리적인 값으로 폴백한다(전체 텍스트를 answerMd로, concept_tags는 빈 배열로).
 */
export function parseSolveOutput(fullText: string): ParsedSolveOutput {
  const { body, conceptTags } = extractConceptTags(fullText);
  const sections = splitByHeaders(body, HEADER_ORDER);

  return {
    conceptMd: sections[SOLVE_HEADERS.concept] ?? null,
    solutionMd: sections[SOLVE_HEADERS.solution] ?? null,
    answerMd: sections[SOLVE_HEADERS.answer] ?? body.trim(),
    conceptTags,
  };
}

function extractConceptTags(fullText: string): { body: string; conceptTags: string[] } {
  const match = fullText.match(/\{[\s\S]*"concept_tags"[\s\S]*\}\s*$/);
  if (!match || match.index === undefined) {
    return { body: fullText, conceptTags: [] };
  }

  const body = fullText.slice(0, match.index).trim();

  try {
    const parsed = JSON.parse(match[0]) as { concept_tags?: unknown };
    const tags = Array.isArray(parsed.concept_tags)
      ? parsed.concept_tags.filter((tag): tag is string => typeof tag === "string")
      : [];
    return { body, conceptTags: tags };
  } catch {
    return { body, conceptTags: [] };
  }
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
