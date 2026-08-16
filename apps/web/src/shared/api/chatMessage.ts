import type { ChatMessage } from "shared-types";
import { chatResponseSchema, type ChatResponseDto } from "validation";
import { parseApiErrorBody } from "./ApiError";
import { buildApiUrl, createTimeoutSignal, getAuthHeaders } from "./httpClient";

export interface SendChatMessageParams {
  problemId: string;
  question: string;
  /** 서버가 대화 이력을 저장하지 않는 stateless 설계라(`apps/api` `chatRequestSchema` 주석 참고)
   *  매 요청마다 지금까지의 전체 이력을 함께 보낸다. 이번에 보내는 `question`은 포함하지 않는다. */
  history: ChatMessage[];
}

/**
 * `POST /api/problems/:problemId/chat` — 풀이 결과에 대한 후속 질문을 보낸다. `solveProblemStream`과
 * 달리 SSE가 아니라 일반 JSON 완료 응답이라(`PRD CHAT-8`) `recognizeProblem.ts`와 동일한 단발성
 * fetch 패턴을 따른다.
 */
export async function sendChatMessage(params: SendChatMessageParams): Promise<ChatResponseDto> {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(buildApiUrl(`/api/problems/${params.problemId}/chat`), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders },
    body: JSON.stringify({ question: params.question, history: params.history }),
    signal: createTimeoutSignal(),
  });

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw parseApiErrorBody(body, response.status, "답변을 받지 못했습니다.");
  }

  return chatResponseSchema.parse(body);
}
