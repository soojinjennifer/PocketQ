import { useCallback, useState } from "react";
import type { Diagnosis } from "shared-types";
import { ApiError } from "../../shared/api/ApiError";
import { diagnoseProblem, type DiagnoseProblemWorkLine } from "../../shared/api/diagnoseProblem";

export type DiagnoseStatus = "idle" | "loading" | "success" | "error";

export interface DiagnoseInput {
  problemId: string;
  workLines: DiagnoseProblemWorkLine[];
}

interface UseDiagnoseResult {
  status: DiagnoseStatus;
  diagnosis: Diagnosis | null;
  errorMessage: string | null;
  /** 성공하면 진단 결과(`Diagnosis`)를, 실패하면 `null`을 반환한다(`useRecognizeProblem`/
   *  `useSolveStream`과 동일하게 호출 측이 반환값으로 바로 성공 여부를 판단할 수 있게 한다). */
  diagnose: (input: DiagnoseInput) => Promise<Diagnosis | null>;
  reset: () => void;
}

/**
 * `POST /api/problems/:problemId/diagnose` 호출과 로딩/에러/결과 상태만 다루는 작은 오케스트레이션
 * 훅. `useSolveStream`과 달리 스트리밍이 아니라 단일 요청-응답이라 `useRecognizeProblem`과 같은
 * 형태를 따른다.
 */
export function useDiagnose(): UseDiagnoseResult {
  const [status, setStatus] = useState<DiagnoseStatus>("idle");
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const diagnose = useCallback(async (input: DiagnoseInput): Promise<Diagnosis | null> => {
    setStatus("loading");
    setErrorMessage(null);

    try {
      const response = await diagnoseProblem(input);
      setDiagnosis(response);
      setStatus("success");
      return response;
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "진단 중 오류가 발생했습니다.";
      setErrorMessage(message);
      setStatus("error");
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setDiagnosis(null);
    setErrorMessage(null);
  }, []);

  return { status, diagnosis, errorMessage, diagnose, reset };
}
