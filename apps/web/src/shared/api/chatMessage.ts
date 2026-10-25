import type { ChatFigureContextRequest, ChatMessage } from "shared-types";
import { chatResponseSchema, type ChatResponseDto } from "validation";
import { parseApiErrorBody } from "./ApiError";
import { buildApiUrl, createTimeoutSignal, getAuthHeaders } from "./httpClient";

export interface SendChatMessageParams {
  problemId: string;
  question: string;
  /** 서버가 대화 이력을 저장하지 않는 stateless 설계라(`apps/api` `chatRequestSchema` 주석 참고)
   *  매 요청마다 지금까지의 전체 이력을 함께 보낸다. 이번에 보내는 `question`은 포함하지 않는다. */
  history: ChatMessage[];
  /**
   * 학생이 보고 있는 결과의 단계(Stage 5, 선택). `VITE_FIGURES_ENABLED` on일 때만 페이지가 넘긴다 — 없으면 본문에 키 자체를
   * 넣지 않아 요청 바이트가 기존과 같다. 도형은 보내지 않는다(서버가 자기 메모리의 검증 도형만 쓴다).
   * `source`("solve"·"resume", 장부 §8.16 B-1)는 그 두 값일 때만 `step` 뒤에 담는다 — 없으면 본문이 `{ step }` 그대로다.
   */
  figureContext?: ChatFigureContextRequest;
}

/** 본문에 넣을 `figureContext` — `step`과(있으면) 허용된 `source`만. 타입 밖 키(도형·탐색 상태 등)는 버린다. */
function toFigureContextBody(figureContext: ChatFigureContextRequest): ChatFigureContextRequest {
  const { step, source } = figureContext;
  return source === "solve" || source === "resume" ? { step, source } : { step };
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
    body: JSON.stringify({
      question: params.question,
      history: params.history,
      ...(params.figureContext ? { figureContext: toFigureContextBody(params.figureContext) } : {}),
    }),
    signal: createTimeoutSignal(),
  });

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw parseApiErrorBody(body, response.status, "답변을 받지 못했습니다.");
  }

  return chatResponseSchema.parse(body);
}
