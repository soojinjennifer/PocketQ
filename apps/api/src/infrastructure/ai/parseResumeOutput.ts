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
  const answerMd = sections[RESUME_HEADERS.answer];

  return {
    methodName: sections[RESUME_HEADERS.method]?.trim() ?? "",
    solutionMd: sections[RESUME_HEADERS.solution] ?? fullText.trim(),
    answerMd: answerMd === undefined ? "" : stripNonAnswerLines(answerMd),
  };
}

/** 줄 맨 앞(앞 공백 허용)의 `**N단계**` 표지와 바로 뒤 공백. */
const STEP_MARKER_LINE = /^[ \t]*\*\*[0-9]+단계\*\*[ \t]*/;
/** 줄 맨 앞(앞 공백 허용)의 개념 분류 JSON. */
const CONCEPT_TAGS_LINE = /^[ \t]*\{"concept_tags"/;

/**
 * Stage 4 D-5 — `## 최종 답`은 CAS가 파싱하는 순수 LaTeX여야 한다. 모델이 단계 표지나 개념 분류 JSON 줄을 섞으면 CAS가
 * 실패하므로 지운다. 재작업 1(QA L-B): 단계 표지는 **표지 토큰만** 지우고 같은 줄의 나머지 내용(예: `**3단계** 3` → `3`)은
 * 남긴다(표지만 있는 줄은 빈 줄이 되어 빠진다). 개념 분류 JSON 줄은 줄째 지운다. 지울 것이 없으면(정상 입력) 원래 문자열 그대로.
 */
function stripNonAnswerLines(answerMd: string): string {
  const lines = answerMd.split("\n");
  let changed = false;
  const kept: string[] = [];
  for (const line of lines) {
    if (CONCEPT_TAGS_LINE.test(line)) {
      changed = true;
      continue;
    }
    if (STEP_MARKER_LINE.test(line)) {
      changed = true;
      const rest = line.replace(STEP_MARKER_LINE, "");
      // 후속 정리 N-1: 표지를 지운 나머지가 개념 분류 JSON이면(`**3단계** {"concept_tags":…}`) 그것도 지운다.
      if (rest.trim() !== "" && !CONCEPT_TAGS_LINE.test(rest)) kept.push(rest);
      continue;
    }
    kept.push(line);
  }
  return changed ? kept.join("\n").trim() : answerMd;
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
