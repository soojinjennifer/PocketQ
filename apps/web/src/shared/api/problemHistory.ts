import {
  problemHistoryDetailSchema,
  problemHistoryListResponseSchema,
  recognizeResponseSchema,
  type ProblemHistoryDetailDto,
  type ProblemHistoryListResponseDto,
  type RecognizeResponseDto,
} from "validation";
import { parseApiErrorBody } from "./ApiError";
import { buildApiUrl, createTimeoutSignal, getAuthHeaders } from "./httpClient";

/**
 * `GET /api/problems` — 로그인한 사용자의 풀이 이력 목록(마이페이지, PRD MYPAGE-1).
 * 정렬(최신순)은 서버가 처리하므로 클라이언트에서 다시 정렬하지 않는다.
 * `chatMessage.ts`/`recognizeProblem.ts`와 동일한 단발성 fetch 패턴을 따른다.
 */
export async function listProblemHistory(): Promise<ProblemHistoryListResponseDto> {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(buildApiUrl("/api/problems"), {
    method: "GET",
    headers: authHeaders,
    signal: createTimeoutSignal(),
  });

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw parseApiErrorBody(body, response.status, "풀이 기록을 불러오지 못했습니다.");
  }

  return problemHistoryListResponseSchema.parse(body);
}

/**
 * `GET /api/problems/:problemId` — 과거 풀이 1건의 전체 내용(인식된 문제 + 풀이 + 대화 이력).
 * 기록이 없거나 타인 소유이면 서버가 구분 없이 404를 반환한다.
 */
export async function getProblemHistoryDetail(problemId: string): Promise<ProblemHistoryDetailDto> {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(buildApiUrl(`/api/problems/${problemId}`), {
    method: "GET",
    headers: authHeaders,
    signal: createTimeoutSignal(),
  });

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw parseApiErrorBody(body, response.status, "풀이 기록을 불러오지 못했습니다.");
  }

  return problemHistoryDetailSchema.parse(body);
}

/**
 * `POST /api/problems/:problemId/reopen` — 마이페이지 "다시 풀기". 이미 저장된 인식 결과로 새 문제
 * 레코드를 만들어 돌려주므로, 사진/필기를 다시 입력하지 않고도 기존 recognize → solve 파이프라인을
 * 그대로 재사용할 수 있다.
 *
 * 응답 shape이 `POST /api/problems/recognize`와 동일해서(서버 계약 확정) 새 스키마를 만들지 않고
 * `recognizeResponseSchema`를 그대로 재사용한다 — 덕분에 `useRecognizeProblem`이 recognize 결과와
 * 구분 없이 같은 상태로 받아들일 수 있다.
 *
 * 기록이 없거나 타인 소유이면 서버가 구분 없이 404를 반환한다(`getProblemHistoryDetail`과 동일).
 */
export async function reopenProblemHistory(problemId: string): Promise<RecognizeResponseDto> {
  const authHeaders = await getAuthHeaders();
  // 요청 본문이 없는 POST다 — `Content-Type`도 보내지 않는다(빈 본문에 JSON 타입을 선언하면
  // 서버의 body parser가 파싱 오류를 낼 수 있다).
  const response = await fetch(buildApiUrl(`/api/problems/${problemId}/reopen`), {
    method: "POST",
    headers: authHeaders,
    signal: createTimeoutSignal(),
  });

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw parseApiErrorBody(body, response.status, "문제를 다시 불러오지 못했습니다.");
  }

  return recognizeResponseSchema.parse(body);
}
