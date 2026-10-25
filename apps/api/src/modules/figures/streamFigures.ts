/**
 * `done` 이후 도형 단계의 SSE 처리(Stage 3) — solve·resume 라우터 공통. `docs/API_SPEC.md`, 승인 계획 §2.
 *
 * - 도형 단계 동안 `: keep-alive` SSE 주석을 주기적으로 보낸다(클라이언트 파서는 data 없는 블록을 무시한다).
 * - 받아들인 도형이 1개 이상일 때만 `event: figures`를 정확히 1회 보낸다.
 * - **절대 throw하지 않고 `event: error`를 보내지 않는다**(done 뒤 error 금지).
 * - 연결이 닫힌 뒤에는 아무것도 쓰지 않는다.
 */
import type { Response } from "express";
import type { FigureSpec, StepFigureRef } from "shared-types";

/**
 * keep-alive 주석 간격. **결정 필요(임시값)** — 프록시 유휴 타임아웃(흔히 30~60초)보다 충분히 짧게 15초.
 * 평가의 done 이후 추가 시간 p95를 본 뒤 확정한다(D10).
 */
export const FIGURES_KEEP_ALIVE_MS = 15_000;

/** 라우터 주입 옵션(테스트·운영 공통). */
export interface FiguresRouteOptions {
  /** 기본값 `env.figuresEnabled`(`FIGURES_ENABLED === "true"`). */
  figuresEnabled?: boolean;
  /** keep-alive 간격(ms). 기본 `FIGURES_KEEP_ALIVE_MS`. */
  keepAliveMs?: number;
  /** 도형 단계 전체 상한(ms). 기본 `FIGURES_TOTAL_BUDGET_MS`. */
  figuresTotalBudgetMs?: number;
}

function isWritable(res: Response): boolean {
  return !res.destroyed && !res.writableEnded;
}

/**
 * 연결이 닫히면(클라이언트 끊김) abort되는 컨트롤러. 정상 종료(`res.end()` 이후의 close)에서는 abort하지 않는다.
 */
export function abortOnClientClose(res: Response): AbortController {
  const controller = new AbortController();
  res.on("close", () => {
    if (!res.writableFinished) controller.abort();
  });
  return controller;
}

/** 실제로 `event: figures`로 보낸 도형(최종 재파싱 결과). Stage 5 저장·CHAT 맥락은 정확히 이 값을 쓴다. */
export interface AcceptedFigures {
  figures: FigureSpec[];
  stepFigureRefs: StepFigureRef[];
}

/**
 * 도형 단계를 실행하고 결과를 SSE로 보낸다. `generate`는 throw하지 않는다고 가정하지만, 혹시 throw해도 삼킨다.
 *
 * `onAccepted`(Stage 5)는 `event: figures`를 **실제로 쓴 뒤에만** 한 번 호출된다(수용 0·연결 끊김이면 호출 0 —
 * 보내지 않은 도형은 저장하지 않는다, S5-D9). 받는 값은 SSE로 보낸 것과 같은 객체다. 콜백이 throw해도 삼키며
 * 어떤 경우에도 `event: error`를 보내지 않는다(done 뒤 error 금지).
 */
export async function streamFiguresPhase(
  res: Response,
  generate: () => Promise<AcceptedFigures>,
  keepAliveMs: number = FIGURES_KEEP_ALIVE_MS,
  onAccepted?: (accepted: AcceptedFigures) => Promise<void> | void,
): Promise<void> {
  const timer = setInterval(() => {
    if (isWritable(res)) res.write(": keep-alive\n\n");
  }, keepAliveMs);
  let sent: AcceptedFigures | null = null;
  try {
    const { figures, stepFigureRefs } = await generate();
    if (figures.length > 0 && isWritable(res)) {
      res.write(`event: figures\ndata: ${JSON.stringify({ figures, stepFigureRefs })}\n\n`);
      sent = { figures, stepFigureRefs };
    }
  } catch {
    // 도형 실패는 텍스트 풀이에 영향을 주지 않는다 — error 이벤트를 보내지 않는다.
  } finally {
    clearInterval(timer);
  }
  if (sent && onAccepted) {
    try {
      await onAccepted(sent);
    } catch (error) {
      console.error("[streamFiguresPhase] 수용 도형 후처리 실패", error);
    }
  }
}
