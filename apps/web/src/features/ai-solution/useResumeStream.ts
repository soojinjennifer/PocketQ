import { useCallback, useEffect, useRef, useState } from "react";
import type { ResumeMode, ResumeSolution } from "shared-types";
import { ApiError } from "../../shared/api/ApiError";
import { resumeProblemStream } from "../../shared/api/resumeProblem";
import { figuresPhaseAfterStreamEnd, isAbortError, type FiguresPhase } from "./figuresPhase";

export type ResumeStreamStatus = "idle" | "loading" | "success" | "error";

export interface ResumeStreamInput {
  problemId: string;
  mode: ResumeMode;
}

interface UseResumeStreamResult {
  status: ResumeStreamStatus;
  /** 마지막으로 요청한(또는 요청 중인) 모드. 요청 전에는 `null`. */
  mode: ResumeMode | null;
  /** `chunk` 이벤트의 delta를 누적한 raw 텍스트. */
  streamedText: string;
  result: ResumeSolution | null;
  errorMessage: string | null;
  /** 성공(`done` 이벤트 수신)하면 결과 `ResumeSolution`을, 실패하면 `null`을 반환한다
   *  (`useSolveStream`과 동일하게 호출 측이 반환값으로 바로 성공 여부를 판단할 수 있게 한다).
   *  `done` 시점에 resolve되며, 그 뒤 도착하는 `figures`는 `result`에 병합된다. */
  resume: (input: ResumeStreamInput) => Promise<ResumeSolution | null>;
  reset: () => void;
  /** 도형 수신 단계(Stage 4) — `figuresPhase.ts` 참고. */
  figuresPhase: FiguresPhase;
}

/**
 * `POST /api/problems/:problemId/resume` SSE 스트림을 소비하는 작은 오케스트레이션 훅.
 * `useSolveStream`과 완전히 동일한 구조(요청 세대 비교로 stale 이벤트 무시)를 그대로 따른다 —
 * 새 `resume()` 호출(예: "다른 방법으로"를 눌러 모드를 바꾸는 경우)이 이전 스트림이 끝나기 전에
 * 다시 일어나도 이전 스트림의 뒤늦은 이벤트가 최신 상태를 덮어쓰지 않는다.
 *
 * Stage 4 L-4: `useSolveStream`과 같이 요청마다 `AbortController`를 쓰고 새 요청·`reset()`·언마운트 때
 * abort한다(AbortError는 삼킴). `done` 뒤의 상태는 `figuresPhase`로 노출한다.
 */
export function useResumeStream(): UseResumeStreamResult {
  const [status, setStatus] = useState<ResumeStreamStatus>("idle");
  const [mode, setMode] = useState<ResumeMode | null>(null);
  const [streamedText, setStreamedText] = useState("");
  const [result, setResult] = useState<ResumeSolution | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [figuresPhase, setFiguresPhase] = useState<FiguresPhase>("idle");
  const requestIdRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);

  const abortCurrent = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
  }, []);

  // 언마운트 시 진행 중인 요청을 abort하고 세대를 넘겨 이후 상태 갱신을 막는다.
  useEffect(
    () => () => {
      requestIdRef.current += 1;
      abortCurrent();
    },
    [abortCurrent],
  );

  const resume = useCallback((input: ResumeStreamInput): Promise<ResumeSolution | null> => {
    abortCurrent();
    const controller = new AbortController();
    controllerRef.current = controller;
    const requestId = (requestIdRef.current += 1);
    setStatus("loading");
    setFiguresPhase("idle");
    setMode(input.mode);
    setStreamedText("");
    setResult(null);
    setErrorMessage(null);

    // `useSolveStream`과 같은 규칙(Stage 3): `done` 즉시 resolve, 남은 스트림은 백그라운드에서 소비해
    // `figures`를 결과에 병합, done 이후 오류는 상태를 바꾸지 않는다. 모드를 바꿔 다시 요청하면 이전
    // 요청의 뒤늦은 figures는 요청 세대 비교로 무시된다.
    return new Promise<ResumeSolution | null>((resolve) => {
      let settled = false;
      let doneReceived = false;
      const settle = (value: ResumeSolution | null): void => {
        if (!settled) {
          settled = true;
          resolve(value);
        }
      };

      void (async () => {
        try {
          for await (const event of resumeProblemStream(input, controller.signal)) {
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
              setFiguresPhase("waiting");
              settle(event.result);
            } else if (event.type === "figures") {
              if (doneReceived) {
                setResult((prev) =>
                  prev ? { ...prev, figures: event.figures, stepFigureRefs: event.stepFigureRefs } : prev,
                );
                setFiguresPhase("received");
              }
            } else if (!doneReceived) {
              setErrorMessage(event.message);
              setStatus("error");
            }
          }
          if (requestIdRef.current === requestId && doneReceived) setFiguresPhase(figuresPhaseAfterStreamEnd);
        } catch (error) {
          // done 뒤 오류(우리가 건 abort가 아닌 연결 끊김 등)면 도형은 더 오지 않는다 — 결과·status는 유지.
          if (requestIdRef.current === requestId && doneReceived) setFiguresPhase(figuresPhaseAfterStreamEnd);
          // reset·새 요청·언마운트로 건 abort는 이미 세대가 바뀌어 아래 조건에 걸리지 않는다. 같은 세대의
          // AbortError(외부 중단)도 error 상태를 만들지 않는다.
          if (requestIdRef.current === requestId && !doneReceived && !isAbortError(error)) {
            const message = error instanceof ApiError ? error.message : "이어풀기 생성 중 오류가 발생했습니다.";
            setErrorMessage(message);
            setStatus("error");
          }
        }
        if (controllerRef.current === controller) controllerRef.current = null;
        settle(null);
      })();
    });
  }, [abortCurrent]);

  const reset = useCallback(() => {
    requestIdRef.current += 1;
    abortCurrent();
    setStatus("idle");
    setMode(null);
    setStreamedText("");
    setResult(null);
    setErrorMessage(null);
    setFiguresPhase("idle");
  }, [abortCurrent]);

  return { status, mode, streamedText, result, errorMessage, resume, reset, figuresPhase };
}
