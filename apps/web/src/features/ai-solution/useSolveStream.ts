import { useCallback, useRef, useState } from "react";
import type { Solution, SolveOptions } from "shared-types";
import { ApiError } from "../../shared/api/ApiError";
import { solveProblemStream } from "../../shared/api/solveProblem";

export type SolveStreamStatus = "idle" | "loading" | "success" | "error";

export interface SolveStreamInput {
  problemId: string;
  options: SolveOptions;
  confirmedText?: string;
}

interface UseSolveStreamResult {
  status: SolveStreamStatus;
  /** `chunk` 이벤트의 delta를 누적한 raw 텍스트. 정식 Result Panel(마크다운/KaTeX 렌더링)은 별도 단계 범위다. */
  streamedText: string;
  result: Solution | null;
  errorMessage: string | null;
  /** 성공(`done` 이벤트 수신)하면 결과 `Solution`을, 실패하면 `null`을 반환한다(호출 측이 성공 여부에
   *  따라 후속 동작을 분기할 때 상태 업데이트 타이밍에 의존하지 않고 반환값으로 바로 판단할 수 있다).
   *  `done` 시점에 resolve되며, 그 뒤 도착하는 `figures`는 `result`에 병합된다(반환값에는 없다). */
  solve: (input: SolveStreamInput) => Promise<Solution | null>;
  reset: () => void;
}

/**
 * `POST /api/problems/:problemId/solve` SSE 스트림을 소비하는 작은 오케스트레이션 훅.
 * `chunk` delta를 누적하고, `done`이면 구조화된 결과를, `error`면 에러 메시지를 상태로 반영한다.
 * `done` 이후의 `figures`(서버 검증 도형)는 `result.figures`/`result.stepFigureRefs`로 병합한다.
 * 새 `solve()` 호출이 이전 스트림이 끝나기 전에 다시 일어나면(예: 빠른 재시도) 이전 스트림의
 * 뒤늦은 이벤트가 최신 상태를 덮어쓰지 않도록 요청 세대를 비교해 무시한다.
 */
export function useSolveStream(): UseSolveStreamResult {
  const [status, setStatus] = useState<SolveStreamStatus>("idle");
  const [streamedText, setStreamedText] = useState("");
  const [result, setResult] = useState<Solution | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const solve = useCallback((input: SolveStreamInput): Promise<Solution | null> => {
    const requestId = (requestIdRef.current += 1);
    setStatus("loading");
    setStreamedText("");
    setResult(null);
    setErrorMessage(null);

    // `done`을 받는 즉시 resolve한다(Stage 3) — 서버는 done 뒤에도 도형(`figures`)을 보내려고 스트림을
    // 열어둘 수 있으므로, 스트림 종료까지 기다리면 추천 질문 요청 등 후속 동작이 늦어진다. 남은 스트림은
    // 백그라운드에서 계속 소비해 도형을 결과에 병합한다. done 이후의 오류는 결과를 지우지 않는다.
    return new Promise<Solution | null>((resolve) => {
      let settled = false;
      let doneReceived = false;
      const settle = (value: Solution | null): void => {
        if (!settled) {
          settled = true;
          resolve(value);
        }
      };

      void (async () => {
        try {
          for await (const event of solveProblemStream(input)) {
            if (requestIdRef.current !== requestId) {
              settle(null);
              return;
            }
            if (event.type === "chunk") {
              setStreamedText((prev) => prev + event.delta);
            } else if (event.type === "done") {
              doneReceived = true;
              setResult(event.result);
              setStatus("success");
              settle(event.result);
            } else if (event.type === "figures") {
              if (doneReceived) {
                setResult((prev) =>
                  prev ? { ...prev, figures: event.figures, stepFigureRefs: event.stepFigureRefs } : prev,
                );
              }
            } else if (!doneReceived) {
              setErrorMessage(event.message);
              setStatus("error");
            }
          }
        } catch (error) {
          if (requestIdRef.current === requestId && !doneReceived) {
            const message = error instanceof ApiError ? error.message : "풀이 생성 중 오류가 발생했습니다.";
            setErrorMessage(message);
            setStatus("error");
          }
        }
        settle(null);
      })();
    });
  }, []);

  const reset = useCallback(() => {
    requestIdRef.current += 1;
    setStatus("idle");
    setStreamedText("");
    setResult(null);
    setErrorMessage(null);
  }, []);

  return { status, streamedText, result, errorMessage, solve, reset };
}
