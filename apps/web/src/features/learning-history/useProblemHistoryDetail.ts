import { useCallback, useEffect, useRef, useState } from "react";
import type { ProblemHistoryDetailDto } from "validation";
import { ApiError } from "../../shared/api/ApiError";
import { getProblemHistoryDetail } from "../../shared/api/problemHistory";

export type ProblemHistoryDetailStatus = "idle" | "loading" | "success" | "error";

const NOT_FOUND_MESSAGE = "이 풀이 기록을 찾을 수 없습니다.";
const GENERIC_ERROR_MESSAGE = "풀이 기록을 불러오지 못했습니다.";

interface UseProblemHistoryDetailResult {
  status: ProblemHistoryDetailStatus;
  detail: ProblemHistoryDetailDto | null;
  errorMessage: string | null;
  /** 인라인 에러 문구의 "다시 시도" 버튼용 재조회. `problemId`가 없으면 아무 것도 하지 않는다. */
  reload: () => void;
}

/**
 * `GET /api/problems/:problemId` 단건 조회 상태만 다루는 훅(마이페이지 "이전 풀이 다시 보기",
 * MYPAGE-2). `problemId`가 `null`이면 아무 요청도 보내지 않고 `"idle"`을 유지한다(오버레이가
 * 닫힌 상태).
 *
 * `features/problem-input`(`useProblemInput`/`ProblemInputProvider`)과 **완전히 독립적이다** —
 * 과거 기록을 열어보는 동작이 진행 중인 `/solve` 세션 상태를 읽거나 덮어쓰지 않는다
 * (PRD MYPAGE §5). 그래서 이 훅은 자체 `status`/`detail` 상태만 소유한다.
 *
 * `problemId`가 바뀔 때의 상태 초기화는 effect가 아니라 React 공식 "prop이 바뀔 때 state 조정"
 * 패턴(렌더 중 이전 값과 비교해 즉시 setState)으로 처리한다 — `SolveLandscapePage`의 `panelWidth`
 * 리셋과 동일한 방식이며, effect 안에서 동기 setState를 호출하지 않기 위함이다.
 */
export function useProblemHistoryDetail(problemId: string | null): UseProblemHistoryDetailResult {
  const [status, setStatus] = useState<ProblemHistoryDetailStatus>(
    problemId === null ? "idle" : "loading",
  );
  const [detail, setDetail] = useState<ProblemHistoryDetailDto | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [prevProblemId, setPrevProblemId] = useState<string | null>(problemId);
  if (problemId !== prevProblemId) {
    setPrevProblemId(problemId);
    setStatus(problemId === null ? "idle" : "loading");
    setDetail(null);
    setErrorMessage(null);
  }

  // 목록에서 빠르게 여러 행을 눌렀을 때(또는 오버레이를 닫았을 때) 늦게 도착한 응답이
  // 최신 선택 상태를 덮어쓰지 않게 한다.
  const requestIdRef = useRef(0);
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const load = useCallback(async (targetId: string, requestId: number) => {
    try {
      const response = await getProblemHistoryDetail(targetId);
      if (!isMountedRef.current || requestIdRef.current !== requestId) {
        return;
      }
      setDetail(response);
      setStatus("success");
    } catch (error) {
      if (!isMountedRef.current || requestIdRef.current !== requestId) {
        return;
      }
      // 404(기록 없음 또는 타인 소유)만 문구를 구분하고, 그 외는 기술적 메시지를 노출하지 않는다.
      setErrorMessage(
        error instanceof ApiError && error.status === 404
          ? NOT_FOUND_MESSAGE
          : GENERIC_ERROR_MESSAGE,
      );
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    // `problemId`가 바뀔 때마다(닫힘 포함) 요청 세대를 올려 이전 요청의 응답을 폐기한다.
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    if (problemId === null) {
      return;
    }
    void load(problemId, requestId);
  }, [problemId, load]);

  const reload = useCallback(() => {
    if (problemId === null) {
      return;
    }
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setStatus("loading");
    setDetail(null);
    setErrorMessage(null);
    void load(problemId, requestId);
  }, [problemId, load]);

  return { status, detail, errorMessage, reload };
}
