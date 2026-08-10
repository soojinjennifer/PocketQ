import { useCallback, useState } from "react";
import type { Grade } from "shared-types";
import { ApiError } from "../../shared/api/ApiError";
import { recognizeProblem } from "../../shared/api/recognizeProblem";

export type RecognizeStatus = "idle" | "loading" | "success" | "error";

export interface RecognizeProblemInput {
  imageBlob: Blob;
  inputType: "photo" | "handwriting";
  grade: Grade;
}

interface UseRecognizeProblemResult {
  status: RecognizeStatus;
  problemId: string | null;
  recognizedText: string | null;
  errorMessage: string | null;
  /** 성공하면 `problemId`를, 실패하면 `null`을 반환한다(호출 측이 이어서 solve를 트리거할 때 사용). */
  recognize: (input: RecognizeProblemInput) => Promise<string | null>;
  reset: () => void;
}

/**
 * `POST /api/problems/recognize` 호출과 로딩/에러/결과 상태만 다루는 작은 오케스트레이션 훅.
 * 캔버스 export나 옵션 상태는 이 훅의 책임이 아니다(`normalizeProblemInput`/`ProblemInputProvider`가 담당).
 */
export function useRecognizeProblem(): UseRecognizeProblemResult {
  const [status, setStatus] = useState<RecognizeStatus>("idle");
  const [problemId, setProblemId] = useState<string | null>(null);
  const [recognizedText, setRecognizedText] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const recognize = useCallback(async (input: RecognizeProblemInput): Promise<string | null> => {
    setStatus("loading");
    setErrorMessage(null);

    try {
      const response = await recognizeProblem(input);
      setProblemId(response.problemId);
      setRecognizedText(response.recognizedText);
      setStatus("success");
      return response.problemId;
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "문제 인식 중 오류가 발생했습니다.";
      setErrorMessage(message);
      setStatus("error");
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setProblemId(null);
    setRecognizedText(null);
    setErrorMessage(null);
  }, []);

  return { status, problemId, recognizedText, errorMessage, recognize, reset };
}
