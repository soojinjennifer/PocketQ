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
 *  `CONCEPT_TAGS_MARKER`와 동일 — 스트리밍 도중 이 마커가 (완전한 형태로) 들어오면 최종 답
 *  섹션에 JSON 조각이 그대로 노출되지 않도록 잘라낸다. */
const CONCEPT_TAGS_MARKER = '{"concept_tags"';

export interface StreamingSolveSections {
  conceptSoFar: string | null;
  stepsSoFar: string | null;
  answerSoFar: string | null;
}

export function parseStreamingSolve(rawText: string): StreamingSolveSections {
  const body = stripConceptTagsTail(rawText);
  const sections = splitByHeaders(body, HEADER_ORDER);

  return {
    conceptSoFar: toNonEmpty(sections[STREAMING_SOLVE_HEADERS.concept]),
    stepsSoFar: toNonEmpty(sections[STREAMING_SOLVE_HEADERS.solution]),
    answerSoFar: toNonEmpty(sections[STREAMING_SOLVE_HEADERS.answer]),
  };
}

function stripConceptTagsTail(text: string): string {
  const markerIndex = text.lastIndexOf(CONCEPT_TAGS_MARKER);
  return markerIndex === -1 ? text : text.slice(0, markerIndex).trim();
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
