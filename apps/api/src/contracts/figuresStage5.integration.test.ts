/**
 * Stage 5 WU8 — 10개 사례 서버 왕복(계획 §6.1). 테스트 전용 stub 어댑터가 고정 fixture를 돌려준다(fake-adapter 무변경).
 *
 * 경로: solve SSE → `event: figures` → 메모리 연결 → DB 저장(메모리 가짜 Supabase, 컬럼 있음/없음 두 모드) → `GET /problems/:id`
 * → 웹 스키마 parse(`problemHistoryDetailSchema`) → 같은 문제 CHAT(k) 요청에서 어댑터가 받은 도형 요약.
 * 기대값은 AI 출력이 아니라 fixture의 손 계산값(`expected.points`, FIGURE_SPEC §11.1)과 이 파일에 적은 독립 사실이다.
 * 웹 렌더 좌표(jsdom + 실제 JSXGraph)는 `apps/web/src/features/figure-visualization/stage5Cases.render.test.ts`.
 * 사례 10은 F10a~j + F11a~ad(37건): 정확한 code·path로 거부, 텍스트 유지, 저장 0, 상세 키 없음, CHAT 그림 섹션 없음.
 * resume 경로도 대표 사례(F09)로 같은 왕복을 한다.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import express, { type Express } from "express";
import request from "supertest";
import type { ChatFigureSummary, Diagnosis, ResumeStreamEvent, Solution } from "shared-types";
import { parseSolutionFigures, problemHistoryDetailSchema, validateFigureCandidate } from "validation";
import {
  F09_STEPWISE_AUXILIARY,
  STAGE1_REJECT_FIGURE_FIXTURES,
  STAGE2_REJECT_FIGURE_FIXTURES,
  STAGE2_SEMANTIC_FIGURE_FIXTURES,
  VALID_FIGURE_FIXTURES,
  type FigureFixture,
} from "validation/fixtures";
import type {
  ChatRequest,
  FigureCallResult,
  GenerateFiguresRequest,
  RepairFigureRequest,
  ResumeRequest,
  SolveRequest,
  SolveStreamEvent,
} from "../infrastructure/ai/adapter";
import { createFakeSupabase, tablesFor, type FakeSupabase } from "../test-support/fakeSupabase";

const getUserMock = vi.fn();
const holder: { fake: FakeSupabase | null } = { fake: null };
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: getUserMock },
    from: (table: string) => {
      if (!holder.fake) throw new Error("fake supabase not set");
      return holder.fake.client.from(table);
    },
  })),
}));

const { createSolutionsRouter } = await import("../modules/solutions/solutions.router");
const { createResumeRouter } = await import("../modules/resume/resume.router");
const { createChatRouter } = await import("../modules/chat/chat.router");
const { createProblemsRouter } = await import("../modules/problems/problems.router");
const { errorHandler } = await import("../middleware/error-handler");
const { FakeLLMAdapter } = await import("../infrastructure/ai/fake-adapter");
const { inMemoryProblemStore } = await import("../infrastructure/store/inMemoryProblemStore");
const { problemRepository, createProblemRepository } = await import("../infrastructure/persistence/problemRepository");
type ProblemRepository = import("../infrastructure/persistence/problemRepository").ProblemRepository;

const AUTH = { Authorization: "Bearer t" };
// 요청 수 상한(사용자당 분당 30, rate-limiter)에 걸리지 않게 테스트마다 다른 사용자로 돈다.
let userSeq = 0;
let USER = "user-0";
const PID = "51515151-5151-4515-8515-515151515151";
const SOLUTION_MD = "## 풀이\n**1단계** 그림의 주어진 것을 그린다.\n**2단계** 보조선을 긋는다.\n**3단계** 결과를 읽는다.";

const DIAG: Diagnosis = {
  lastValidLine: 1,
  stallLine: 2,
  errorTypeLabel: "부호 오류",
  errorDetail: "x",
  relatedConcepts: [],
  reachedAnswerWithNotes: false,
  isLowConfidence: false,
  conceptExplanations: [],
  identifiedMethod: { methodId: "m", methodName: "m" },
  isMethodApplicable: true,
  methodApplicabilityNote: null,
  problemAnswerLatex: "3",
};

/** 테스트 전용 stub: 풀이·이어풀기는 고정 텍스트, 도형 생성은 fixture 하나, 보정은 항상 포기(null). */
class FixtureAdapter extends FakeLLMAdapter {
  readonly chatRequests: ChatRequest[] = [];
  generateCalls = 0;
  constructor(private readonly raw: unknown) {
    super("openai", "stub-model");
  }
  override async *solve(_req: SolveRequest): AsyncIterable<SolveStreamEvent> {
    await Promise.resolve();
    yield { delta: `${SOLUTION_MD}\n\n## 최종 답\n3` };
    const result: Solution = { conceptMd: null, solutionMd: SOLUTION_MD, answerMd: "3", conceptTags: [], aiProvider: "openai", aiModel: "stub-model" };
    yield { done: true, result };
  }
  override async *resume(req: ResumeRequest): AsyncIterable<ResumeStreamEvent> {
    await Promise.resolve();
    yield { delta: SOLUTION_MD.replace("## 풀이", "## 이어풀기") };
    yield {
      done: true,
      result: { mode: req.mode, methodName: "2번째 줄부터 이어가기", solutionMd: SOLUTION_MD.replace("## 풀이", "## 이어풀기"), answerMd: "3", verified: false },
    };
  }
  override generateFigures(_req: GenerateFiguresRequest): Promise<FigureCallResult> {
    this.generateCalls += 1;
    const figureId = (this.raw as { figureId?: unknown }).figureId;
    const refs = typeof figureId === "string" ? ["s1", "s2", "s3"].map((stepId) => ({ stepId, figureId })) : [];
    return Promise.resolve({ raw: { figures: [structuredClone(this.raw)], stepFigureRefs: refs, omitReason: null }, usage: null });
  }
  override repairFigure(_req: RepairFigureRequest): Promise<FigureCallResult> {
    return Promise.resolve({ raw: { figure: null }, usage: null });
  }
  override chat(req: ChatRequest): Promise<string> {
    this.chatRequests.push(req);
    return Promise.resolve("ok");
  }
}

function app(adapter: FixtureAdapter): Express {
  const instance = express();
  instance.use(express.json());
  const cas = { verifyWorkLines: vi.fn(() => Promise.resolve([])), verifyFinalAnswer: vi.fn(() => Promise.resolve({ verified: true })) };
  instance.use("/api", createSolutionsRouter(adapter, { figuresEnabled: true, keepAliveMs: 5 }));
  instance.use("/api", createResumeRouter(adapter, cas, { figuresEnabled: true, keepAliveMs: 5, resumePersistEnabled: true }));
  instance.use("/api", createChatRouter(adapter, { figuresEnabled: true }));
  instance.use("/api", createProblemsRouter());
  instance.use(errorHandler);
  return instance;
}

function useDb(figureColumns: boolean): FakeSupabase {
  const fake = createFakeSupabase({
    tables: tablesFor({ figureColumns, resumeTable: true }),
    rows: {
      problems: [
        { id: PID, user_id: USER, grade: "M2", input_type: "photo", recognized_text: "그림 문제", recognized_latex: null, created_at: "2026-10-25T00:00:00.000Z" },
      ],
    },
  });
  holder.fake = fake;
  const repository: ProblemRepository = createProblemRepository(fake.client, { figuresPersistEnabled: true, resumePersistEnabled: true });
  for (const key of Object.keys(repository) as (keyof ProblemRepository)[]) {
    const target = repository[key] as (...args: unknown[]) => unknown;
    vi.spyOn(problemRepository, key).mockImplementation(((...args: unknown[]) => target(...args)) as never);
  }
  return fake;
}

function seed(): void {
  inMemoryProblemStore.clear();
  inMemoryProblemStore.set({
    problemId: PID,
    userId: USER,
    grade: "M2",
    problem: { recognizedText: "그림 문제", recognizedLatex: null },
    createdAt: "2026-10-25T00:00:00.000Z",
    workLines: [
      { lineNo: 1, latex: "a = 1", isLowConfidence: false },
      { lineNo: 2, latex: "b = 2", isLowConfidence: false },
    ],
    diagnosis: DIAG,
  });
}

function figuresEvent(text: string): { figures: unknown[]; stepFigureRefs: unknown[] } | null {
  const match = /event: figures\ndata: (.+)\n\n/.exec(text);
  return match?.[1] ? (JSON.parse(match[1]) as { figures: unknown[]; stepFigureRefs: unknown[] }) : null;
}

function summaryPoint(summary: ChatFigureSummary | undefined, id: string): { x: number; y: number } | undefined {
  return summary?.elements?.find((element) => element.id === id)?.point;
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  userSeq += 1;
  USER = `user-${userSeq}`;
  getUserMock.mockReset();
  getUserMock.mockResolvedValue({ data: { user: { id: USER, user_metadata: { grade: "M2" } } }, error: null });
  seed();
});

/** 사례별 독립 사실(손 계산 — 커널을 부르지 않는다). 요약은 소수 셋째 자리. */
const CASE_FACTS: Record<string, (summary: ChatFigureSummary) => void> = {
  // 1 F01 ∠BAC = 45°: AB=(4,0), AC=(2,2) → cos = 8/(4·2√2) = 1/√2.
  F01: (s) => expect(s.constraints).toContainEqual({ type: "angleMeasure", source: "given", targets: ["angA"], value: 45 }),
  // 2 F02 H=(2,0), CH ⊥ AB(90°).
  F02: (s) => {
    const h = summaryPoint(s, "H");
    const c = summaryPoint(s, "C");
    expect(h).toEqual({ x: 2, y: 0 });
    expect((c?.x ?? NaN) - 2).toBeCloseTo(0, 3);
  },
  // 3 F03 M=(1,0).
  F03: (s) => expect(summaryPoint(s, "M")).toEqual({ x: 1, y: 0 }),
  // 4 F04 M=(1.5,1.5), OM ⊥ AB(OM·AB = 0).
  F04: (s) => {
    const m = summaryPoint(s, "M");
    const a = summaryPoint(s, "A");
    const b = summaryPoint(s, "B");
    const o = summaryPoint(s, "O");
    expect(m).toEqual({ x: 1.5, y: 1.5 });
    if (!m || !a || !b || !o) throw new Error("points");
    expect((m.x - o.x) * (b.x - a.x) + (m.y - o.y) * (b.y - a.y)).toBeCloseTo(0, 2);
  },
  // 5 F05 T=(1,±√3) — 외적 부호: OP×OT의 부호가 T1(ccw)·T2(cw)에서 반대.
  F05: (s) => {
    const t1 = summaryPoint(s, "T1");
    const t2 = summaryPoint(s, "T2");
    expect(t1?.x).toBeCloseTo(1, 3);
    expect(t1?.y).toBeCloseTo(Math.sqrt(3), 3);
    expect(t2?.y).toBeCloseTo(-Math.sqrt(3), 3);
    const p = summaryPoint(s, "P");
    const o = summaryPoint(s, "O");
    if (!p || !o || !t1 || !t2) throw new Error("points");
    const cross = (t: { x: number; y: number }) => (p.x - o.x) * (t.y - o.y) - (p.y - o.y) * (t.x - o.x);
    expect(Math.sign(cross(t1))).toBe(-Math.sign(cross(t2)));
  },
  // 6 F06 P=(2,2).
  F06: (s) => expect(summaryPoint(s, "P")).toEqual({ x: 2, y: 2 }),
  // 7 F07 V=(2,−1), 근 1·3.
  F07: (s) => {
    expect(summaryPoint(s, "V")).toEqual({ x: 2, y: -1 });
    expect(summaryPoint(s, "R1")).toEqual({ x: 1, y: 0 });
    expect(summaryPoint(s, "R2")).toEqual({ x: 3, y: 0 });
  },
  // 8 F08 점근선 x=1·y=2(직선 방정식 요소 2개), 그래프 1개(조각 2는 웹 렌더 테스트).
  F08: (s) => {
    expect(s.elements?.filter((e) => e.type === "lineEquation").map((e) => e.id)).toEqual(["asymV", "asymH"]);
    expect(s.elements?.filter((e) => e.type === "functionGraph")).toHaveLength(1);
  },
  // 9 F09 H=(0,0), M=(1,0), k=2에서 H 강조·M 숨김, k=3에서 직각 표시 숨김·M 강조.
  F09: (s) => {
    expect(summaryPoint(s, "H")).toEqual({ x: 0, y: 0 });
    expect(summaryPoint(s, "M")).toEqual({ x: 1, y: 0 });
    const at = (id: string) => s.elements?.find((e) => e.id === id);
    if (s.step === 2) {
      expect(at("H")).toMatchObject({ visible: true, emphasis: "highlight" });
      expect(at("M")).toMatchObject({ visible: false, emphasis: null });
    }
    if (s.step === 3) {
      expect(at("angAHC")).toMatchObject({ visible: false });
      expect(at("M")).toMatchObject({ visible: true, emphasis: "highlight" });
    }
  },
};

describe.each([true, false])("사례 1~9 solve 왕복(도형 컬럼 %s)", (figureColumns) => {
  it.each(VALID_FIGURE_FIXTURES.map((f) => [f.id, f] as const))("%s", async (id, fixture: FigureFixture) => {
    const fake = useDb(figureColumns);
    const adapter = new FixtureAdapter(fixture.raw);
    const target = app(adapter);

    const solve = await request(target).post(`/api/problems/${PID}/solve`).set(AUTH).send({ options: { concept: false, solution: true } });
    expect(solve.text).not.toContain("event: error");
    const sse = figuresEvent(solve.text);
    const expected = parseSolutionFigures(JSON.parse(JSON.stringify({ figures: [fixture.raw], stepFigureRefs: ["s1", "s2", "s3"].map((stepId) => ({ stepId, figureId: (fixture.raw as { figureId: string }).figureId })) })) as unknown);
    expect(sse?.figures).toEqual(expected.figures);
    expect(inMemoryProblemStore.getSolutionFigures(PID)).toEqual(sse);

    const row = fake.rows("solutions")[0];
    if (figureColumns) {
      expect(row?.["figures"]).toEqual(sse?.figures);
      expect(row?.["figures_schema_version"]).toBe(1);
    } else {
      expect(Object.keys(row ?? {})).not.toContain("figures");
    }

    const generateBefore = adapter.generateCalls;
    const detail = await request(target).get(`/api/problems/${PID}`).set(AUTH);
    expect(detail.status).toBe(200);
    expect(adapter.generateCalls).toBe(generateBefore);
    const web = problemHistoryDetailSchema.parse(detail.body);
    if (figureColumns) {
      expect(web.solution?.figures).toEqual(sse?.figures);
      expect(parseSolutionFigures({ figures: web.solution?.figures, stepFigureRefs: web.solution?.stepFigureRefs }).figures).toEqual(expected.figures);
    } else {
      expect(web.solution).not.toHaveProperty("figures");
    }

    for (const step of [null, 1, 2, 3]) {
      const chat = await request(target).post(`/api/problems/${PID}/chat`).set(AUTH).send({ question: "그림 질문", figureContext: { step } });
      expect(chat.status).toBe(200);
      const context = adapter.chatRequests.at(-1)?.figureContext;
      expect(context?.currentStep).toBe(step);
      const summary = context?.figures[0];
      expect(summary?.figureId).toBe((fixture.raw as { figureId: string }).figureId);
      for (const point of fixture.expected?.points ?? []) {
        const got = summaryPoint(summary, point.id);
        expect(got?.x).toBeCloseTo(point.x, 3);
        expect(got?.y).toBeCloseTo(point.y, 3);
      }
      if (summary) CASE_FACTS[id]?.(summary);
    }
    // CHAT 뒤 도형 불변(S5-8).
    expect(inMemoryProblemStore.getSolutionFigures(PID)).toEqual(sse);
    if (figureColumns) expect(fake.rows("solutions")[0]?.["figures"]).toEqual(sse?.figures);
  });
});

const REJECT_FIXTURES = [...STAGE2_REJECT_FIGURE_FIXTURES, ...STAGE1_REJECT_FIGURE_FIXTURES, ...STAGE2_SEMANTIC_FIGURE_FIXTURES];

describe("사례 10 잘못된 참조·모순·구조 오류 — 안전한 실패", () => {
  it("대표 10건 이상", () => {
    expect(REJECT_FIXTURES.length).toBeGreaterThanOrEqual(10);
  });

  it.each(REJECT_FIXTURES.map((f) => [f.id, f] as const))("%s: 정확한 code·path 거부, 텍스트 유지, 저장 0, 상세 키 없음, CHAT 그림 섹션 없음", async (_id, fixture) => {
    const candidate = validateFigureCandidate(fixture.raw, { stepCount: 3 });
    expect(candidate.ok).toBe(false);
    const issue = fixture.expected?.stage2Issue ?? fixture.stage1Issue;
    if (!candidate.ok && issue) {
      expect(candidate.errors).toContainEqual(expect.objectContaining({ code: issue.code, path: issue.path }));
    }

    const fake = useDb(true);
    const adapter = new FixtureAdapter(fixture.raw);
    const target = app(adapter);
    const solve = await request(target).post(`/api/problems/${PID}/solve`).set(AUTH).send({ options: { concept: false, solution: true } });
    expect(solve.text).toContain("event: done");
    expect(solve.text).not.toContain("event: figures");
    expect(solve.text).not.toContain("event: error");
    expect(fake.rows("solutions")[0]).toMatchObject({ answer_md: "3", figures: null });
    expect(fake.calls.some((c) => c.ops[0]?.method === "update")).toBe(false);
    const detail = await request(target).get(`/api/problems/${PID}`).set(AUTH);
    expect(problemHistoryDetailSchema.parse(detail.body).solution).not.toHaveProperty("figures");
    await request(target).post(`/api/problems/${PID}/chat`).set(AUTH).send({ question: "q", figureContext: { step: 1 } });
    expect(adapter.chatRequests.at(-1)).not.toHaveProperty("figureContext");
  });
});

describe("resume 대표 사례(F09) 왕복", () => {
  it("SSE → 메모리 → resume_solutions → 상세 resumeSolution(+workContext) → CHAT 요약", async () => {
    const fake = useDb(true);
    const adapter = new FixtureAdapter(F09_STEPWISE_AUXILIARY.raw);
    const target = app(adapter);
    const res = await request(target).post(`/api/problems/${PID}/resume`).set(AUTH).send({ mode: "own" });
    const sse = figuresEvent(res.text);
    expect(sse?.figures).toHaveLength(1);
    expect(inMemoryProblemStore.getResumeFigures(PID)).toEqual(sse);
    expect(fake.rows("resume_solutions")[0]?.["figures"]).toEqual(sse?.figures);
    const detail = problemHistoryDetailSchema.parse((await request(target).get(`/api/problems/${PID}`).set(AUTH)).body);
    expect(detail.solution).toBeNull();
    expect(detail.resumeSolution?.figures).toEqual(sse?.figures);
    expect(detail.resumeSolution?.workContext).toEqual({
      lines: [
        { lineNo: 1, latex: "a = 1" },
        { lineNo: 2, latex: "b = 2" },
      ],
      lastValidLine: 1,
      stallLine: 2,
    });
    await request(target).post(`/api/problems/${PID}/chat`).set(AUTH).send({ question: "q", figureContext: { step: 2 } });
    const summary = adapter.chatRequests.at(-1)?.figureContext?.figures[0];
    expect(summary?.figureId).toBe("fig-f09");
    if (summary) CASE_FACTS["F09"]?.(summary);
  });
});
