import { isTestEnv } from "../../config/env";
import { SOLVE_HEADERS } from "./prompts/system";

export interface ParsedSolveOutput {
  conceptMd: string | null;
  solutionMd: string | null;
  answerMd: string;
  conceptTags: string[];
}

/** D-4 답 칸 폴백 결과(로그 지표). `boxed` = 풀이 섹션 마지막 `\boxed{…}`, `empty` = 근거 없음 → 빈 값. */
export type SolveAnswerFallback = "boxed" | "empty";

export interface ParseSolveOutputOptions {
  /** D-4 폴백이 일어났을 때 1회 호출된다(내용 없이 종류만). 기본: 테스트 환경이 아니면 구조화 로그. */
  onAnswerFallback?: (fallback: SolveAnswerFallback) => void;
}

const HEADER_ORDER = [SOLVE_HEADERS.concept, SOLVE_HEADERS.solution, SOLVE_HEADERS.answer];

function defaultOnAnswerFallback(fallback: SolveAnswerFallback): void {
  if (isTestEnv) return;
  console.info(JSON.stringify({ event: "solve_answer_fallback", fallback }));
}

/**
 * 스트리밍이 끝난 뒤 누적된 전체 마크다운 텍스트를, `prompts/system.ts`의
 * `buildSystemPrompt`가 지시한 헤더(`## 관련 개념`/`## 풀이`/`## 최종 답`) 구조와
 * 말미의 `{"concept_tags": [...]}` JSON 블록을 기준으로 순수하게 파싱한다.
 *
 * 방어적으로 동작한다 — 모델이 지시를 정확히 따르지 않아도(헤더 누락, JSON 파싱 실패 등)
 * 예외를 던지지 않고 최대한 합리적인 값으로 폴백한다(전체 텍스트를 answerMd로, concept_tags는 빈 배열로).
 *
 * Stage 4 보강(승인 계획 O-1·D-4, `docs/FIGURE_SPEC.md`):
 * - 개념 분류 JSON이 끝이 아닌 곳(예: `## 최종 답` 바로 아래)에 있어도 **JSON 구간만** 지우고 태그를 살린다
 *   (문자열 안의 `{`/`}`를 인식하는 중괄호 매칭). JSON이 끝에 있는 정상 입력은 기존과 같은 경로라 결과가 같다.
 * - JSON을 지운 뒤 `## 최종 답`이 비면(답 문장 없음) 풀이 섹션의 마지막 `\boxed{…}`를 답으로 쓰고, 그것도 없으면
 *   빈 값으로 둔다(근거 없는 답을 만들지 않는다). 폴백은 `onAnswerFallback`으로 알린다.
 */
export function parseSolveOutput(fullText: string, options: ParseSolveOutputOptions = {}): ParsedSolveOutput {
  const { body, conceptTags, jsonFound } = extractConceptTags(fullText);
  const sections = splitByHeaders(body, HEADER_ORDER);
  const solutionMd = sections[SOLVE_HEADERS.solution] ?? null;
  let answerMd = sections[SOLVE_HEADERS.answer] ?? body.trim();

  if (jsonFound && sections[SOLVE_HEADERS.answer] === "") {
    const boxed = lastBoxed(solutionMd);
    answerMd = boxed === null ? "" : `\\[${boxed}\\]`;
    try {
      (options.onAnswerFallback ?? defaultOnAnswerFallback)(boxed === null ? "empty" : "boxed");
    } catch {
      // 로그 실패는 무시한다.
    }
  }

  return {
    conceptMd: sections[SOLVE_HEADERS.concept] ?? null,
    solutionMd,
    answerMd,
    conceptTags,
  };
}

const CONCEPT_TAGS_MARKER = '{"concept_tags"';

/** JSON 후보를 파싱해 태그를 돌려준다. JSON이 아니면 null(기존 동작: 태그가 배열이 아니면 []). */
function readConceptTags(candidate: string): string[] | null {
  try {
    const parsed = JSON.parse(candidate) as { concept_tags?: unknown };
    return Array.isArray(parsed.concept_tags)
      ? parsed.concept_tags.filter((tag): tag is string => typeof tag === "string")
      : [];
  } catch {
    return null;
  }
}

/**
 * 답 본문(LaTeX `\boxed{}`, 집합 표기 등)에도 `{`/`}`가 흔히 등장하므로,
 * 첫 `{`부터 그리디하게 찾는 정규식은 본문 중괄호에 잘못 걸린다.
 * 프롬프트가 지시한 정확한 마커 문자열의 마지막 등장 위치를 기준으로 잘라낸다.
 *
 * 1) 기존 경로: 마커부터 끝까지가 JSON이면 그대로(정상 입력 결과 불변).
 * 2) 보강 경로: 아니면 마커에서 시작하는 JSON 객체의 끝을 문자열 인식 중괄호 매칭으로 찾아, 파싱되면 그 구간만 지운다.
 * 3) 둘 다 실패하면 기존 폴백(전체 텍스트, 태그 []).
 */
function extractConceptTags(fullText: string): { body: string; conceptTags: string[]; jsonFound: boolean } {
  const markerIndex = fullText.lastIndexOf(CONCEPT_TAGS_MARKER);
  if (markerIndex === -1) {
    return { body: fullText, conceptTags: [], jsonFound: false };
  }

  const tailTags = readConceptTags(fullText.slice(markerIndex).trim());
  if (tailTags !== null) {
    return { body: fullText.slice(0, markerIndex).trim(), conceptTags: tailTags, jsonFound: true };
  }

  const end = findJsonObjectEnd(fullText, markerIndex);
  if (end !== -1) {
    const spanTags = readConceptTags(fullText.slice(markerIndex, end));
    if (spanTags !== null) {
      return { body: removeJsonSpan(fullText, markerIndex, end), conceptTags: spanTags, jsonFound: true };
    }
  }

  return { body: fullText, conceptTags: [], jsonFound: false };
}

/**
 * `text[start]`의 `{`와 짝이 맞는 `}` 다음 위치. JSON 문자열(`"…"`, 이스케이프 포함) 안의 중괄호는 세지 않는다.
 * 짝이 없거나 문자열이 줄바꿈 전에 닫히지 않으면(-JSON 아님) -1.
 */
export function findJsonObjectEnd(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      else if (ch === "\n") return -1;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

/** JSON 구간을 지운다. 바로 앞뒤가 코드 펜스(```json … ```)면 펜스도 지우고, 남는 줄바꿈 하나를 합친다. */
function removeJsonSpan(text: string, start: number, end: number): string {
  let before = text.slice(0, start);
  let after = text.slice(end);
  const fenceOpen = /(^|\n)[ \t]*```[A-Za-z]*[ \t]*\r?\n[ \t]*$/.exec(before);
  const fenceClose = /^[ \t]*\r?\n[ \t]*```[ \t]*(?=\r?\n|$)/.exec(after);
  if (fenceOpen && fenceClose) {
    before = before.slice(0, fenceOpen.index + (fenceOpen[1] ?? "").length);
    after = after.slice(fenceClose[0].length);
  }
  if (/\n[ \t]*$/.test(before) || before === "") after = after.replace(/^[ \t]*\r?\n/, "");
  return before + after;
}

/** 마지막 `\boxed{…}`(짝이 맞는 중괄호, `\{`·`\}`는 세지 않음). 없거나 닫히지 않으면 null. */
export function lastBoxed(md: string | null): string | null {
  if (!md) return null;
  const start = md.lastIndexOf("\\boxed{");
  if (start === -1) return null;
  let depth = 0;
  for (let i = start + "\\boxed".length; i < md.length; i += 1) {
    const ch = md[i];
    if (ch === "\\") {
      i += 1;
      continue;
    }
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return md.slice(start, i + 1);
    }
  }
  return null;
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
