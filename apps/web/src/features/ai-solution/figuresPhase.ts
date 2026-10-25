/**
 * 풀이·이어풀기 스트림의 도형 수신 단계(Stage 4, 승인 계획 §3 "훅 figuresPhase").
 *
 * - `idle`: 요청 전, 요청 중(아직 `done` 전), reset·새 요청 직후, `done` 전에 실패.
 * - `waiting`: `done`을 받았고 스트림이 아직 열려 있다(서버가 도형을 만드는 중일 수 있음).
 * - `received`: `done` 뒤 `figures` 이벤트를 받았다.
 * - `empty`: `done` 뒤 `figures` 없이 스트림이 끝났다(서버 off, 도형 없음·실패, done 뒤 연결 오류).
 *
 * 서버는 받아들인 도형이 있을 때만 `figures`를 보내므로 "도형 없음"은 스트림 종료로만 알 수 있다.
 * 화면 표시(준비 중/없음)는 design 결정 후 이 값을 소비한다.
 */
export type FiguresPhase = "idle" | "waiting" | "received" | "empty";

/** 스트림이 끝났을 때(정상 종료·done 뒤 오류)의 다음 단계 — 이미 받았으면 유지, 아니면 empty. */
export function figuresPhaseAfterStreamEnd(previous: FiguresPhase): FiguresPhase {
  return previous === "received" ? "received" : "empty";
}

/** `fetch`/스트림 읽기를 `AbortController`로 중단했을 때의 오류(브라우저 `DOMException`, Node `AbortError`). */
export function isAbortError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "name" in error && error.name === "AbortError";
}
