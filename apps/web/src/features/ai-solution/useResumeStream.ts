import { useCallback, useRef, useState } from "react";
import type { ResumeMode, ResumeSolution } from "shared-types";
import { ApiError } from "../../shared/api/ApiError";
import { resumeProblemStream } from "../../shared/api/resumeProblem";

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
}

/**
 * `POST /api/problems/:problemId/resume` SSE 스트림을 소비하는 작은 오케스트레이션 훅.
 * `useSolveStream`과 완전히 동일한 구조(요청 세대 비교로 stale 이벤트 무시)를 그대로 따른다 —
 * 새 `resume()` 호출(예: "다른 방법으로"를 눌러 모드를 바꾸는 경우)이 이전 스트림이 끝나기 전에
 * 다시 일어나도 이전 스트림의 뒤늦은 이벤트가 최신 상태를 덮어쓰지 않는다.
 */
export function useResumeStream(): UseResumeStreamResult {
  const [status, setStatus] = useState<ResumeStreamStatus>("idle");
  const [mode, setMode] = useState<ResumeMode | null>(null);
  const [streamedText, setStreamedText] = useState("");
  const [result, setResult] = useState<ResumeSolution | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const resume = useCallback((input: ResumeStreamInput): Promise<ResumeSolution | null> => {
    const requestId = (requestIdRef.current += 1);
    setStatus("loading");
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
          for await (const event of resumeProblemStream(input)) {
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
            const message = error instanceof ApiError ? error.message : "이어풀기 생성 중 오류가 발생했습니다.";
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
    setMode(null);
    setStreamedText("");
    setResult(null);
    setErrorMessage(null);
  }, []);

  return { status, mode, streamedText, result, errorMessage, resume, reset };
}
