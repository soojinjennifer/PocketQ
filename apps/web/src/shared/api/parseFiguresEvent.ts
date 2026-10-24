import type { FigureSpec, StepFigureRef } from "shared-types";

/** `event: figures` 페이로드(서버가 검증을 끝낸 도형만 담는다, `docs/API_SPEC.md`). */
export interface FiguresEventPayload {
  figures: FigureSpec[];
  stepFigureRefs: StepFigureRef[];
}

/**
 * `event: figures`의 data를 읽는다. 깨진 JSON·비객체·`figures` 비배열·빈 배열이면 null(이벤트 무시).
 * 도형 내용은 서버가 검증했으므로 여기서 다시 의미 검증하지 않는다 — 웹 번들에 검증기를 넣지 않기 위해
 * `validation`을 import하지 않는다(S3-14). 렌더링 시 `features/figure-visualization`이 한 번 더 검사한다.
 */
export function parseFiguresEventData(data: string): FiguresEventPayload | null {
  try {
    const parsed: unknown = JSON.parse(data);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
    const record = parsed as Record<string, unknown>;
    const figures = record["figures"];
    if (!Array.isArray(figures) || figures.length === 0) return null;
    const refs = record["stepFigureRefs"];
    return {
      figures: figures as FigureSpec[],
      stepFigureRefs: Array.isArray(refs) ? (refs as StepFigureRef[]) : [],
    };
  } catch {
    return null;
  }
}
