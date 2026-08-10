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
   *  따라 후속 동작을 분기할 때 상태 업데이트 타이밍에 의존하지 않고 반환값으로 바로 판단할 수 있다). */
  solve: (input: SolveStreamInput) => Promise<Solution | null>;
  reset: () => void;
}

/**
 * `POST /api/problems/:problemId/solve` SSE 스트림을 소비하는 작은 오케스트레이션 훅.
 * `chunk` delta를 누적하고, `done`이면 구조화된 결과를, `error`면 에러 메시지를 상태로 반영한다.
 * 새 `solve()` 호출이 이전 스트림이 끝나기 전에 다시 일어나면(예: 빠른 재시도) 이전 스트림의
 * 뒤늦은 이벤트가 최신 상태를 덮어쓰지 않도록 요청 세대를 비교해 무시한다.
 */
export function useSolveStream(): UseSolveStreamResult {
  const [status, setStatus] = useState<SolveStreamStatus>("idle");
  const [streamedText, setStreamedText] = useState("");
  const [result, setResult] = useState<Solution | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const solve = useCallback(async (input: SolveStreamInput): Promise<Solution | null> => {
    const requestId = (requestIdRef.current += 1);
    setStatus("loading");
    setStreamedText("");
    setResult(null);
    setErrorMessage(null);

    let solvedResult: Solution | null = null;

    try {
      for await (const event of solveProblemStream(input)) {
        if (requestIdRef.current !== requestId) {
          return null;
        }
        if (event.type === "chunk") {
          setStreamedText((prev) => prev + event.delta);
        } else if (event.type === "done") {
          solvedResult = event.result;
          setResult(event.result);
          setStatus("success");
        } else {
          setErrorMessage(event.message);
          setStatus("error");
        }
      }
    } catch (error) {
      if (requestIdRef.current !== requestId) {
        return null;
      }
      const message = error instanceof ApiError ? error.message : "풀이 생성 중 오류가 발생했습니다.";
      setErrorMessage(message);
      setStatus("error");
      return null;
    }

    return solvedResult;
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
