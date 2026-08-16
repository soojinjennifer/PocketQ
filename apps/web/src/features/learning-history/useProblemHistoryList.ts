import { useCallback, useEffect, useRef, useState } from "react";
import type { ProblemHistoryListItemDto } from "validation";
import { listProblemHistory } from "../../shared/api/problemHistory";

export type ProblemHistoryListStatus = "loading" | "success" | "error";

/** 기술적 에러 메시지를 그대로 노출하지 않기 위한 공용 안내 문구
 *  (오너 요구사항: 전체 화면이 깨지지 않도록 모달이 아니라 인라인 안내로 처리한다). */
const LIST_ERROR_MESSAGE = "풀이 기록을 불러오지 못했습니다.";

interface UseProblemHistoryListResult {
  status: ProblemHistoryListStatus;
  items: ProblemHistoryListItemDto[];
  errorMessage: string | null;
  /** 인라인 에러 문구의 "다시 시도" 버튼용 재조회. */
  reload: () => void;
}

/**
 * `GET /api/problems` 목록 조회 상태만 다루는 작은 훅(마이페이지 MYPAGE-1).
 * 마운트 시 자동으로 1회 조회하며, 초기 상태는 `"loading"`이다(진입 즉시 로딩 표시를 위함).
 *
 * `features/problem-input`(현재 `/solve` 세션 상태)과 완전히 독립적이다 — 과거 기록 조회가 진행
 * 중인 풀이 세션을 오염시키면 안 되므로(PRD MYPAGE §5) 그쪽 컨텍스트를 읽지도 쓰지도 않는다.
 *
 * `load()`는 첫 문장이 `await`이라 effect에서 호출해도 동기 setState가 일어나지 않는다
 * (`react-hooks/set-state-in-effect`). "loading"으로의 전환은 초기 state 값과 `reload()`
 * (이벤트 핸들러)가 담당한다.
 */
export function useProblemHistoryList(): UseProblemHistoryListResult {
  const [status, setStatus] = useState<ProblemHistoryListStatus>("loading");
  const [items, setItems] = useState<ProblemHistoryListItemDto[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 언마운트 후 setState 방지 + 재조회가 겹칠 때 늦게 도착한 응답이 최신 결과를 덮어쓰지 않게 한다.
  const requestIdRef = useRef(0);
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const load = useCallback(async (requestId: number) => {
    try {
      const response = await listProblemHistory();
      if (!isMountedRef.current || requestIdRef.current !== requestId) {
        return;
      }
      // 최신순 정렬은 서버가 처리하므로 그대로 사용한다(재정렬하지 않는다).
      setItems(response.items);
      setStatus("success");
    } catch {
      if (!isMountedRef.current || requestIdRef.current !== requestId) {
        return;
      }
      // 원인(네트워크/인증/서버)에 관계없이 같은 안내 문구만 보여준다.
      setErrorMessage(LIST_ERROR_MESSAGE);
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    void load(requestId);
  }, [load]);

  const reload = useCallback(() => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setStatus("loading");
    setErrorMessage(null);
    void load(requestId);
  }, [load]);

  return { status, items, errorMessage, reload };
}
