import { useCallback, useRef, useState } from "react";
import type { ChatMessage } from "shared-types";
import { ApiError } from "../../shared/api/ApiError";
import { sendChatMessage } from "../../shared/api/chatMessage";

export type ChatStatus = "idle" | "submitting" | "error";

interface UseChatMessagesResult {
  messages: ChatMessage[];
  status: ChatStatus;
  errorMessage: string | null;
  /**
   * 빈/공백 질문, `problemId`가 아직 없는 경우(풀이 완료 전), 이미 전송 중인 경우(중복 제출)에는
   * 아무 것도 하지 않고 `false`를 반환한다. 성공하면 `true`, 실패하면(대화 이력에서 실패한 질문을
   * 되돌리고) `false`를 반환한다 — 호출 측(`ChatFooter`)이 이 반환값으로 입력값을 초기화할지
   * (성공) 그대로 유지할지(실패)를 결정한다.
   */
  sendMessage: (question: string) => Promise<boolean>;
  reset: () => void;
}

/**
 * `POST /api/problems/:problemId/chat` 호출과 대화 이력/로딩/에러 상태만 다루는 작은 오케스트레이션
 * 훅(`useRecognizeProblem`/`useSolveStream`과 동일한 패턴). 서버가 이력을 저장하지 않는 stateless
 * 설계라 매 요청마다 지금까지의 `messages`를 `history`로 함께 보낸다.
 */
export function useChatMessages(problemId: string | null): UseChatMessagesResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ChatStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // 상태 업데이트(setStatus)의 비동기 커밋 타이밍에 의존하지 않고, 같은 이벤트 루프 틱 안에서 온
  // 중복 호출도 확실히 막기 위해 ref 기반 뮤텍스를 사용한다(`useSolveStream`의 requestIdRef와 같은
  // 이유).
  const isSubmittingRef = useRef(false);

  const sendMessage = useCallback(
    async (question: string): Promise<boolean> => {
      const trimmed = question.trim();
      if (!trimmed || !problemId || isSubmittingRef.current) {
        return false;
      }

      isSubmittingRef.current = true;
      setStatus("submitting");
      setErrorMessage(null);

      const history = messages;
      const userMessage: ChatMessage = { role: "user", content: trimmed };
      setMessages((prev) => [...prev, userMessage]);

      try {
        const response = await sendChatMessage({ problemId, question: trimmed, history });
        setMessages((prev) => [...prev, { role: "assistant", content: response.answerMd }]);
        setStatus("idle");
        return true;
      } catch (error) {
        const message = error instanceof ApiError ? error.message : "답변을 받지 못했습니다.";
        // 실패한 질문은 대화 이력에 남기지 않는다 — 입력값 유지/재시도는 `ChatFooter`가 반환값을
        // 보고 판단한다.
        setMessages((prev) => prev.slice(0, -1));
        setErrorMessage(message);
        setStatus("error");
        return false;
      } finally {
        isSubmittingRef.current = false;
      }
    },
    [problemId, messages],
  );

  const reset = useCallback(() => {
    isSubmittingRef.current = false;
    setMessages([]);
    setStatus("idle");
    setErrorMessage(null);
  }, []);

  return { messages, status, errorMessage, sendMessage, reset };
}
