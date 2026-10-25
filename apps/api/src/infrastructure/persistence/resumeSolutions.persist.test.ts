/**
 * Stage 5 WU2b — 이어풀기 결과 저장(`RESUME_PERSIST_ENABLED` + 테이블 탐지). 계획 §3.2·§3.3·§3.5·§3.6.
 * 메모리 가짜 Supabase(테스트 전용, 실제 연결 없음). RS1(off 호출 0), RS2(테이블 없음 PGRST205·42P01),
 * RS3(verified만 upsert, 실패는 쓰기 0), RS4(행 1개 교체·늦은 쓰기), RS5(재조회 도형·변조), RS6(행 없음이면 키 없음).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FigureSpec, ResumeSolution, StepFigureRef } from "shared-types";
import { parseSolutionFigures } from "validation";
import { F01_TRIANGLE_ANGLE, F09_STEPWISE_AUXILIARY } from "validation/fixtures";
import { createFakeSupabase, tablesFor, type FakeSupabase } from "../../test-support/fakeSupabase";
import { createProblemRepository, PERSIST_REDETECT_AFTER_MS, type ProblemRepositoryOptions } from "./problemRepository";

const PID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1";
const USER = "user-1";

function resume(overrides: Partial<ResumeSolution> = {}): ResumeSolution {
  return {
    mode: "own",
    methodName: "3번째 줄부터 이어가기",
    solutionMd: "## 이어풀기\n**1단계** 정리",
    answerMd: "-1",
    verified: true,
    ...overrides,
  };
}

function accepted(raws: unknown[], refs: unknown[] = []): { figures: FigureSpec[]; stepFigureRefs: StepFigureRef[] } {
  const parsed = parseSolutionFigures({ figures: raws, stepFigureRefs: refs });
  return { figures: parsed.figures, stepFigureRefs: parsed.stepFigureRefs };
}

const F09 = accepted([F09_STEPWISE_AUXILIARY.raw], [{ stepId: "s1", figureId: "fig-f09" }]);

function fakeDb(resumeTable: boolean, missingTableCode: "PGRST205" | "42P01" = "PGRST205"): FakeSupabase {
  return createFakeSupabase({
    tables: tablesFor({ figureColumns: true, resumeTable }),
    missingTableCode,
    rows: {
      problems: [
        {
          id: PID,
          user_id: USER,
          grade: "M2",
          input_type: "handwriting",
          recognized_text: "2x - 1 = 5",
          recognized_latex: null,
          created_at: "2026-10-25T00:00:00.000Z",
        },
      ],
    },
  });
}

function repo(fake: FakeSupabase, options: ProblemRepositoryOptions = {}) {
  let runSeq = 0;
  return createProblemRepository(fake.client, {
    resumePersistEnabled: true,
    figuresPersistEnabled: true,
    newRunId: () => `run-${(runSeq += 1)}`,
    now: () => Date.UTC(2026, 9, 25, 3, 0, 0),
    ...options,
  });
}

const SAVE = { problemId: PID, aiProvider: "openai" as const, aiModel: "gpt-test" };

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("RS1 RESUME_PERSIST off — 저장소 호출 0", () => {
  it("기본 옵션이면 테이블이 있어도 쓰기·읽기·탐지 쿼리 0, 상세에 resumeSolution 키 없음", async () => {
    const fake = fakeDb(true);
    const repository = createProblemRepository(fake.client);
    const r = resume();
    await repository.saveResumeSolution({ ...SAVE, resumeSolution: r });
    await repository.saveResumeFigures({ problemId: PID, resumeSolution: r, ...F09 });
    expect(fake.calls).toHaveLength(0);
    const detail = await repository.getProblemDetail(USER, PID);
    expect(fake.calls.some((c) => c.table === "resume_solutions")).toBe(false);
    expect(detail && "resumeSolution" in detail).toBe(false);
    expect(await repository.resumeTableAvailable()).toBe(false);
  });
});

describe("RS2 on + 테이블 없음", () => {
  it.each(["PGRST205", "42P01"] as const)("%s: 쓰기 0·오류 throw 0, 상세 정상·키 없음, 탐지 1회, solutions 영향 0", async (code) => {
    const fake = fakeDb(false, code);
    const repository = repo(fake, { figuresPersistEnabled: false });
    await expect(repository.saveResumeSolution({ ...SAVE, resumeSolution: resume() })).resolves.toBeUndefined();
    await repository.saveResumeSolution({ ...SAVE, resumeSolution: resume({ mode: "alternative" }) });
    const detail = await repository.getProblemDetail(USER, PID);
    const resumeCalls = fake.calls.filter((c) => c.table === "resume_solutions");
    expect(resumeCalls).toHaveLength(1);
    expect(resumeCalls[0]?.ops.map((o) => o.method)).toEqual(["select", "limit"]);
    expect(detail?.recognizedText).toBe("2x - 1 = 5");
    expect(detail && "resumeSolution" in detail).toBe(false);
    expect(fake.calls.filter((c) => c.table === "solutions").map((c) => c.ops[0]?.args[0])).toEqual([
      "concept_md, solution_md, answer_md, concept_tags, ai_provider, ai_model",
    ]);
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it("5분 뒤 재탐지 — 그 사이 마이그레이션이 적용되면 다음 저장부터 반영", async () => {
    const fake = fakeDb(false);
    let clock = 0;
    const repository = repo(fake, { now: () => clock });
    await repository.saveResumeSolution({ ...SAVE, resumeSolution: resume() });
    fake.setTables(tablesFor({ figureColumns: true, resumeTable: true }));
    clock = PERSIST_REDETECT_AFTER_MS - 1;
    await repository.saveResumeSolution({ ...SAVE, resumeSolution: resume() });
    expect(fake.rows("resume_solutions")).toHaveLength(0);
    clock = PERSIST_REDETECT_AFTER_MS;
    await repository.saveResumeSolution({ ...SAVE, resumeSolution: resume() });
    expect(fake.rows("resume_solutions")).toHaveLength(1);
    expect(fake.calls.filter((c) => c.ops.some((o) => o.method === "limit"))).toHaveLength(2);
  });

  it("탐지 뒤 테이블이 사라지면(쓰기 PGRST205) 사용 불가로 되돌리고 throw하지 않는다", async () => {
    const fake = fakeDb(true);
    const repository = repo(fake);
    expect(await repository.resumeTableAvailable()).toBe(true);
    fake.setTables(tablesFor({ figureColumns: true, resumeTable: false }));
    await expect(repository.saveResumeSolution({ ...SAVE, resumeSolution: resume() })).resolves.toBeUndefined();
    expect(await repository.resumeTableAvailable()).toBe(false);
  });
});

describe("RS3 on + 테이블 있음 — verified만 upsert", () => {
  it("verified=true: upsert 1회, payload = 결과 + ai·updated_at + 도형 null·run id, onConflict problem_id", async () => {
    const fake = fakeDb(true);
    const repository = repo(fake);
    const r = resume();
    await repository.saveResumeSolution({ ...SAVE, resumeSolution: r });
    const writes = fake.calls.filter((c) => c.ops[0]?.method === "upsert");
    expect(writes).toHaveLength(1);
    expect(writes[0]?.ops[0]?.args).toEqual([
      {
        problem_id: PID,
        mode: "own",
        method_name: r.methodName,
        solution_md: r.solutionMd,
        answer_md: r.answerMd,
        verified: true,
        ai_provider: "openai",
        ai_model: "gpt-test",
        updated_at: "2026-10-25T03:00:00.000Z",
        // §12.1(3차 보완): workContext가 없으면 세 컬럼 모두 null(모드 변경·재실행 시 이전 줄이 남지 않게 항상 쓴다).
        work_lines: null,
        last_valid_line: null,
        stall_line: null,
        figures: null,
        step_figure_refs: null,
        figures_schema_version: null,
        figures_run_id: "run-1",
      },
      { onConflict: "problem_id" },
    ]);
    const detail = await repository.getProblemDetail(USER, PID);
    expect(detail?.resumeSolution).toEqual({
      mode: "own",
      methodName: r.methodName,
      solutionMd: r.solutionMd,
      answerMd: r.answerMd,
      verified: true,
    });
  });

  it("FIGURES_PERSIST off면 도형 키 없이 저장하고 상세 select에도 도형 컬럼이 없다", async () => {
    const fake = fakeDb(true);
    const repository = repo(fake, { figuresPersistEnabled: false });
    const r = resume();
    await repository.saveResumeSolution({ ...SAVE, resumeSolution: r });
    await repository.saveResumeFigures({ problemId: PID, resumeSolution: r, ...F09 });
    const upsert = fake.calls.find((c) => c.ops[0]?.method === "upsert");
    expect(Object.keys(upsert?.ops[0]?.args[0] as object)).not.toContain("figures");
    expect(fake.calls.some((c) => c.ops[0]?.method === "update")).toBe(false);
    await repository.getProblemDetail(USER, PID);
    const select = fake.calls.find((c) => c.table === "resume_solutions" && c.ops.some((o) => o.method === "maybeSingle"));
    expect(select?.ops[0]?.args[0]).toBe("mode, method_name, solution_md, answer_md, verified, work_lines, last_valid_line, stall_line");
  });

  it("verified=false: 쓰기 0, 이전 통과 행 유지", async () => {
    const fake = fakeDb(true);
    const repository = repo(fake);
    await repository.saveResumeSolution({ ...SAVE, resumeSolution: resume({ answerMd: "-1" }) });
    fake.clearCalls();
    await repository.saveResumeSolution({ ...SAVE, resumeSolution: resume({ answerMd: "99", verified: false }) });
    expect(fake.calls).toHaveLength(0);
    expect(fake.rows("resume_solutions")).toHaveLength(1);
    expect(fake.rows("resume_solutions")[0]?.["answer_md"]).toBe("-1");
  });

  it("upsert 실패·throw에도 reject하지 않는다", async () => {
    const fake = fakeDb(true);
    const repository = repo(fake);
    await repository.resumeTableAvailable();
    fake.intercept(() => ({ data: null, error: { code: "23503", message: "fk" } }));
    await expect(repository.saveResumeSolution({ ...SAVE, resumeSolution: resume() })).resolves.toBeUndefined();
    fake.intercept(() => {
      throw new Error("boom");
    });
    await expect(repository.saveResumeSolution({ ...SAVE, resumeSolution: resume() })).resolves.toBeUndefined();
  });
});

describe("RS4 own → alternative·재실행 — 행 1개 교체, 도형 null·새 run id, 늦은 쓰기 미반영", () => {
  it("이전 실행의 늦은 도형 쓰기는 0행, 현재 실행 도형만 반영", async () => {
    const fake = fakeDb(true);
    const repository = repo(fake);
    const own = resume({ mode: "own" });
    await repository.saveResumeSolution({ ...SAVE, resumeSolution: own });
    await repository.saveResumeFigures({ problemId: PID, resumeSolution: own, ...accepted([F01_TRIANGLE_ANGLE.raw]) });
    expect(fake.rows("resume_solutions")[0]?.["figures"]).not.toBeNull();

    const alternative = resume({ mode: "alternative", methodName: "새로운 방법으로 처음부터 풀기", answerMd: "-1" });
    await repository.saveResumeSolution({ ...SAVE, resumeSolution: alternative });
    expect(fake.rows("resume_solutions")).toHaveLength(1);
    expect(fake.rows("resume_solutions")[0]).toMatchObject({ mode: "alternative", figures: null, figures_run_id: "run-2" });

    await repository.saveResumeFigures({ problemId: PID, resumeSolution: own, ...F09 });
    expect(fake.rows("resume_solutions")[0]?.["figures"]).toBeNull();

    await repository.saveResumeFigures({ problemId: PID, resumeSolution: alternative, ...F09 });
    const detail = await repository.getProblemDetail(USER, PID);
    expect(detail?.resumeSolution?.mode).toBe("alternative");
    expect(detail?.resumeSolution?.figures).toEqual(F09.figures);
    expect(detail?.resumeSolution?.stepFigureRefs).toEqual(F09.stepFigureRefs);
  });
});

describe("RS5·RS6 재조회 — 변조 시 도형만 빠짐, 행이 깨지거나 조회 실패면 키만 빠짐", () => {
  const base = {
    id: "r-1",
    problem_id: PID,
    mode: "own",
    method_name: "3번째 줄부터 이어가기",
    solution_md: "## 이어풀기\nx",
    answer_md: "-1",
    verified: true,
    ai_provider: "openai",
    ai_model: "m",
    figures_run_id: "run-x",
    created_at: "2026-10-25T00:00:00.000Z",
    updated_at: "2026-10-25T00:00:00.000Z",
  };

  it.each([
    ["비배열", { figures: { a: 1 }, figures_schema_version: 1 }],
    ["schemaVersion 2", { figures: [F09_STEPWISE_AUXILIARY.raw], figures_schema_version: 2 }],
    ["악성 라벨", { figures: [{ ...(F09_STEPWISE_AUXILIARY.raw as object), elements: [{ id: "A", type: "point", label: "<script>", role: "given", appearAt: null, x: 0, y: 0 }], constraints: [], steps: [] }], figures_schema_version: 1 }],
  ])("%s → resumeSolution 텍스트는 그대로, figures 키 없음", async (_name, tampered) => {
    const fake = fakeDb(true);
    fake.seed("resume_solutions", [{ ...base, step_figure_refs: null, ...tampered }]);
    const detail = await repo(fake).getProblemDetail(USER, PID);
    expect(detail?.resumeSolution?.solutionMd).toBe("## 이어풀기\nx");
    expect(Object.keys(detail?.resumeSolution ?? {})).not.toContain("figures");
  });

  it.each([
    ["mode 변조", { mode: "hack" }],
    ["verified 문자열", { verified: "true" }],
    ["solution_md null", { solution_md: null }],
  ])("%s → resumeSolution 키 생략(상세는 성공)", async (_name, tampered) => {
    const fake = fakeDb(true);
    fake.seed("resume_solutions", [{ ...base, ...tampered }]);
    const detail = await repo(fake).getProblemDetail(USER, PID);
    expect(detail?.problemId).toBe(PID);
    expect(detail && "resumeSolution" in detail).toBe(false);
  });

  it("resume 조회가 오류를 돌려주거나 throw해도 상세는 성공하고 키만 빠진다", async () => {
    const fake = fakeDb(true);
    fake.seed("resume_solutions", [base]);
    const repository = repo(fake);
    fake.intercept((call) =>
      call.table === "resume_solutions" && call.ops.some((o) => o.method === "maybeSingle")
        ? { data: null, error: { code: "57014", message: "statement timeout" } }
        : undefined,
    );
    const failed = await repository.getProblemDetail(USER, PID);
    expect(failed && "resumeSolution" in failed).toBe(false);
    fake.intercept((call) => {
      if (call.table === "resume_solutions" && call.ops.some((o) => o.method === "maybeSingle")) throw new Error("boom");
      return undefined;
    });
    const thrown = await repository.getProblemDetail(USER, PID);
    expect(thrown?.problemId).toBe(PID);
    expect(thrown && "resumeSolution" in thrown).toBe(false);
  });

  it("행이 없으면 키 없음", async () => {
    const detail = await repo(fakeDb(true)).getProblemDetail(USER, PID);
    expect(detail && "resumeSolution" in detail).toBe(false);
  });
});

describe("RS11 workContext(§12.1·§12.3) 저장·재조회", () => {
  const work = {
    lines: [
      { lineNo: 1, latex: "y = x^{2} - 4x + 3" },
      { lineNo: 2, latex: "y = (x - 2)^{2} - 1" },
      { lineNo: 3, latex: "SECRET-줄-내용" },
    ],
    lastValidLine: 2,
    stallLine: 3,
  };

  it("저장 세 컬럼 = workContext, 재조회 workContext deep-equal", async () => {
    const fake = fakeDb(true);
    const repository = repo(fake);
    await repository.saveResumeSolution({ ...SAVE, resumeSolution: resume(), workContext: work });
    expect(fake.rows("resume_solutions")[0]).toMatchObject({ work_lines: work.lines, last_valid_line: 2, stall_line: 3 });
    expect((await repository.getProblemDetail(USER, PID))?.resumeSolution?.workContext).toEqual(work);
  });

  it("stallLine null도 저장·복원", async () => {
    const fake = fakeDb(true);
    const repository = repo(fake);
    const noStall = { ...work, stallLine: null, lastValidLine: 3 };
    await repository.saveResumeSolution({ ...SAVE, resumeSolution: resume(), workContext: noStall });
    expect((await repository.getProblemDetail(USER, PID))?.resumeSolution?.workContext).toEqual(noStall);
  });

  const tooMany = { ...work, lines: Array.from({ length: 51 }, (_, i) => ({ lineNo: i + 1, latex: "x" })) };
  const tooLong = { ...work, lines: [{ lineNo: 1, latex: "가".repeat(501) }] };
  const tooBig = { ...work, lines: Array.from({ length: 50 }, (_, i) => ({ lineNo: i + 1, latex: "가".repeat(250) })) }; // 50×250×3B > 32KB
  const duplicate = { ...work, lines: [{ lineNo: 1, latex: "a" }, { lineNo: 1, latex: "b" }] };
  const descending = { ...work, lines: [{ lineNo: 2, latex: "a" }, { lineNo: 1, latex: "b" }] };
  const badLineNo = { ...work, lines: [{ lineNo: 0, latex: "a" }] };
  it.each([
    ["51줄", tooMany],
    ["501자", tooLong],
    ["32KB 초과", tooBig],
    ["lineNo 중복", duplicate],
    ["lineNo 역순", descending],
    ["lineNo 0", badLineNo],
  ])("%s → 세 값 모두 null(부분 저장 0), 텍스트는 저장, 로그에 줄 내용 0", async (_name, bad) => {
    const fake = fakeDb(true);
    const repository = repo(fake);
    await repository.saveResumeSolution({ ...SAVE, resumeSolution: resume(), workContext: { ...bad, lines: bad.lines.map((l) => ({ ...l, latex: `SECRET-${l.latex}` })) } });
    expect(fake.rows("resume_solutions")[0]).toMatchObject({ work_lines: null, last_valid_line: null, stall_line: null, answer_md: "-1" });
    const logged = JSON.stringify(vi.mocked(console.error).mock.calls);
    expect(logged).not.toContain("SECRET");
    expect(logged).not.toContain("가가");
  });

  it("DB 쓰기 오류 로그에도 줄 내용이 없다(코드만)", async () => {
    const fake = fakeDb(true);
    const repository = repo(fake);
    await repository.resumeTableAvailable();
    fake.intercept(() => ({ data: null, error: { code: "23514", message: 'Failing row contains (SECRET-줄-내용)' } }));
    await repository.saveResumeSolution({ ...SAVE, resumeSolution: resume(), workContext: work });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("SECRET");
  });

  const base = {
    id: "r-1",
    problem_id: PID,
    mode: "own",
    method_name: "m",
    solution_md: "s",
    answer_md: "-1",
    verified: true,
    ai_provider: "openai",
    ai_model: "m",
  };
  it.each([
    ["비배열(객체)", { work_lines: { a: 1 }, last_valid_line: 1, stall_line: 2 }],
    ["문자열", { work_lines: "[]", last_valid_line: 1, stall_line: null }],
    ["문자열 lineNo", { work_lines: [{ lineNo: "1", latex: "a" }], last_valid_line: 1, stall_line: null }],
    ["거대 latex", { work_lines: [{ lineNo: 1, latex: "x".repeat(100_000) }], last_valid_line: 1, stall_line: null }],
    ["last_valid_line 없음", { work_lines: [{ lineNo: 1, latex: "a" }], last_valid_line: null, stall_line: null }],
    ["모르는 키만", { work_lines: [{ foo: 1 }], last_valid_line: 1, stall_line: null }],
  ])("변조 %s → 상세 성공, resumeSolution 유지, workContext 키만 없음", async (_name, tampered) => {
    const fake = fakeDb(true);
    fake.seed("resume_solutions", [{ ...base, ...tampered }]);
    const detail = await repo(fake).getProblemDetail(USER, PID);
    expect(detail?.resumeSolution?.solutionMd).toBe("s");
    expect(Object.keys(detail?.resumeSolution ?? {})).not.toContain("workContext");
  });

  it("\\href·\\htmlId 같은 명령은 문자열 그대로 통과(렌더는 웹 KaTeX trust=false가 막는다)", async () => {
    const fake = fakeDb(true);
    fake.seed("resume_solutions", [{ ...base, work_lines: [{ lineNo: 1, latex: "\\href{javascript:alert(1)}{x}" }, { lineNo: 2, latex: "\\htmlId{a}{b}" }], last_valid_line: 1, stall_line: 2 }]);
    const detail = await repo(fake).getProblemDetail(USER, PID);
    expect(detail?.resumeSolution?.workContext?.lines.map((l) => l.latex)).toEqual(["\\href{javascript:alert(1)}{x}", "\\htmlId{a}{b}"]);
  });

  it("과거 행(work 컬럼 null)은 키 없음, 모드 변경 시 이전 줄이 남지 않는다", async () => {
    const fake = fakeDb(true);
    const repository = repo(fake);
    await repository.saveResumeSolution({ ...SAVE, resumeSolution: resume(), workContext: work });
    await repository.saveResumeSolution({ ...SAVE, resumeSolution: resume({ mode: "alternative" }) });
    expect(fake.rows("resume_solutions")[0]).toMatchObject({ mode: "alternative", work_lines: null, last_valid_line: null });
    const detail = await repository.getProblemDetail(USER, PID);
    expect(Object.keys(detail?.resumeSolution ?? {})).not.toContain("workContext");
  });

  it("마이그레이션 check 제약(가짜 DB도 같은 규칙): 셋 중 일부만 값이면 거부", async () => {
    const fake = fakeDb(true);
    const result = (await fake.client
      .from("resume_solutions")
      .upsert({ ...base, work_lines: null, last_valid_line: 1, stall_line: null })) as { error: { message: string } | null };
    expect(result.error?.message).toContain("resume_solutions_work_context_all_or_none");
  });
});

describe("재작업 1 — 도형 update(PATCH) 오류 로그(QA LOW-1)", () => {
  it.each(["resume_solutions", "solutions"] as const)("%s: 'Failing row contains' 오류를 주입해도 로그에 행 내용이 0, 코드만 남는다", async (table) => {
    const fake = fakeDb(true);
    const repository = repo(fake);
    const r = resume();
    if (table === "resume_solutions") {
      await repository.saveResumeSolution({ ...SAVE, resumeSolution: r, workContext: { lines: [{ lineNo: 1, latex: "SECRET-줄" }], lastValidLine: 1, stallLine: null } });
    }
    const solution = { conceptMd: null, solutionMd: "s", answerMd: "a", conceptTags: [], aiProvider: "openai" as const, aiModel: "m" };
    if (table === "solutions") await repository.saveSolution({ problemId: PID, solution });
    vi.mocked(console.error).mockClear();
    fake.intercept((call) =>
      call.ops[0]?.method === "update"
        ? { data: null, error: { code: "23514", message: "new row violates check constraint · Failing row contains (SECRET-줄, 학생 풀이)" } }
        : undefined,
    );
    if (table === "resume_solutions") await repository.saveResumeFigures({ problemId: PID, resumeSolution: r, ...F09 });
    else await repository.saveSolutionFigures({ problemId: PID, solution, ...F09 });
    const logged = JSON.stringify(vi.mocked(console.error).mock.calls);
    expect(vi.mocked(console.error)).toHaveBeenCalled();
    expect(logged).toContain("23514");
    expect(logged).not.toContain("SECRET");
    expect(logged).not.toContain("Failing row");

    vi.mocked(console.error).mockClear();
    fake.intercept((call) => {
      if (call.ops[0]?.method === "update") throw new Error("Failing row contains (SECRET-줄)");
      return undefined;
    });
    if (table === "resume_solutions") await repository.saveResumeFigures({ problemId: PID, resumeSolution: r, ...F09 });
    else await repository.saveSolutionFigures({ problemId: PID, solution, ...F09 });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("SECRET");
  });

  it("탐지 뒤 테이블이 사라진 쓰기 오류로 '사용 불가'가 될 때도 로그는 코드만", async () => {
    const fake = fakeDb(true);
    const repository = repo(fake);
    await repository.resumeTableAvailable();
    vi.mocked(console.error).mockClear();
    fake.intercept(() => ({ data: null, error: { code: "PGRST205", message: "SECRET-줄 포함 메시지" } }));
    await repository.saveResumeSolution({ ...SAVE, resumeSolution: resume() });
    const logged = JSON.stringify(vi.mocked(console.error).mock.calls);
    expect(logged).toContain("PGRST205");
    expect(logged).not.toContain("SECRET");
  });
});

describe("재작업 1 — 서버 상한이 실질 기준(QA LOW-7)", () => {
  it("서버 상한 바로 아래(50줄, UTF-8 약 31KB)는 서버 검사와 DB 제약 모두 통과해 저장된다", async () => {
    const fake = fakeDb(true);
    const repository = repo(fake);
    const lines = Array.from({ length: 50 }, (_, i) => ({ lineNo: i + 1, latex: "가".repeat(200) }));
    expect(Buffer.byteLength(JSON.stringify(lines))).toBeLessThan(32_768);
    await repository.saveResumeSolution({ ...SAVE, resumeSolution: resume(), workContext: { lines, lastValidLine: 49, stallLine: 50 } });
    expect((fake.rows("resume_solutions")[0]?.["work_lines"] as unknown[]).length).toBe(50);
  });
});
