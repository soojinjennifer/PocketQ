/**
 * 스트리밍 중(아직 끝나지 않아 뒤가 잘려 있을 수 있는) 누적 raw 텍스트를, 완료 후 파서와 같은
 * 헤더 기준으로 미리 나눠서 로딩 단계부터 완료 후와 동일한 카드 구조(관련 개념/단계별 풀이/최종
 * 답)를 채울 수 있게 하는 프론트엔드 전용 순수함수. `SolveLandscapePage`가 `streamedText`를
 * 매 렌더마다 이 함수로 파싱해서 `ResultCard`/`AnswerBox`에 그대로 넘긴다.
 *
 * 헤더 문자열은 `apps/api/src/infrastructure/ai/prompts/system.ts`의 `SOLVE_HEADERS`와
 * 반드시 동기화 유지해야 한다(프론트/백엔드 패키지가 분리돼 있어 직접 import 불가능).
 *
 * 로직은 백엔드 `apps/api/src/infrastructure/ai/parseSolveOutput.ts`의 `splitByHeaders`와
 * 근본적으로 같다 — 각 헤더의 위치를 찾아 다음 헤더가 나오기 전까지를 그 섹션 내용으로
 * 슬라이스한다. 다른 점은, 마지막 섹션이 문자열 끝까지 슬라이스되므로 아직 스트리밍 중이라
 * 뒤가 잘려 있어도 "지금까지 온 부분"이 그대로 반환된다는 것뿐이다(완료 여부를 별도로 검사하지
 * 않는다 — 완료 후에는 `SolveLandscapePage`가 이 함수 대신 구조화된 `solveResult`로 전환한다).
 */

/** 백엔드 `SOLVE_HEADERS`와 동일한 헤더 문자열. 값이 바뀌면 양쪽을 함께 수정해야 한다. */
const STREAMING_SOLVE_HEADERS = {
  concept: "## 관련 개념",
  solution: "## 풀이",
  answer: "## 최종 답",
} as const;

const HEADER_ORDER = [
  STREAMING_SOLVE_HEADERS.concept,
  STREAMING_SOLVE_HEADERS.solution,
  STREAMING_SOLVE_HEADERS.answer,
];

/** 응답 말미에 붙는 `{"concept_tags": [...]}` JSON의 시작 마커. 백엔드 `parseSolveOutput.ts`의
 *  `CONCEPT_TAGS_MARKER`와 동일 — 스트리밍 도중 최종 답 섹션에 JSON 조각이 노출되지 않도록 숨긴다
 *  (`stripConceptTags` 참고, Stage 4에서 서버와 같은 구간 규칙으로 보강). */
const CONCEPT_TAGS_MARKER = '{"concept_tags"';

export interface StreamingSolveSections {
  conceptSoFar: string | null;
  stepsSoFar: string | null;
  answerSoFar: string | null;
}

export function parseStreamingSolve(rawText: string): StreamingSolveSections {
  const { body, jsonRemoved } = stripConceptTags(rawText);
  const sections = splitByHeaders(body, HEADER_ORDER);
  const stepsSoFar = toNonEmpty(sections[STREAMING_SOLVE_HEADERS.solution]);
  let answerSoFar = toNonEmpty(sections[STREAMING_SOLVE_HEADERS.answer]);

  // D-4(서버 `parseSolveOutput`과 같은 규칙): 완성된 JSON을 지웠는데 `## 최종 답`이 비면 풀이의 마지막 `\boxed{…}`.
  if (jsonRemoved && sections[STREAMING_SOLVE_HEADERS.answer] === "") {
    const boxed = lastBoxed(stepsSoFar);
    answerSoFar = boxed === null ? null : `\\[${boxed}\\]`;
  }

  return {
    conceptSoFar: toNonEmpty(sections[STREAMING_SOLVE_HEADERS.concept]),
    stepsSoFar,
    answerSoFar,
  };
}

/**
 * 개념 분류 JSON을 화면에서 숨긴다(Stage 4, 서버 `parseSolveOutput`과 같은 구간 규칙).
 * - 마커가 없으면: 끝이 마커의 앞부분(`{"`, `{"con`…)이면 그 꼬리만 숨긴다(다음 청크에서 마커가 완성될 수 있음).
 * - 마커가 있고 JSON이 아직 안 닫혔거나(스트리밍 중) JSON이 아니면: 기존처럼 마커부터 끝까지 숨긴다.
 * - JSON이 닫혔고 파싱되면: 뒤가 공백뿐이면 기존과 같고, 뒤에 답 문장이 있으면 **JSON 구간만** 지워 답 문장을 보인다.
 */
function stripConceptTags(text: string): { body: string; jsonRemoved: boolean } {
  const markerIndex = text.lastIndexOf(CONCEPT_TAGS_MARKER);
  if (markerIndex === -1) return { body: hidePartialMarkerTail(text), jsonRemoved: false };

  const end = findJsonObjectEnd(text, markerIndex);
  if (end === -1 || !isJson(text.slice(markerIndex, end))) {
    return { body: text.slice(0, markerIndex).trim(), jsonRemoved: false };
  }
  if (text.slice(end).trim() === "") return { body: text.slice(0, markerIndex).trim(), jsonRemoved: true };
  return { body: hidePartialMarkerTail(removeJsonSpan(text, markerIndex, end)), jsonRemoved: true };
}

/** 마커 앞부분으로 볼 최소 길이 — `{` 하나는 LaTeX(`\boxed{`)에 흔해서 숨기지 않는다. */
const MIN_PARTIAL_MARKER_LENGTH = 2;

function hidePartialMarkerTail(text: string): string {
  for (let length = CONCEPT_TAGS_MARKER.length - 1; length >= MIN_PARTIAL_MARKER_LENGTH; length -= 1) {
    if (text.endsWith(CONCEPT_TAGS_MARKER.slice(0, length))) return text.slice(0, text.length - length).trimEnd();
  }
  return text;
}

function isJson(candidate: string): boolean {
  try {
    JSON.parse(candidate);
    return true;
  } catch {
    return false;
  }
}

/** 서버 `parseSolveOutput.ts`의 `findJsonObjectEnd`와 같다(문자열·이스케이프 인식 중괄호 매칭). */
function findJsonObjectEnd(text: string, start: number): number {
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

/** 서버 `parseSolveOutput.ts`의 `removeJsonSpan`과 같다(코드 펜스까지 지우고 줄바꿈 하나를 합친다). */
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

/** 서버 `parseSolveOutput.ts`의 `lastBoxed`와 같다. */
function lastBoxed(md: string | null): string | null {
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

function toNonEmpty(value: string | undefined): string | null {
  return value && value.length > 0 ? value : null;
}
