import type { ErrorCode, FigureSpec, Solution, SolveOptions, StepFigureRef } from "shared-types";
import { ApiError, parseApiErrorBody } from "./ApiError";
import { buildApiUrl, getAuthHeaders } from "./httpClient";
import { parseFiguresEventData } from "./parseFiguresEvent";
import { parseSseStream } from "./parseSse";

export interface SolveProblemParams {
  problemId: string;
  options: SolveOptions;
  confirmedText?: string;
}

export type SolveStreamEvent =
  | { type: "chunk"; delta: string }
  | { type: "done"; result: Solution }
  /** `done` 이후 서버가 검증한 도형(FIGURES on, 받아들인 도형이 있을 때만 1회). */
  | { type: "figures"; figures: FigureSpec[]; stepFigureRefs: StepFigureRef[] }
  | { type: "error"; code: ErrorCode; message: string };

/** `POST /api/problems/:problemId/solve` — SSE 스트림(`chunk`/`done`/`figures`/`error`)을 순서대로 산출한다. `: keep-alive` 같은 주석 블록은 `parseSseStream`이 무시한다. */
export async function* solveProblemStream(params: SolveProblemParams): AsyncGenerator<SolveStreamEvent> {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(buildApiUrl(`/api/problems/${encodeURIComponent(params.problemId)}/solve`), {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ options: params.options, confirmedText: params.confirmedText }),
  });

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    throw parseApiErrorBody(body, response.status, "풀이 요청에 실패했습니다.");
  }

  if (!response.body) {
    throw new ApiError("internal_error", "스트리밍 응답을 읽을 수 없습니다.", response.status);
  }

  for await (const sseEvent of parseSseStream(response.body)) {
    if (sseEvent.event === "chunk") {
      const parsed = JSON.parse(sseEvent.data) as { delta: string };
      yield { type: "chunk", delta: parsed.delta };
    } else if (sseEvent.event === "done") {
      const parsed = JSON.parse(sseEvent.data) as Solution;
      yield { type: "done", result: parsed };
    } else if (sseEvent.event === "figures") {
      // 깨진 figures 이벤트는 조용히 무시한다 — 텍스트 풀이에 영향을 주지 않는다.
      const payload = parseFiguresEventData(sseEvent.data);
      if (payload) {
        yield { type: "figures", figures: payload.figures, stepFigureRefs: payload.stepFigureRefs };
      }
    } else if (sseEvent.event === "error") {
      const parsed = JSON.parse(sseEvent.data) as { code: ErrorCode; message: string };
      yield { type: "error", code: parsed.code, message: parsed.message };
    }
  }
}
