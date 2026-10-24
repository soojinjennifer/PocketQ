/**
 * Stage 3 WU5 — solve 라우터의 도형 단계(FIGURES on). 실제 Express + supertest로 끝까지 통과시킨다.
 * S3-2(chunk*→done→figures→종료), S3-3·4(도형 단위 보정), S3-5(실패 → figures 0·error 0), S3-6(구조 깨짐),
 * S3-10(연결 끊김 → abort, close 후 write 0), S3-11(생성 중복 0), done 뒤 error 금지.
 */
import { request as httpRequest } from "node:http";
import type { AddressInfo } from "node:net";
import { beforeEach, describe, expect, it, vi } from "vitest";
import express, { type Express } from "express";
import request from "supertest";
import type { Solution } from "shared-types";
import { parseSolutionFigures } from "validation";

const getUserMock = vi.fn();
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn(() => ({ auth: { getUser: getUserMock } })) }));

const { createSolutionsRouter } = await import("./solutions.router");
const { errorHandler } = await import("../../middleware/error-handler");
const { FakeLLMAdapter } = await import("../../infrastructure/ai/fake-adapter");
type FakeFigureScenario = import("../../infrastructure/ai/fake-adapter").FakeFigureScenario;
const { inMemoryProblemStore } = await import("../../infrastructure/store/inMemoryProblemStore");
const { problemRepository } = await import("../../infrastructure/persistence/problemRepository");
type FiguresRouteOptions = import("../figures/streamFigures").FiguresRouteOptions;
type LLMAdapter = import("../../infrastructure/ai/adapter").LLMAdapter;

const AUTH = { Authorization: "Bearer valid-token" };
const PID = "66666666-6666-4666-8666-666666666666";
const OPTIONS = { concept: true, solution: true };

interface SseEvent {
  event: string | null;
  data: string | null;
  comment: string | null;
}

function parseEvents(text: string): SseEvent[] {
  return text
    .split("\n\n")
    .filter((block) => block.length > 0)
    .map((block) => {
      let event: string | null = null;
      let data: string | null = null;
      let comment: string | null = null;
      for (const line of block.split("\n")) {
        if (line.startsWith("event: ")) event = line.slice(7);
        else if (line.startsWith("data: ")) data = line.slice(6);
        else if (line.startsWith(":")) comment = line;
      }
      return { event, data, comment };
    });
}

function createTestApp(adapter: LLMAdapter, options: FiguresRouteOptions, onWriteAfterClose?: () => void): Express {
  const app = express();
  app.use(express.json());
  if (onWriteAfterClose) {
    app.use((_req, res, next) => {
      let closed = false;
      res.on("close", () => {
        closed = true;
      });
      const write = res.write.bind(res) as (...args: unknown[]) => boolean;
      res.write = ((...args: unknown[]) => {
        if (closed) onWriteAfterClose();
        return write(...args);
      }) as typeof res.write;
      next();
    });
  }
  app.use("/api", createSolutionsRouter(adapter, options));
  app.use(errorHandler);
  return app;
}

function fake(scenario: FakeFigureScenario) {
  return new FakeLLMAdapter("claude", "fake-whymath-v0", { figureScenario: scenario });
}

async function solve(adapter: LLMAdapter, options: FiguresRouteOptions = { figuresEnabled: true }) {
  return request(createTestApp(adapter, options)).post(`/api/problems/${PID}/solve`).set(AUTH).send({ options: OPTIONS });
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

describe("S3-2 on 정상", () => {
  it("chunk* → done → figures → 종료, done payload에 figures 키 없음, figures는 재파싱 deep-equal·모르는 키 0", async () => {
    const adapter = fake("valid");
    const solveSpy = vi.spyOn(adapter, "solve");
    const res = await solve(adapter);
    expect(res.status).toBe(200);

    const events = parseEvents(res.text).filter((e) => e.event !== null);
    const names = events.map((e) => e.event);
    const doneIndex = names.indexOf("done");
    expect(names.slice(0, doneIndex).every((n) => n === "chunk")).toBe(true);
    expect(names.slice(doneIndex)).toEqual(["done", "figures"]);
    expect(names).not.toContain("error");

    // 어댑터에 단계 표지를 요청했다.
    expect(solveSpy.mock.calls[0]?.[0]).toMatchObject({ stepMarkers: true });

    const done = JSON.parse(events[doneIndex]?.data ?? "{}") as Record<string, unknown>;
    expect(Object.keys(done).sort()).toEqual(["aiModel", "aiProvider", "answerMd", "conceptMd", "conceptTags", "solutionMd"]);

    const figuresPayload = JSON.parse(events[doneIndex + 1]?.data ?? "{}") as Record<string, unknown>;
    expect(Object.keys(figuresPayload).sort()).toEqual(["figures", "stepFigureRefs"]);
    const reparsed = parseSolutionFigures(figuresPayload);
    expect(reparsed.rejected).toEqual([]);
    expect(reparsed.figures).toEqual(figuresPayload["figures"]);
    expect(reparsed.stepFigureRefs).toEqual(figuresPayload["stepFigureRefs"]);
    expect(reparsed.figures.map((f) => f.figureId)).toEqual(["fig-f07"]);
    expect(reparsed.stepFigureRefs.map((r) => r.stepId)).toEqual(["s1", "s2", "s3"]);
  });

  it("done payload는 어댑터 결과 그대로이고(라우터가 아무것도 더하지 않음) 저장 payload·저장소에도 figures 없음", async () => {
    const saveSpy = vi.spyOn(problemRepository, "saveSolution");
    const adapter = fake("valid");
    let adapterResult: Solution | null = null;
    const original = adapter.solve.bind(adapter);
    vi.spyOn(adapter, "solve").mockImplementation(async function* (req) {
      for await (const event of original(req)) {
        if ("done" in event) adapterResult = event.result;
        yield event;
      }
    });
    const res = await solve(adapter);
    const done = JSON.parse(/event: done\ndata: (.+)\n\n/.exec(res.text)?.[1] ?? "{}") as unknown;
    expect(done).toEqual(adapterResult);
    expect(saveSpy).toHaveBeenCalledWith({ problemId: PID, solution: done });
    expect(Object.keys(inMemoryProblemStore.get(PID)?.solution ?? {})).not.toContain("figures");
    saveSpy.mockRestore();
  });

  it("off 주입이면 figures·keep-alive 0, 어댑터에 stepMarkers 키 자체가 없다", async () => {
    const adapter = fake("valid");
    const solveSpy = vi.spyOn(adapter, "solve");
    const generateSpy = vi.spyOn(adapter, "generateFigures");
    const res = await solve(adapter, { figuresEnabled: false });
    expect(res.text).not.toContain("event: figures");
    expect(Object.keys(solveSpy.mock.calls[0]?.[0] ?? {})).not.toContain("stepMarkers");
    expect(generateSpy).not.toHaveBeenCalled();
  });
});

describe("S3-3·S3-4·S3-11 도형 단위 보정·중복 0", () => {
  it("invalid-then-repaired → 도형 2개, 생성 1회·보정 1회", async () => {
    const adapter = fake("invalid-then-repaired");
    const generateSpy = vi.spyOn(adapter, "generateFigures");
    const repairSpy = vi.spyOn(adapter, "repairFigure");
    const res = await solve(adapter);
    const figures = JSON.parse(/event: figures\ndata: (.+)\n\n/.exec(res.text)?.[1] ?? "{}") as { figures: { figureId: string }[] };
    expect(figures.figures.map((f) => f.figureId)).toEqual(["fig-f07", "fig-bad"]);
    expect(generateSpy).toHaveBeenCalledTimes(1);
    expect(repairSpy).toHaveBeenCalledTimes(1);
  });

  it("invalid-twice → 실패한 도형만 제외, 텍스트·나머지 도형 유지, error 0", async () => {
    const res = await solve(fake("invalid-twice"));
    const figures = JSON.parse(/event: figures\ndata: (.+)\n\n/.exec(res.text)?.[1] ?? "{}") as { figures: { figureId: string }[]; stepFigureRefs: { figureId: string }[] };
    expect(figures.figures.map((f) => f.figureId)).toEqual(["fig-f07"]);
    expect(figures.stepFigureRefs.every((r) => r.figureId === "fig-f07")).toBe(true);
    expect(res.text).toContain("event: done");
    expect(res.text).not.toContain("event: error");
  });
});

describe("S3-5·S3-6 실패 → figures 0, error 0, 정상 종료", () => {
  for (const scenario of ["throw", "none", "malformed"] as const) {
    it(scenario, async () => {
      const adapter = fake(scenario);
      const repairSpy = vi.spyOn(adapter, "repairFigure");
      const res = await solve(adapter);
      expect(res.status).toBe(200);
      expect(res.text).toContain("event: done");
      expect(res.text).not.toContain("event: figures");
      expect(res.text).not.toContain("event: error");
      expect(repairSpy).not.toHaveBeenCalled();
    });
  }

  it("hang(타임아웃) → keep-alive 주석이 done 뒤에 나가고, 전체 상한 후 figures·error 없이 종료", async () => {
    const res = await solve(fake("hang"), { figuresEnabled: true, keepAliveMs: 5, figuresTotalBudgetMs: 60 });
    const blocks = parseEvents(res.text);
    const doneIndex = blocks.findIndex((b) => b.event === "done");
    const keepAliveIndex = blocks.findIndex((b) => b.comment === ": keep-alive");
    expect(keepAliveIndex).toBeGreaterThan(doneIndex);
    expect(res.text).not.toContain("event: figures");
    expect(res.text).not.toContain("event: error");
  });

  it("on에서 done 뒤 어댑터 스트림이 throw해도 error 이벤트를 보내지 않는다(off는 기존대로 error)", async () => {
    const throwingAfterDone = (): LLMAdapter => {
      const adapter = fake("none");
      vi.spyOn(adapter, "solve").mockImplementation(async function* () {
        await Promise.resolve();
        yield { delta: "## 최종 답\n-1" };
        yield {
          done: true as const,
          result: { conceptMd: null, solutionMd: null, answerMd: "-1", conceptTags: [], aiProvider: "claude" as const, aiModel: "m" },
        };
        throw new Error("late failure");
      });
      return adapter;
    };
    const on = await solve(throwingAfterDone());
    expect(on.text).toContain("event: done");
    expect(on.text).not.toContain("event: error");
    const off = await solve(throwingAfterDone(), { figuresEnabled: false });
    expect(off.text).toContain("event: error");
  });
});

describe("S3-10 done 뒤 연결 끊김", () => {
  it("클라이언트가 끊으면 도형 호출 signal이 abort되고, close 후 write 0", async () => {
    const adapter = fake("hang");
    let figureSignal: AbortSignal | null = null;
    const original = adapter.generateFigures.bind(adapter);
    vi.spyOn(adapter, "generateFigures").mockImplementation((req) => {
      figureSignal = req.signal;
      return original(req);
    });
    let writesAfterClose = 0;
    const app = createTestApp(adapter, { figuresEnabled: true, keepAliveMs: 5, figuresTotalBudgetMs: 5_000 }, () => {
      writesAfterClose += 1;
    });
    const server = app.listen(0);
    try {
      const { port } = server.address() as AddressInfo;
      await new Promise<void>((resolve, reject) => {
        const req = httpRequest(
          { port, method: "POST", path: `/api/problems/${PID}/solve`, headers: { ...AUTH, "Content-Type": "application/json" } },
          (res) => {
            let text = "";
            res.setEncoding("utf8");
            res.on("data", (chunk: string) => {
              text += chunk;
              if (text.includes("event: done")) {
                req.destroy();
                resolve();
              }
            });
          },
        );
        req.on("error", () => undefined);
        req.on("close", () => resolve());
        req.end(JSON.stringify({ options: OPTIONS }));
        setTimeout(() => reject(new Error("timeout")), 3_000);
      });
      await vi.waitFor(() => {
        expect(figureSignal?.aborted).toBe(true);
      });
      // keep-alive 간격(5ms)보다 충분히 기다린 뒤에도 close 후 write가 없어야 한다.
      await new Promise((resolve) => setTimeout(resolve, 40));
      expect(writesAfterClose).toBe(0);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
