import { useCallback, useState } from "react";
import type { WorkLine } from "shared-types";
import { ApiError } from "../../shared/api/ApiError";
import { recognizeWork } from "../../shared/api/recognizeWork";

export type RecognizeWorkStatus = "idle" | "loading" | "success" | "error";

export interface RecognizeWorkInput {
  problemId: string;
  imageBlob: Blob;
}

interface UseRecognizeWorkResult {
  status: RecognizeWorkStatus;
  workLines: WorkLine[] | null;
  errorMessage: string | null;
  /** 성공하면 인식된 `WorkLine[]`를, 실패하면 `null`을 반환한다(호출 측이 반환값으로 바로
   *  성공 여부를 판단할 수 있게 한다, `useRecognizeProblem`과 동일한 이유). */
  recognizeWork: (input: RecognizeWorkInput) => Promise<WorkLine[] | null>;
  reset: () => void;
}

/**
 * `POST /api/problems/:problemId/work-lines` 호출과 로딩/에러/결과 상태만 다루는 작은
 * 오케스트레이션 훅(`useRecognizeProblem`과 동일한 패턴).
 */
export function useRecognizeWork(): UseRecognizeWorkResult {
  const [status, setStatus] = useState<RecognizeWorkStatus>("idle");
  const [workLines, setWorkLines] = useState<WorkLine[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const recognize = useCallback(async (input: RecognizeWorkInput): Promise<WorkLine[] | null> => {
    setStatus("loading");
    setErrorMessage(null);

    try {
      const response = await recognizeWork(input);
      setWorkLines(response.workLines);
      setStatus("success");
      return response.workLines;
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "학생 풀이 인식 중 오류가 발생했습니다.";
      setErrorMessage(message);
      setStatus("error");
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setWorkLines(null);
    setErrorMessage(null);
  }, []);

  return { status, workLines, errorMessage, recognizeWork: recognize, reset };
}
