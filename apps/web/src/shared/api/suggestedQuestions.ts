import { suggestedQuestionsResponseSchema, type SuggestedQuestionsResponseDto } from "validation";
import { parseApiErrorBody } from "./ApiError";
import { buildApiUrl, createTimeoutSignal, getAuthHeaders } from "./httpClient";

/**
 * `POST /api/problems/:problemId/suggestions` — 후속 질문 제안 pill 문구를 받는다(Final QA
 * MEDIUM-4). 요청 본문이 없는 POST라 `reopenProblemHistory`와 동일 패턴을 따른다.
 */
export async function getSuggestedQuestions(problemId: string): Promise<SuggestedQuestionsResponseDto> {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(buildApiUrl(`/api/problems/${problemId}/suggestions`), {
    method: "POST",
    headers: authHeaders,
    signal: createTimeoutSignal(),
  });

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw parseApiErrorBody(body, response.status, "추천 질문을 불러오지 못했습니다.");
  }

  return suggestedQuestionsResponseSchema.parse(body);
}
