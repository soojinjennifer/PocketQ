/**
 * Stage 5 WU3 — solve 라우터의 도형 연결·저장(계획 §3.4). 실제 Express + supertest + 기본 `problemRepository` +
 * 메모리 가짜 Supabase(테스트 전용, 실제 연결 없음). 기본 저장소는 테스트마다 영속 플래그를 켠 새 저장소로 위임된다
 * (`useFreshRepository` — 탐지 상태가 테스트 사이에 새지 않게).
 * - 메모리 부착·DB 저장 각 1회, 저장값 = SSE figures 이벤트 deep-equal, 재조회 = SSE(어댑터 호출 0) — S5-3
 * - 재풀이 뒤 늦게 끝난 이전 실행의 쓰기 무시(메모리·DB) — S5-4
 * - 저장 실패·throw에도 done·figures 전송, error 0
 * - 마이그레이션 전(컬럼 없음): SSE 동일, 텍스트 저장, 도형 키 0 — S5-2
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import express, { type Express } from "express";
import request from "supertest";
import type { FigureCallResult, GenerateFiguresRequest, LLMAdapter } from "../../infrastructure/ai/adapter";
import { createFakeSupabase, tablesFor, type FakeSupabase } from "../../test-support/fakeSupabase";

const getUserMock = vi.fn();
const holder: { fake: FakeSupabase | null; repo: ProblemRepository | null } = { fake: null, repo: null };
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: getUserMock },
    from: (table: string) => {
      if (!holder.fake) throw new Error("fake supabase not set");
      return holder.fake.client.from(table);
    },
  })),
}));

const { createSolutionsRouter } = await import("./solutions.router");
const { createProblemsRouter } = await import("../problems/problems.router");
const { errorHandler } = await import("../../middleware/error-handler");
const { FakeLLMAdapter } = await import("../../infrastructure/ai/fake-adapter");
const { inMemoryProblemStore } = await import("../../infrastructure/store/inMemoryProblemStore");
const { problemRepository, createProblemRepository } = await import("../../infrastructure/persistence/problemRepository");
type ProblemRepository = import("../../infrastructure/persistence/problemRepository").ProblemRepository;

/**
 * 모듈 기본 저장소는 탐지 결과를 프로세스 동안 기억한다 — 테스트 사이 상태가 새지 않도록 매번 새 저장소(두 플래그 on)를 만들고
 * 기본 저장소의 메서드가 그 저장소로 위임되게 한다(라우터는 여전히 기본 `problemRepository`를 부른다).
 */
function useFreshRepository(fake: FakeSupabase): ProblemRepository {
  const repository = createProblemRepository(fake.client, { figuresPersistEnabled: true, resumePersistEnabled: true });
  for (const key of Object.keys(repository) as (keyof ProblemRepository)[]) {
    const target = repository[key] as (...args: unknown[]) => unknown;
    vi.spyOn(problemRepository, key).mockImplementation(((...args: unknown[]) => target(...args)) as never);
  }
  holder.repo = repository;
  return repository;
}

const AUTH = { Authorization: "Bearer valid-token" };
const PID = "cccccccc-cccc-4ccc-8ccc-ccccccccccc1";

function app(adapter: LLMAdapter): Express {
  const instance = express();
  instance.use(express.json());
  instance.use("/api", createSolutionsRouter(adapter, { figuresEnabled: true, keepAliveMs: 5 }));
  instance.use("/api", createProblemsRouter());
  instance.use(errorHandler);
  return instance;
}

function figuresEvent(text: string): unknown {
  const match = /event: figures\ndata: (.+)\n\n/.exec(text);
  return match?.[1] ? (JSON.parse(match[1]) as unknown) : null;
}

function events(text: string): string[] {
  return [...text.matchAll(/^event: (\w+)$/gm)].map((m) => m[1] ?? "");
}

function seed(): void {
  inMemoryProblemStore.clear();
  inMemoryProblemStore.set({
    problemId: PID,
    userId: "user-1",
    grade: "M2",
    problem: { recognizedText: "이차함수 y = x^2 - 4x + 3의 최솟값을 구하시오.", recognizedLatex: null },
    createdAt: "2026-10-25T00:00:00.000Z",
  });
}

function db(figureColumns: boolean): FakeSupabase {
  const fake = createFakeSupabase({
    tables: tablesFor({ figureColumns, resumeTable: false }),
    rows: {
      problems: [
        {
          id: PID,
          user_id: "user-1",
          grade: "M2",
          input_type: "photo",
          recognized_text: "이차함수 y = x^2 - 4x + 3의 최솟값을 구하시오.",
          recognized_latex: null,
          created_at: "2026-10-25T00:00:00.000Z",
        },
      ],
    },
  });
  holder.fake = fake;
  useFreshRepository(fake);
  return fake;
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  getUserMock.mockReset();
  getUserMock.mockResolvedValue({ data: { user: { id: "user-1", user_metadata: { grade: "M2" } } }, error: null });
  seed();
});

describe("S5-3 마이그레이션 후 + FIGURES_ENABLED·FIGURES_PERSIST on", () => {
  it("메모리 부착 1회·DB 도형 update 1회, 저장값·메모리·재조회 = SSE figures deep-equal, 재조회 시 어댑터 호출 0", async () => {
    const fake = db(true);
    const adapter = new FakeLLMAdapter("claude", "fake-whymath-v0", { figureScenario: "valid" });
    const attachSpy = vi.spyOn(inMemoryProblemStore, "attachSolutionFigures");
    const saveFiguresSpy = vi.spyOn(problemRepository, "saveSolutionFigures");
    const res = await request(app(adapter)).post(`/api/problems/${PID}/solve`).set(AUTH).send({ options: { concept: true, solution: true } });

    expect(events(res.text)).toEqual([...events(res.text).filter((e) => e === "chunk"), "done", "figures"]);
    const sse = figuresEvent(res.text) as { figures: unknown[]; stepFigureRefs: unknown[] };
    expect(sse.figures.length).toBeGreaterThan(0);
    expect(attachSpy).toHaveBeenCalledTimes(1);
    expect(saveFiguresSpy).toHaveBeenCalledTimes(1);
    expect(inMemoryProblemStore.getSolutionFigures(PID)).toEqual(sse);

    const row = fake.rows("solutions")[0];
    expect(row?.["figures"]).toEqual(sse.figures);
    expect(row?.["step_figure_refs"]).toEqual(sse.stepFigureRefs);
    expect(row?.["figures_schema_version"]).toBe(1);
    expect(typeof row?.["figures_run_id"]).toBe("string");
    expect(fake.calls.filter((c) => c.ops[0]?.method === "update")).toHaveLength(1);

    const generate = vi.spyOn(adapter, "generateFigures");
    const repair = vi.spyOn(adapter, "repairFigure");
    const detail = await request(app(adapter)).get(`/api/problems/${PID}`).set(AUTH);
    expect(detail.status).toBe(200);
    const body = detail.body as { solution: { figures: unknown; stepFigureRefs: unknown } };
    expect(body.solution.figures).toEqual(sse.figures);
    expect(body.solution.stepFigureRefs).toEqual(sse.stepFigureRefs);
    expect(generate).not.toHaveBeenCalled();
    expect(repair).not.toHaveBeenCalled();
  });

  it("도형 0(none)이면 부착·update 0, 텍스트 행의 도형 컬럼은 null", async () => {
    const fake = db(true);
    const adapter = new FakeLLMAdapter("claude", "fake-whymath-v0", { figureScenario: "none" });
    const res = await request(app(adapter)).post(`/api/problems/${PID}/solve`).set(AUTH).send({ options: { concept: true, solution: true } });
    expect(res.text).not.toContain("event: figures");
    expect(inMemoryProblemStore.getSolutionFigures(PID)).toBeUndefined();
    expect(fake.calls.some((c) => c.ops[0]?.method === "update")).toBe(false);
    expect(fake.rows("solutions")[0]).toMatchObject({ figures: null, step_figure_refs: null, figures_schema_version: null });
  });

  it("저장소·메모리 부착이 throw해도 done·figures는 그대로, error 0", async () => {
    db(true);
    const adapter = new FakeLLMAdapter("claude", "fake-whymath-v0", { figureScenario: "valid" });
    vi.spyOn(problemRepository, "saveSolutionFigures").mockRejectedValue(new Error("db down"));
    vi.spyOn(inMemoryProblemStore, "attachSolutionFigures").mockImplementation(() => {
      throw new Error("boom");
    });
    const res = await request(app(adapter)).post(`/api/problems/${PID}/solve`).set(AUTH).send({ options: { concept: true, solution: true } });
    expect(events(res.text).slice(-2)).toEqual(["done", "figures"]);
    expect(res.text).not.toContain("event: error");
  });
});

describe("S5-4 재풀이 — 늦게 끝난 이전 실행은 메모리·DB 모두 반영되지 않는다", () => {
  it("run1 도형 단계 대기 중 run2 완료 → run1 도형 도착: 메모리·DB·재조회는 run2 도형", async () => {
    const fake = db(true);
    const base = new FakeLLMAdapter("claude", "fake-whymath-v0", { figureScenario: "valid" });
    let releaseFirst: () => void = () => undefined;
    const firstGate = new Promise<void>((resolve) => (releaseFirst = resolve));
    let calls = 0;
    const original = base.generateFigures.bind(base);
    vi.spyOn(base, "generateFigures").mockImplementation(async (req: GenerateFiguresRequest): Promise<FigureCallResult> => {
      calls += 1;
      if (calls === 1) {
        await firstGate;
        const result = await original(req);
        // 이전 실행의 도형은 run2와 구별되도록 설명만 바꾼다(검증은 그대로 통과).
        const raw = result.raw as { figures: { description: string }[] };
        raw.figures[0]!.description = "이전 실행의 그림";
        return result;
      }
      return original(req);
    });

    const first = request(app(base)).post(`/api/problems/${PID}/solve`).set(AUTH).send({ options: { concept: true, solution: true } });
    const firstDone = first.then((r) => r);
    await vi.waitFor(() => expect(calls).toBe(1));
    const runOne = fake.rows("solutions")[0]?.["figures_run_id"];

    const second = await request(app(base)).post(`/api/problems/${PID}/solve`).set(AUTH).send({ options: { concept: true, solution: true } });
    const secondSse = figuresEvent(second.text) as { figures: { description: string }[] };
    const runTwo = fake.rows("solutions")[0]?.["figures_run_id"];
    expect(runTwo).not.toBe(runOne);

    releaseFirst();
    const firstRes = await firstDone;
    const firstSse = figuresEvent(firstRes.text) as { figures: { description: string }[] };
    expect(firstSse.figures[0]?.description).toBe("이전 실행의 그림"); // run1 클라이언트는 자기 도형을 받는다

    expect(inMemoryProblemStore.getSolutionFigures(PID)).toEqual(secondSse);
    expect(fake.rows("solutions")).toHaveLength(1);
    expect(fake.rows("solutions")[0]?.["figures"]).toEqual(secondSse.figures);
    const detail = await request(app(base)).get(`/api/problems/${PID}`).set(AUTH);
    expect((detail.body as { solution: { figures: unknown } }).solution.figures).toEqual(secondSse.figures);
  });
});

describe("S5-2 마이그레이션 전 + on(컬럼 없음)", () => {
  it("SSE는 컬럼 있음과 같은 바이트, 텍스트만 저장, 상세에 도형 키 없음", async () => {
    const fake = db(false);
    const adapter = new FakeLLMAdapter("claude", "fake-whymath-v0", { figureScenario: "valid" });
    const res = await request(app(adapter)).post(`/api/problems/${PID}/solve`).set(AUTH).send({ options: { concept: true, solution: true } });
    expect(events(res.text).slice(-2)).toEqual(["done", "figures"]);
    expect(Object.keys(fake.rows("solutions")[0] ?? {})).not.toContain("figures");
    expect(fake.calls.some((c) => c.ops[0]?.method === "update")).toBe(false);
    const detail = await request(app(adapter)).get(`/api/problems/${PID}`).set(AUTH);
    expect(detail.status).toBe(200);
    expect(Object.keys((detail.body as { solution: object }).solution)).not.toContain("figures");
    // CHAT용 메모리 부착은 영속 여부와 무관하다.
    expect(inMemoryProblemStore.getSolutionFigures(PID)).toEqual(figuresEvent(res.text));

    seed();
    db(true);
    const withColumns = await request(app(adapter)).post(`/api/problems/${PID}/solve`).set(AUTH).send({ options: { concept: true, solution: true } });
    expect(withColumns.text).toBe(res.text);
  });
});
