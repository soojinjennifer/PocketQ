/**
 * Stage 5 WU0 — 웹 CHAT 요청 본문의 변경 전 바이트 기준값(S5-1 "웹 chat 본문 동일", WU6 off 비교 기준).
 *
 * `chatRequest.baseline.json`은 Stage 5 코드를 바꾸기 **전**(HEAD 091ae2a 작업 트리)에 이 파일의 같은 절차로
 * 캡처했다(캡처 직후 캡처 분기는 제거했다 — 다시 캡처하지 않는다).
 * 실제 `useChatMessages` → 실제 `sendChatMessage` → `fetch` 스텁: 질문 3개를 차례로 보내 URL·method·헤더·본문 문자열을 기록한다.
 */
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import baselineJson from "./chatRequest.baseline.json";

vi.mock("../../../shared/lib/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: { access_token: "baseline-token" } }, error: null })),
    },
  },
}));

const { useChatMessages } = await import("../useChatMessages");

interface RecordedFetch {
  url: string;
  method: string | undefined;
  headers: unknown;
  body: unknown;
}

const baseline = baselineJson as { requests: RecordedFetch[] };

async function collect(): Promise<RecordedFetch[]> {
  const recorded: RecordedFetch[] = [];
  let turn = 0;
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    // 기준 URL(`VITE_API_BASE_URL`)은 기기마다 달라 경로만 비교한다(캡처 직후 같은 규칙으로 기준값의 origin을 제거).
    recorded.push({ url: url.replace(/^https?:\/\/[^/]+/, ""), method: init?.method, headers: init?.headers, body: init?.body });
    turn += 1;
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ answerMd: `답변 ${turn}` }),
    } as Response);
  });
  vi.stubGlobal("fetch", fetchMock);
  try {
    const { result } = renderHook(() => useChatMessages("problem-baseline"));
    for (const question of ["왜 꼭짓점이 최소인가요?", "  두 번째 질문  ", "세 번째 질문"]) {
      await act(async () => {
        await result.current.sendMessage(question);
      });
    }
  } finally {
    vi.unstubAllGlobals();
  }
  return recorded;
}

describe("Stage 5 WU0 — 웹 CHAT 요청 기준값", () => {
  it("useChatMessages → sendChatMessage의 fetch 인자(URL·method·헤더·본문 바이트)가 기준값과 같다", async () => {
    const actual = await collect();
    expect(JSON.stringify(actual)).toBe(JSON.stringify(baseline.requests));
  });
});
