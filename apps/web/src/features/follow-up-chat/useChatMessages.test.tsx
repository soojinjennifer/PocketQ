import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../shared/api/ApiError";

vi.mock("../../shared/api/chatMessage", () => ({
  sendChatMessage: vi.fn(),
}));

const { sendChatMessage } = await import("../../shared/api/chatMessage");
const { useChatMessages } = await import("./useChatMessages");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useChatMessages", () => {
  it("성공하면 사용자 질문/AI 답변이 순서대로 messages에 쌓이고 idle로 돌아온다", async () => {
    vi.mocked(sendChatMessage).mockResolvedValue({ answerMd: "이렇게 풀면 돼요." });

    const { result } = renderHook(() => useChatMessages("problem-1"));
    expect(result.current.status).toBe("idle");

    let succeeded = false;
    await act(async () => {
      succeeded = await result.current.sendMessage("왜 이렇게 풀어요?");
    });

    expect(succeeded).toBe(true);
    await waitFor(() => expect(result.current.status).toBe("idle"));
    expect(result.current.messages).toEqual([
      { role: "user", content: "왜 이렇게 풀어요?" },
      { role: "assistant", content: "이렇게 풀면 돼요." },
    ]);
    expect(result.current.errorMessage).toBeNull();
  });

  it("두 번째 질문을 보낼 때 지금까지의 대화를 history로 함께 보낸다", async () => {
    vi.mocked(sendChatMessage).mockResolvedValue({ answerMd: "첫 번째 답" });

    const { result } = renderHook(() => useChatMessages("problem-1"));
    await act(async () => {
      await result.current.sendMessage("첫 번째 질문");
    });

    vi.mocked(sendChatMessage).mockResolvedValue({ answerMd: "두 번째 답" });
    await act(async () => {
      await result.current.sendMessage("두 번째 질문");
    });

    expect(sendChatMessage).toHaveBeenLastCalledWith({
      problemId: "problem-1",
      question: "두 번째 질문",
      history: [
        { role: "user", content: "첫 번째 질문" },
        { role: "assistant", content: "첫 번째 답" },
      ],
    });
  });

  it("빈/공백 질문은 API를 호출하지 않고 false를 반환한다", async () => {
    const { result } = renderHook(() => useChatMessages("problem-1"));

    let succeeded = true;
    await act(async () => {
      succeeded = await result.current.sendMessage("   ");
    });

    expect(succeeded).toBe(false);
    expect(sendChatMessage).not.toHaveBeenCalled();
    expect(result.current.messages).toEqual([]);
  });

  it("problemId가 없으면 전송하지 않고 false를 반환한다(풀이 완료 전)", async () => {
    const { result } = renderHook(() => useChatMessages(null));

    let succeeded = true;
    await act(async () => {
      succeeded = await result.current.sendMessage("질문");
    });

    expect(succeeded).toBe(false);
    expect(sendChatMessage).not.toHaveBeenCalled();
  });

  it("ApiError가 발생하면 error 상태가 되고, 방금 추가했던 사용자 질문도 이력에서 되돌린다", async () => {
    vi.mocked(sendChatMessage).mockRejectedValue(
      new ApiError("provider_error", "답변을 생성하지 못했습니다.", 502),
    );

    const { result } = renderHook(() => useChatMessages("problem-1"));

    let succeeded = true;
    await act(async () => {
      succeeded = await result.current.sendMessage("질문");
    });

    expect(succeeded).toBe(false);
    expect(result.current.status).toBe("error");
    expect(result.current.errorMessage).toBe("답변을 생성하지 못했습니다.");
    expect(result.current.messages).toEqual([]);
  });

  it("reset은 messages/status/errorMessage를 모두 초기화한다", async () => {
    vi.mocked(sendChatMessage).mockResolvedValue({ answerMd: "답" });

    const { result } = renderHook(() => useChatMessages("problem-1"));
    await act(async () => {
      await result.current.sendMessage("질문");
    });
    expect(result.current.messages.length).toBe(2);

    act(() => result.current.reset());

    expect(result.current.messages).toEqual([]);
    expect(result.current.status).toBe("idle");
    expect(result.current.errorMessage).toBeNull();
  });
});
