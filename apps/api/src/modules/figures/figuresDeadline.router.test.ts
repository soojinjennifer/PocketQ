/**
 * Stage 4 WU2·WU4 — 도형 단계 하드 데드라인과 클라이언트 중단(실제 Express).
 * - S4-L1: signal을 무시하고 영원히 대기하는 어댑터 + 상한 100ms → 상한+여유 안에 SSE 종료(figures·error 0).
 * - S4-L2: 1차 통과 1 + 보정 hang + 상한 만료 → 통과 도형 1개만 전송. 클라이언트가 끊겼으면 전송 0.
 * - S4-L4(서버 쪽): 실제 HTTP에서 클라이언트가 `fetch`를 AbortController로 중단하면 서버의 도형 호출 signal이 abort된다
 *   (웹 훅은 reset·새 요청·언마운트 때 이 abort를 건다 — `apps/web/src/features/ai-solution/useSolveStream.test.tsx`).
 */
import type { AddressInfo } from "node:net";
import { beforeEach, describe, expect, it, vi } from "vitest";
import express, { type Express } from "express";
import request from "supertest";
import { F07_QUADRATIC } from "validation/fixtures";

const getUserMock = vi.fn();
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn(() => ({ auth: { getUser: getUserMock } })) }));

const { createSolutionsRouter } = await import("../solutions/solutions.router");
const { createResumeRouter } = await import("../resume/resume.router");
const { errorHandler } = await import("../../middleware/error-handler");
const { FakeLLMAdapter } = await import("../../infrastructure/ai/fake-adapter");
const { inMemoryProblemStore } = await import("../../infrastructure/store/inMemoryProblemStore");
type FiguresRouteOptions = import("./streamFigures").FiguresRouteOptions;
type LLMAdapter = import("../../infrastructure/ai/adapter").LLMAdapter;
type FigureCallResult = import("../../infrastructure/ai/adapter").FigureCallResult;

const AUTH = { Authorization: "Bearer valid-token" };
const PID = "77777777-7777-4777-8777-777777777777";
const OPTIONS = { concept: true, solution: true };

function figure(figureId: string, broken: boolean): Record<string, unknown> {
  const raw = JSON.parse(JSON.stringify(F07_QUADRATIC.raw)) as { figureId: string; elements: Record<string, unknown>[] };
  raw.figureId = figureId;
  if (broken) {
    const vertex = raw.elements[1];
    if (vertex) vertex["graph"] = "missing";
  }
  return raw;
}

const forever = (): Promise<FigureCallResult> => new Promise<FigureCallResult>(() => undefined);

function createApp(adapter: LLMAdapter, options: FiguresRouteOptions, onWrite?: (chunk: string, closed: boolean) => void): Express {
  const app = express();
  app.use(express.json());
  if (onWrite) {
    app.use((_req, res, next) => {
      let closed = false;
      res.on("close", () => {
        closed = true;
      });
      const write = res.write.bind(res) as (...args: unknown[]) => boolean;
      res.write = ((...args: unknown[]) => {
        onWrite(String(args[0]), closed);
        return write(...args);
      }) as typeof res.write;
      next();
    });
  }
  app.use("/api", createSolutionsRouter(adapter, options));
  const cas = { verifyWorkLines: vi.fn(() => Promise.resolve([])), verifyFinalAnswer: vi.fn(() => Promise.resolve({ verified: true })) };
  app.use("/api", createResumeRouter(adapter, cas, options));
  app.use(errorHandler);
  return app;
}

function figureEvents(text: string): { figures: { figureId: string }[] }[] {
  return text
    .split("\n\n")
    .filter((block) => block.startsWith("event: figures"))
    .map((block) => JSON.parse(block.split("\n")[1]?.slice(6) ?? "null") as { figures: { figureId: string }[] });
}

beforeEach(() => {
  getUserMock.mockReset();
  getUserMock.mockResolvedValue({ data: { user: { id: "user-1", user_metadata: { grade: "M2" } } }, error: null });
  inMemoryProblemStore.clear();
  inMemoryProblemStore.set({
    problemId: PID,
    userId: "user-1",
    grade: "M2",
    problem: { recognizedText: "이차함수 y = x^2 - 4x + 3의 최솟값을 구하시오.", recognizedLatex: null },
    createdAt: new Date().toISOString(),
  });
});

describe("S4-L1 하드 데드라인(라우터)", () => {
  it("signal을 무시하는 영구 대기 생성 + 상한 100ms → 상한+여유 안에 SSE 종료, figures·error 0", async () => {
    const adapter = new FakeLLMAdapter("claude", "fake-whymath-v0", { figureScenario: "valid" });
    let signal: AbortSignal | null = null;
    vi.spyOn(adapter, "generateFigures").mockImplementation((req) => {
      signal = req.signal;
      return forever();
    });
    const startedAt = Date.now();
    const res = await request(createApp(adapter, { figuresEnabled: true, keepAliveMs: 20, figuresTotalBudgetMs: 100 }))
      .post(`/api/problems/${PID}/solve`)
      .set(AUTH)
      .send({ options: OPTIONS })
      .timeout(3_000);
    const elapsed = Date.now() - startedAt;

    expect(elapsed).toBeLessThan(100 + 900);
    expect(res.text).toContain("event: done");
    expect(res.text).not.toContain("event: figures");
    expect(res.text).not.toContain("event: error");
    expect((signal as AbortSignal | null)?.aborted).toBe(true);
  });
});

describe("S4-L2 상한 만료 시 1차 통과 도형 보존", () => {
  function partialAdapter(): { adapter: InstanceType<typeof FakeLLMAdapter>; repairSignals: AbortSignal[] } {
    const adapter = new FakeLLMAdapter("claude", "fake-whymath-v0", { figureScenario: "valid" });
    const repairSignals: AbortSignal[] = [];
    vi.spyOn(adapter, "generateFigures").mockResolvedValue({
      raw: { figures: [figure("fig-ok", false), figure("fig-bad", true)], stepFigureRefs: [{ stepId: "s1", figureId: "fig-ok" }], omitReason: null },
      usage: null,
    });
    vi.spyOn(adapter, "repairFigure").mockImplementation((req) => {
      repairSignals.push(req.signal);
      return forever();
    });
    return { adapter, repairSignals };
  }

  it("solve: 통과 도형 1개만 figures로 전송, 보정 호출 abort", async () => {
    const { adapter, repairSignals } = partialAdapter();
    const res = await request(createApp(adapter, { figuresEnabled: true, keepAliveMs: 20, figuresTotalBudgetMs: 100 }))
      .post(`/api/problems/${PID}/solve`)
      .set(AUTH)
      .send({ options: OPTIONS })
      .timeout(3_000);
    const events = figureEvents(res.text);
    expect(events).toHaveLength(1);
    expect(events[0]?.figures.map((f) => f.figureId)).toEqual(["fig-ok"]);
    expect(res.text).not.toContain("event: error");
    expect(repairSignals[0]?.aborted).toBe(true);
  });

  it("클라이언트가 done 뒤 끊으면(상한 전) figures 전송 0, close 후 write 0", async () => {
    const { adapter, repairSignals } = partialAdapter();
    const writes: { chunk: string; closed: boolean }[] = [];
    const app = createApp(adapter, { figuresEnabled: true, keepAliveMs: 5, figuresTotalBudgetMs: 5_000 }, (chunk, closed) => {
      writes.push({ chunk, closed });
    });
    const server = app.listen(0);
    try {
      const { port } = server.address() as AddressInfo;
      const controller = new AbortController();
      const response = await fetch(`http://127.0.0.1:${port}/api/problems/${PID}/solve`, {
        method: "POST",
        headers: { ...AUTH, "Content-Type": "application/json" },
        body: JSON.stringify({ options: OPTIONS }),
        signal: controller.signal,
      });
      const reader = response.body?.getReader() as ReadableStreamDefaultReader<Uint8Array> | undefined;
      const decoder = new TextDecoder();
      let text = "";
      while (reader && !text.includes("event: done")) {
        const { value, done } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
      }
      await vi.waitFor(() => expect(repairSignals).toHaveLength(1));
      controller.abort();
      await vi.waitFor(() => expect(repairSignals[0]?.aborted).toBe(true));
      await new Promise((resolve) => setTimeout(resolve, 40));
      expect(writes.some((w) => w.chunk.includes("event: figures"))).toBe(false);
      expect(writes.filter((w) => w.closed)).toEqual([]);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

describe("S4-L4 서버 쪽 — 클라이언트 fetch 중단 → 도형 호출 abort(실제 HTTP)", () => {
  it.each(["solve", "resume"] as const)("%s: done 수신 뒤 AbortController.abort() → 서버 generateFigures signal aborted", async (route) => {
    const adapter = new FakeLLMAdapter("claude", "fake-whymath-v0", { figureScenario: "hang" });
    const signals: AbortSignal[] = [];
    const original = adapter.generateFigures.bind(adapter);
    vi.spyOn(adapter, "generateFigures").mockImplementation((req) => {
      signals.push(req.signal);
      return original(req);
    });
    if (route === "resume") {
      inMemoryProblemStore.setWorkLines(PID, [{ lineNo: 1, latex: "y = x^{2} - 4x + 3", isLowConfidence: false }]);
      inMemoryProblemStore.setDiagnosis(PID, {
        lastValidLine: 1,
        stallLine: 2,
        errorTypeLabel: null,
        errorDetail: null,
        relatedConcepts: [],
        reachedAnswerWithNotes: false,
        isLowConfidence: false,
        conceptExplanations: [],
        identifiedMethod: null,
        isMethodApplicable: true,
        methodApplicabilityNote: null,
        problemAnswerLatex: "-1",
      });
    }
    const server = createApp(adapter, { figuresEnabled: true, keepAliveMs: 5, figuresTotalBudgetMs: 5_000 }).listen(0);
    try {
      const { port } = server.address() as AddressInfo;
      const controller = new AbortController();
      const response = await fetch(`http://127.0.0.1:${port}/api/problems/${PID}/${route}`, {
        method: "POST",
        headers: { ...AUTH, "Content-Type": "application/json" },
        body: JSON.stringify(route === "solve" ? { options: OPTIONS } : { mode: "own" }),
        signal: controller.signal,
      });
      expect(response.status).toBe(200);
      const reader = response.body?.getReader() as ReadableStreamDefaultReader<Uint8Array> | undefined;
      const decoder = new TextDecoder();
      let text = "";
      while (reader && !text.includes("event: done")) {
        const { value, done } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
      }
      expect(text).toContain("event: done");
      await vi.waitFor(() => expect(signals).toHaveLength(1));
      expect(signals[0]?.aborted).toBe(false);

      controller.abort();
      await expect(reader?.read()).rejects.toMatchObject({ name: "AbortError" });
      await vi.waitFor(() => expect(signals[0]?.aborted).toBe(true));
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
