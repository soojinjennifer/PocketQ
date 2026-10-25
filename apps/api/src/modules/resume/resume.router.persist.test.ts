/**
 * Stage 5 WU3 — resume 라우터의 결과 저장·도형 연결(계획 §3.5). 실제 Express + supertest + 기본 `problemRepository` +
 * 메모리 가짜 Supabase(테스트 전용, 실제 연결 없음). 기본 저장소는 테스트마다 두 영속 플래그를 켠 새 저장소로 위임되고
 * (`useFreshRepository`), 라우터의 `resumePersistEnabled`는 직접 주입한다.
 * RS1(off 호출 0·SSE 동일), RS3(verified만 done **전** upsert 1회, 저장값 = done payload, 실패는 쓰기 0),
 * RS4(모드 변경 1행 교체), RS5(도형 저장 = SSE, 재조회 어댑터 호출 0), RS9(저장 throw에도 done·error 0), S5-7 메모리 부착.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import express, { type Express } from "express";
import request from "supertest";
import type { Diagnosis, ResumeMode } from "shared-types";
import type { LLMAdapter } from "../../infrastructure/ai/adapter";
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

const { createResumeRouter } = await import("./resume.router");
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
type FakeFigureScenario = import("../../infrastructure/ai/fake-adapter").FakeFigureScenario;

const AUTH = { Authorization: "Bearer valid-token" };
const PID = "dddddddd-dddd-4ddd-8ddd-ddddddddddd1";

const DIAG: Diagnosis = {
  lastValidLine: 1,
  stallLine: 2,
  errorTypeLabel: "부호 오류",
  errorDetail: "x",
  relatedConcepts: [],
  reachedAnswerWithNotes: false,
  isLowConfidence: false,
  conceptExplanations: [],
  identifiedMethod: { methodId: "perfect-square", methodName: "완전제곱식" },
  isMethodApplicable: true,
  methodApplicabilityNote: null,
  problemAnswerLatex: "-1",
};

function fakeCas(verified = true) {
  return {
    verifyWorkLines: vi.fn(() => Promise.resolve([])),
    verifyFinalAnswer: vi.fn(() => Promise.resolve({ verified })),
  };
}

/** 응답 쓰기 순서를 `log`에 남기는 앱(저장 호출이 done보다 먼저인지 확인용). */
function app(
  adapter: LLMAdapter,
  cas: ReturnType<typeof fakeCas>,
  options: { figuresEnabled: boolean; resumePersistEnabled: boolean },
  log: string[] = [],
): Express {
  const instance = express();
  instance.use(express.json());
  instance.use((_req, res, next) => {
    const write = res.write.bind(res) as (...args: unknown[]) => boolean;
    res.write = ((...args: unknown[]) => {
      const chunk = String(args[0]);
      const name = /^event: (\w+)/.exec(chunk)?.[1];
      if (name) log.push(`write:${name}`);
      return write(...args);
    }) as typeof res.write;
    next();
  });
  instance.use("/api", createResumeRouter(adapter, cas, { ...options, keepAliveMs: 5 }));
  instance.use("/api", createProblemsRouter());
  instance.use(errorHandler);
  return instance;
}

function fake(scenario: FakeFigureScenario = "valid") {
  return new FakeLLMAdapter("claude", "fake-whymath-v0", { figureScenario: scenario });
}

function events(text: string): string[] {
  return [...text.matchAll(/^event: (\w+)$/gm)].map((m) => m[1] ?? "");
}

function donePayload(text: string): unknown {
  return JSON.parse(/event: done\ndata: (.+)\n\n/.exec(text)?.[1] ?? "null") as unknown;
}

function figuresPayload(text: string): { figures: unknown[]; stepFigureRefs: unknown[] } | null {
  const match = /event: figures\ndata: (.+)\n\n/.exec(text);
  return match?.[1] ? (JSON.parse(match[1]) as { figures: unknown[]; stepFigureRefs: unknown[] }) : null;
}

function db(resumeTable = true): FakeSupabase {
  const fakeDb = createFakeSupabase({
    tables: tablesFor({ figureColumns: true, resumeTable }),
    rows: {
      problems: [
        {
          id: PID,
          user_id: "user-1",
          grade: "M2",
          input_type: "handwriting",
          recognized_text: "이차함수의 최솟값",
          recognized_latex: null,
          created_at: "2026-10-25T00:00:00.000Z",
        },
      ],
    },
  });
  holder.fake = fakeDb;
  useFreshRepository(fakeDb);
  return fakeDb;
}

async function resume(target: Express, mode: ResumeMode = "own") {
  return request(target).post(`/api/problems/${PID}/resume`).set(AUTH).send({ mode });
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  getUserMock.mockReset();
  getUserMock.mockResolvedValue({ data: { user: { id: "user-1", user_metadata: { grade: "M2" } } }, error: null });
  inMemoryProblemStore.clear();
  inMemoryProblemStore.set({
    problemId: PID,
    userId: "user-1",
    grade: "M2",
    problem: { recognizedText: "이차함수의 최솟값", recognizedLatex: null },
    createdAt: "2026-10-25T00:00:00.000Z",
    workLines: [
      { lineNo: 1, latex: "y = x^{2} - 4x + 3", isLowConfidence: false },
      { lineNo: 2, latex: "y=(x+2)^2-1", isLowConfidence: false },
    ],
    diagnosis: DIAG,
  });
});

describe("RS1 resumePersistEnabled off", () => {
  it("저장소 메서드 호출 0, Supabase 호출 0, SSE는 persist on과 같은 바이트", async () => {
    const fakeDb = db();
    const saveSpy = vi.spyOn(problemRepository, "saveResumeSolution");
    const figSpy = vi.spyOn(problemRepository, "saveResumeFigures");
    const off = await resume(app(fake("none"), fakeCas(), { figuresEnabled: false, resumePersistEnabled: false }));
    expect(saveSpy).not.toHaveBeenCalled();
    expect(figSpy).not.toHaveBeenCalled();
    expect(fakeDb.calls).toHaveLength(0);

    const on = await resume(app(fake("none"), fakeCas(), { figuresEnabled: false, resumePersistEnabled: true }));
    expect(on.text).toBe(off.text);
  });
});

describe("RS3 verified 결과만 done 직전 upsert", () => {
  it("verified=true: done 쓰기 전에 upsert 1회, 저장 행 = done payload(+ai·시각·도형 null·run id)", async () => {
    const fakeDb = db();
    const log: string[] = [];
    const fresh = holder.repo;
    if (!fresh) throw new Error("repo not set");
    const saveSpy = vi.spyOn(problemRepository, "saveResumeSolution").mockImplementation(async (input) => {
      log.push("save");
      await fresh.saveResumeSolution(input);
    });
    const res = await resume(app(fake("none"), fakeCas(true), { figuresEnabled: false, resumePersistEnabled: true }, log));
    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(log.indexOf("save")).toBeLessThan(log.indexOf("write:done"));
    const done = donePayload(res.text) as Record<string, unknown>;
    expect(done["verified"]).toBe(true);
    const rows = fakeDb.rows("resume_solutions");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      problem_id: PID,
      mode: done["mode"],
      method_name: done["methodName"],
      solution_md: done["solutionMd"],
      answer_md: done["answerMd"],
      verified: true,
      figures: null,
      step_figure_refs: null,
      figures_schema_version: null,
    });
    expect(fakeDb.calls.filter((c) => c.ops[0]?.method === "upsert")).toHaveLength(1);
  });

  it("verified=false: 쓰기 0, 이전 통과 행 유지, SSE·메모리는 기존대로", async () => {
    const fakeDb = db();
    await resume(app(fake("none"), fakeCas(true), { figuresEnabled: false, resumePersistEnabled: true }));
    const before = fakeDb.rows("resume_solutions");
    fakeDb.clearCalls();
    const res = await resume(app(fake("none"), fakeCas(false), { figuresEnabled: false, resumePersistEnabled: true }), "alternative");
    expect((donePayload(res.text) as { verified: boolean }).verified).toBe(false);
    expect(fakeDb.calls.filter((c) => c.ops.some((o) => ["upsert", "update", "insert"].includes(o.method)))).toHaveLength(0);
    expect(fakeDb.rows("resume_solutions")).toEqual(before);
    expect(inMemoryProblemStore.get(PID)?.resumeSolution?.verified).toBe(false);
  });

  it("RS9 저장이 throw해도 done 전송, error 0", async () => {
    db();
    vi.spyOn(problemRepository, "saveResumeSolution").mockRejectedValue(new Error("db down"));
    const res = await resume(app(fake("none"), fakeCas(true), { figuresEnabled: false, resumePersistEnabled: true }));
    expect(events(res.text)).toContain("done");
    expect(res.text).not.toContain("event: error");
  });

  it("RS2 테이블 없음: SSE 정상·오류 0, 상세 200·resumeSolution 키 없음", async () => {
    db(false);
    const res = await resume(app(fake("none"), fakeCas(true), { figuresEnabled: false, resumePersistEnabled: true }));
    expect(events(res.text)).toContain("done");
    expect(res.text).not.toContain("event: error");
    const detail = await request(app(fake("none"), fakeCas(), { figuresEnabled: false, resumePersistEnabled: true }))
      .get(`/api/problems/${PID}`)
      .set(AUTH);
    expect(detail.status).toBe(200);
    expect(detail.body).not.toHaveProperty("resumeSolution");
  });
});

describe("RS4·RS5·S5-7 도형 연결·저장(FIGURES_ENABLED on)", () => {
  it("메모리 부착·DB 도형 = SSE figures, 재조회 resumeSolution.figures = SSE(어댑터 호출 0), 모드 변경은 1행 교체", async () => {
    const fakeDb = db();
    const adapter = fake("valid");
    const target = app(adapter, fakeCas(true), { figuresEnabled: true, resumePersistEnabled: true });
    const own = await resume(target, "own");
    const ownFigures = figuresPayload(own.text);
    expect(ownFigures?.figures.length).toBeGreaterThan(0);
    expect(inMemoryProblemStore.getResumeFigures(PID)).toEqual(ownFigures);
    expect(fakeDb.rows("resume_solutions")[0]?.["figures"]).toEqual(ownFigures?.figures);

    const generate = vi.spyOn(adapter, "generateFigures");
    const detail = await request(target).get(`/api/problems/${PID}`).set(AUTH);
    expect(detail.status).toBe(200);
    const body = detail.body as { solution: unknown; resumeSolution: { mode: string; figures: unknown; stepFigureRefs: unknown } };
    expect(body.solution).toBeNull();
    expect(body.resumeSolution.mode).toBe("own");
    expect(body.resumeSolution.figures).toEqual(ownFigures?.figures);
    expect(body.resumeSolution.stepFigureRefs).toEqual(ownFigures?.stepFigureRefs);
    expect(generate).not.toHaveBeenCalled();
    generate.mockRestore();

    const alternative = await resume(target, "alternative");
    expect(fakeDb.rows("resume_solutions")).toHaveLength(1);
    expect(fakeDb.rows("resume_solutions")[0]?.["mode"]).toBe("alternative");
    expect(fakeDb.rows("resume_solutions")[0]?.["figures"]).toEqual(figuresPayload(alternative.text)?.figures);
    const runIds = fakeDb.calls
      .filter((c) => c.table === "resume_solutions" && c.ops[0]?.method === "upsert")
      .map((c) => (c.ops[0]?.args[0] as { figures_run_id: string }).figures_run_id);
    expect(new Set(runIds).size).toBe(2);
  });

  it("verified=false면 메모리 부착은 하되(CHAT용) DB 도형 쓰기 0", async () => {
    const fakeDb = db();
    const res = await resume(app(fake("valid"), fakeCas(false), { figuresEnabled: true, resumePersistEnabled: true }));
    expect(figuresPayload(res.text)?.figures.length).toBeGreaterThan(0);
    expect(inMemoryProblemStore.getResumeFigures(PID)).toEqual(figuresPayload(res.text));
    expect(fakeDb.rows("resume_solutions")).toHaveLength(0);
    expect(fakeDb.calls.some((c) => c.ops[0]?.method === "update")).toBe(false);
  });
});

describe("RS11 workContext — 진단에 쓴 줄·진단값 저장·재조회(§12.1·§12.2)", () => {
  it("diagnosedWorkLines 우선, 진단 lastValidLine·stallLine과 함께 저장되고 상세 workContext = 진단 입력 deep-equal", async () => {
    const fakeDb = db();
    const diagnosed = [
      { lineNo: 2, latex: "y=(x-2)^2-1", isLowConfidence: false },
      { lineNo: 1, latex: "y = x^{2} - 4x + 3", isLowConfidence: false },
    ];
    inMemoryProblemStore.setDiagnosedWorkLines(PID, diagnosed);
    const target = app(fake("none"), fakeCas(true), { figuresEnabled: false, resumePersistEnabled: true });
    await resume(target, "own");
    const expected = {
      lines: [
        { lineNo: 1, latex: "y = x^{2} - 4x + 3" },
        { lineNo: 2, latex: "y=(x-2)^2-1" },
      ],
      lastValidLine: DIAG.lastValidLine,
      stallLine: DIAG.stallLine,
    };
    expect(fakeDb.rows("resume_solutions")[0]).toMatchObject({ work_lines: expected.lines, last_valid_line: 1, stall_line: 2 });
    const detail = await request(target).get(`/api/problems/${PID}`).set(AUTH);
    expect((detail.body as { resumeSolution: { workContext: unknown } }).resumeSolution.workContext).toEqual(expected);
  });

  it("diagnosedWorkLines가 없으면 인식 원본 workLines를 쓴다, alternative도 저장한다", async () => {
    const fakeDb = db();
    await resume(app(fake("none"), fakeCas(true), { figuresEnabled: false, resumePersistEnabled: true }), "alternative");
    expect(fakeDb.rows("resume_solutions")[0]?.["work_lines"]).toEqual([
      { lineNo: 1, latex: "y = x^{2} - 4x + 3" },
      { lineNo: 2, latex: "y=(x+2)^2-1" },
    ]);
  });
});

describe("재작업 1 — 라우터 층 verified 가드(QA LOW-2)", () => {
  it("저장소 가드를 우회하는 저장 함수로 바꿔도 verified=false면 라우터가 부르지 않는다(쓰기 0)", async () => {
    const fakeDb = db();
    // 저장소의 verified 가드 없이 무조건 쓰는 대체 구현 — 라우터의 조기 반환만이 쓰기를 막는다.
    const bypass = vi.spyOn(problemRepository, "saveResumeSolution").mockImplementation(async ({ problemId, resumeSolution }) => {
      await fakeDb.client.from("resume_solutions").upsert({
        problem_id: problemId,
        mode: resumeSolution.mode,
        method_name: resumeSolution.methodName,
        solution_md: resumeSolution.solutionMd,
        answer_md: resumeSolution.answerMd,
        verified: resumeSolution.verified,
        ai_provider: "openai",
        ai_model: "m",
      });
    });
    const figuresBypass = vi.spyOn(problemRepository, "saveResumeFigures");
    const res = await resume(app(fake("valid"), fakeCas(false), { figuresEnabled: true, resumePersistEnabled: true }));
    expect(events(res.text)).toContain("done");
    expect(bypass).not.toHaveBeenCalled();
    expect(figuresBypass).not.toHaveBeenCalled();
    expect(fakeDb.rows("resume_solutions")).toHaveLength(0);

    // 대조: verified=true면 같은 대체 구현이 불린다(테스트가 공허하지 않음).
    await resume(app(fake("none"), fakeCas(true), { figuresEnabled: false, resumePersistEnabled: true }));
    expect(bypass).toHaveBeenCalledTimes(1);
    expect(fakeDb.rows("resume_solutions")).toHaveLength(1);
  });
});
