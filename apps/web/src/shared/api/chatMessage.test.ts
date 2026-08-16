import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./ApiError";

vi.mock("../lib/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
  },
}));

const { supabase } = await import("../lib/supabase/client");
const { sendChatMessage } = await import("./chatMessage");

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

beforeEach(() => {
  vi.mocked(supabase.auth.getSession).mockResolvedValue({
    // @ts-expect-error 테스트에서는 access_token만 필요하다.
    data: { session: { access_token: "test-access-token" } },
    error: null,
  });
});

describe("sendChatMessage", () => {
  it("Authorization 헤더와 question/history를 JSON body로 담아 POST 요청을 보낸다", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { answerMd: "그건 이렇게 풀어요." }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendChatMessage({
      problemId: "problem-1",
      question: "왜 이렇게 풀어요?",
      history: [{ role: "user", content: "이전 질문" }],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/problems/problem-1/chat");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-access-token");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");

    const body = JSON.parse(init.body as string) as { question: string; history: unknown };
    expect(body.question).toBe("왜 이렇게 풀어요?");
    expect(body.history).toEqual([{ role: "user", content: "이전 질문" }]);

    expect(result).toEqual({ answerMd: "그건 이렇게 풀어요." });

    vi.unstubAllGlobals();
  });

  it("응답이 실패(4xx/5xx)면 ApiError를 던진다", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(400, {
        error: { code: "validation_error", message: "문제의 풀이가 아직 없습니다." },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      sendChatMessage({ problemId: "problem-1", question: "질문", history: [] }),
    ).rejects.toMatchObject(new ApiError("validation_error", "문제의 풀이가 아직 없습니다.", 400));

    vi.unstubAllGlobals();
  });
});
