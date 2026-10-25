/** 스트리밍 중 마지막 줄이 완성된 표지의 앞부분인지(`docs/FIGURE_DESIGN.md` §17.11 정규식). */
const PARTIAL_MARKER_LINE = /^\*{1,2}(\d{1,2}(단(계(\*{1,2})?)?)?)?$/;

/**
 * 스트리밍 중이면 마지막 줄이 미완성 단계 표지(`**2단` 등)일 때 그 줄을 뺀다 — 완성되기 전 별표가 본문에 잠깐
 * 보였다가 머리 라벨로 바뀌어 튀는 것을 막는다(§17.11). 완료 뒤(`streaming=false`)에는 원문 그대로.
 */
export function hidePartialStepMarker(body: string, streaming: boolean): string {
  if (!streaming) return body;
  const lastBreak = body.lastIndexOf("\n");
  const lastLine = body.slice(lastBreak + 1);
  if (!PARTIAL_MARKER_LINE.test(lastLine)) return body;
  return lastBreak === -1 ? "" : body.slice(0, lastBreak);
}
