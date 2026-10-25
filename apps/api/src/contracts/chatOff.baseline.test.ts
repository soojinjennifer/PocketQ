/**
 * Stage 5 WU0 — CHAT 경로의 변경 전 바이트 기준값(S5-1 "chat 요청·어댑터 인자 동일").
 *
 * 기준값 `__baseline__/chatOff.baseline.json`은 Stage 5 코드를 바꾸기 **전**(HEAD 091ae2a 작업 트리)에 이 파일의
 * 같은 절차로 캡처했다(`STAGE5_BASELINE_CAPTURE=1`, 파일이 이미 있으면 캡처를 거부한다 — 다시 캡처하지 않는다).
 * - OpenAI chat 요청 본문(system + user 메시지 = `buildChatUserMessage`): history 0·3·30턴, 긴 history(턴당 2,000자),
 *   solve 풀이 맥락·resume 변환 맥락, 학년 2종
 * - 실제 Express 라우터 → `adapter.chat` 인자(JSON)와 응답 본문: solve 맥락·resume 맥락 × history 0·3·30턴
 *
 * 도형 플래그(서버 `FIGURES_ENABLED`)가 off인 기본 상태에서 실행한다.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { ChatMessage, Grade, ResumeSolution, Solution } from "shared-types";

const getUserMock = vi.fn();
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn(() => ({ auth: { getUser: getUserMock } })) }));
const createMock = vi.fn();
vi.mock("openai", () => {
  class MockOpenAI {
    responses = { create: createMock };
  }
  return { default: MockOpenAI, OpenAI: MockOpenAI };
});

const { createApp } = await import("../app");
const { FakeLLMAdapter } = await import("../infrastructure/ai/fake-adapter");
const { OpenAIAdapter } = await import("../infrastructure/ai/openai-adapter");
const { inMemoryProblemStore } = await import("../infrastructure/store/inMemoryProblemStore");

interface ChatBaseline {
  openaiChatRequests: Record<string, unknown>;
  routerChatArgs: Record<string, string>;
  routerChatResponses: Record<string, string>;
}

const BASELINE_PATH = join(dirname(fileURLToPath(import.meta.url)), "__baseline__", "chatOff.baseline.json");
const CAPTURE = process.env["STAGE5_BASELINE_CAPTURE"] === "1";

const PID_SOLVE = "88888888-8888-4888-8888-888888888881";
const PID_RESUME = "88888888-8888-4888-8888-888888888882";
const AUTH = { Authorization: "Bearer t" };

const SOLUTION: Solution = {
  conceptMd: "## 개념 설명\n꼭짓점",
  solutionMd: "## 풀이\n**1단계** 완전제곱식으로 바꾼다.\n**2단계** 꼭짓점을 읽는다.",
  answerMd: "최솟값은 -1입니다.",
  conceptTags: ["이차함수 > 최대·최소"],
  aiProvider: "openai",
  aiModel: "gpt-test",
};

const RESUME: ResumeSolution = {
  mode: "own",
  methodName: "3번째 줄부터 이어가기",
  solutionMd: "## 이어풀기\n**1단계** 양변을 정리한다.",
  answerMd: "-1",
  verified: true,
};

/** 결정적인 history(user/assistant 교대). `long`이면 턴마다 2,000자. */
function history(turns: number, long = false): ChatMessage[] {
  const messages: ChatMessage[] = [];
  for (let i = 0; i < turns; i += 1) {
    const filler = long ? "가".repeat(1_990) : "";
    messages.push({ role: i % 2 === 0 ? "user" : "assistant", content: `메시지 ${i + 1} ${filler}`.trimEnd() });
  }
  return messages;
}

const HISTORY_CASES: { key: string; messages: ChatMessage[] }[] = [
  { key: "h0", messages: history(0) },
  { key: "h3", messages: history(3) },
  { key: "h30", messages: history(30) },
  { key: "hLong30", messages: history(30, true) },
];

function seed(): void {
  inMemoryProblemStore.clear();
  inMemoryProblemStore.set({
    problemId: PID_SOLVE,
    userId: "user-1",
    grade: "M3",
    problem: { recognizedText: "이차함수 y = x^2 - 4x + 3의 최솟값을 구하시오.", recognizedLatex: "y=x^2-4x+3" },
    createdAt: "2026-10-25T00:00:00.000Z",
  });
  inMemoryProblemStore.setSolution(PID_SOLVE, SOLUTION);
  inMemoryProblemStore.set({
    problemId: PID_RESUME,
    userId: "user-1",
    grade: "H1",
    problem: { recognizedText: "2x - 1 = 5를 풀어라", recognizedLatex: null },
    createdAt: "2026-10-25T00:00:00.000Z",
  });
  inMemoryProblemStore.setResumeSolution(PID_RESUME, RESUME);
}

async function collectOpenAiRequests(): Promise<Record<string, unknown>> {
  createMock.mockReset();
  createMock.mockImplementation(() => Promise.resolve({ output_text: "답변" }));
  const adapter = new OpenAIAdapter("test-model", "test-key");
  const out: Record<string, unknown> = {};
  const contexts: { key: string; grade: Grade; solution: Solution; latex: string | null }[] = [
    { key: "solve-M3", grade: "M3", solution: SOLUTION, latex: "y=x^2-4x+3" },
    {
      key: "resume-H1",
      grade: "H1",
      solution: { conceptMd: null, solutionMd: RESUME.solutionMd, answerMd: RESUME.answerMd, conceptTags: [], aiProvider: "openai", aiModel: "" },
      latex: null,
    },
  ];
  for (const context of contexts) {
    for (const historyCase of HISTORY_CASES) {
      createMock.mockClear();
      await adapter.chat({
        problem: { recognizedText: "문제 원문", recognizedLatex: context.latex },
        solution: context.solution,
        history: historyCase.messages,
        question: "왜 꼭짓점이 최소인가요?",
        grade: context.grade,
      });
      expect(createMock).toHaveBeenCalledTimes(1);
      out[`${context.key}-${historyCase.key}`] = createMock.mock.calls[0];
    }
  }
  return out;
}

async function collectRouterChat(): Promise<{ args: Record<string, string>; responses: Record<string, string> }> {
  const args: Record<string, string> = {};
  const responses: Record<string, string> = {};
  for (const pid of [PID_SOLVE, PID_RESUME]) {
    for (const historyCase of HISTORY_CASES.slice(0, 3)) {
      seed();
      const adapter = new FakeLLMAdapter();
      const chatSpy = vi.spyOn(adapter, "chat");
      const res = await request(createApp(adapter))
        .post(`/api/problems/${pid}/chat`)
        .set(AUTH)
        .send({ question: "왜 그런가요?", history: historyCase.messages });
      expect(res.status).toBe(200);
      expect(chatSpy).toHaveBeenCalledTimes(1);
      const key = `${pid === PID_SOLVE ? "solve" : "resume"}-${historyCase.key}`;
      args[key] = JSON.stringify(chatSpy.mock.calls[0]);
      responses[key] = res.text;
    }
  }
  return { args, responses };
}

const baseline: ChatBaseline | null = existsSync(BASELINE_PATH)
  ? (JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as ChatBaseline)
  : null;

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  getUserMock.mockReset();
  getUserMock.mockResolvedValue({ data: { user: { id: "user-1", user_metadata: { grade: "M2" } } }, error: null });
});

describe("Stage 5 WU0 — CHAT off 바이트 기준값", () => {
  if (CAPTURE) {
    it("기준값 캡처(파일이 없을 때만)", async () => {
      expect(baseline).toBeNull();
      const openaiChatRequests = await collectOpenAiRequests();
      const router = await collectRouterChat();
      const captured: ChatBaseline = {
        openaiChatRequests,
        routerChatArgs: router.args,
        routerChatResponses: router.responses,
      };
      writeFileSync(BASELINE_PATH, `${JSON.stringify(captured, null, 2)}\n`);
    });
    return;
  }

  it("OpenAI chat 요청 본문(system·user 메시지)이 기준값과 같다 — history 0·3·30·긴 30턴, solve·resume 맥락", async () => {
    expect(baseline).not.toBeNull();
    const actual = await collectOpenAiRequests();
    expect(JSON.stringify(actual)).toBe(JSON.stringify(baseline?.openaiChatRequests));
  });

  it("라우터가 adapter.chat에 넘기는 인자와 응답 본문이 기준값과 같다", async () => {
    expect(baseline).not.toBeNull();
    const actual = await collectRouterChat();
    expect(actual.args).toEqual(baseline?.routerChatArgs);
    expect(actual.responses).toEqual(baseline?.routerChatResponses);
  });
});
