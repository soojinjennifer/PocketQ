import { useCallback, useState } from "react";
import type { Grade } from "shared-types";
import { ApiError } from "../../shared/api/ApiError";
import { reopenProblemHistory } from "../../shared/api/problemHistory";
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
  /** 소프트 캡(하루 10회, 오너 확정) 안내용 — 서버가 응답에 실어 보낸 오늘 누적 인식 횟수. 서버가
   *  값을 생략했으면(예: 카운트 조회 실패) `null`이다. 이 값만으로는 절대 인식을 막지 않는다 —
   *  화면이 `dailyUsageCount > dailyUsageLimit`일 때만 가벼운 안내를 보여줄지 판단한다. */
  dailyUsageCount: number | null;
  /** `dailyUsageCount`의 소프트 캡 상한(항상 10, 서버가 함께 채워줄 때만 값이 있다). */
  dailyUsageLimit: number | null;
  /** 성공하면 `problemId`를, 실패하면 `null`을 반환한다(호출 측이 이어서 solve를 트리거할 때 사용). */
  recognize: (input: RecognizeProblemInput) => Promise<string | null>;
  /** 마이페이지 "다시 풀기" — 이미지 없이 저장된 과거 기록으로 인식 상태를 재수화한다.
   *  `recognize`와 동일하게 성공 시 새 `problemId`를, 실패 시 `null`을 반환한다. */
  resumeFromHistory: (historyProblemId: string) => Promise<string | null>;
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
  const [dailyUsageCount, setDailyUsageCount] = useState<number | null>(null);
  const [dailyUsageLimit, setDailyUsageLimit] = useState<number | null>(null);

  const recognize = useCallback(async (input: RecognizeProblemInput): Promise<string | null> => {
    setStatus("loading");
    setErrorMessage(null);

    try {
      const response = await recognizeProblem(input);
      setProblemId(response.problemId);
      setRecognizedText(response.recognizedText);
      setDailyUsageCount(response.dailyUsageCount ?? null);
      setDailyUsageLimit(response.dailyUsageLimit ?? null);
      setStatus("success");
      return response.problemId;
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "문제 인식 중 오류가 발생했습니다.";
      setErrorMessage(message);
      setStatus("error");
      return null;
    }
  }, []);

  /**
   * `POST /api/problems/:problemId/reopen`으로 과거 기록을 재수화한다. 응답 shape이 recognize와
   * 동일해서(`recognizeResponseSchema` 재사용) 이후의 상태/에러 UI는 일반 인식과 완전히 같은 경로를
   * 탄다 — 별도의 상태나 에러 표시를 새로 만들지 않는 것이 이 설계의 목적이다.
   */
  const resumeFromHistory = useCallback(async (historyProblemId: string): Promise<string | null> => {
    setStatus("loading");
    setErrorMessage(null);

    try {
      const response = await reopenProblemHistory(historyProblemId);
      setProblemId(response.problemId);
      setRecognizedText(response.recognizedText);
      // reopen 응답은 소프트 캡 카운트를 채우지 않는다(recognize 1회로 집계되는 새 인식이 아니다) —
      // 이전 recognize 시도의 값이 남아 화면에 잘못 표시되지 않도록 명시적으로 비운다.
      setDailyUsageCount(null);
      setDailyUsageLimit(null);
      setStatus("success");
      return response.problemId;
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "문제를 다시 불러오는 중 오류가 발생했습니다.";
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
    setDailyUsageCount(null);
    setDailyUsageLimit(null);
  }, []);

  return {
    status,
    problemId,
    recognizedText,
    errorMessage,
    dailyUsageCount,
    dailyUsageLimit,
    recognize,
    resumeFromHistory,
    reset,
  };
}
