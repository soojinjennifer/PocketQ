/**
 * Stage 5 WU0 — 저장·재조회 경로의 변경 전 바이트 기준값(S5-1·RS1·RS10).
 *
 * 기준값 `__baseline__/persistenceOff.baseline.json`은 Stage 5 코드를 바꾸기 **전**(HEAD 091ae2a 작업 트리)에 이 파일의
 * 같은 절차로 캡처했다(`STAGE5_BASELINE_CAPTURE=1`, 파일이 이미 있으면 캡처를 거부한다).
 * 실제 Express 라우터 + 기본 `problemRepository` + **메모리 가짜 Supabase**(테스트 전용, 실제 연결 없음):
 * - solve 완료 → Supabase 호출 목록(solutions upsert payload·옵션)
 * - resume 완료 → Supabase 호출 목록(변경 전: 0건)
 * - `GET /api/problems/:id` → select 문자열·필터 순서와 응답 본문(풀이 있음/없음/없는 문제)
 * - `GET /api/problems` → 호출 목록과 응답 본문
 * - `createProblemRepository(client).saveSolution` 단독 payload
 *
 * 플래그(`FIGURES_ENABLED`·`FIGURES_PERSIST_ENABLED`·`RESUME_PERSIST_ENABLED`)가 모두 off인 기본 상태에서 실행한다.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { Diagnosis } from "shared-types";
import { BASE_TABLES, createFakeSupabase, type FakeCall, type FakeSupabase } from "../test-support/fakeSupabase";

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

const { createApp } = await import("../app");
const { FakeLLMAdapter } = await import("../infrastructure/ai/fake-adapter");
const { inMemoryProblemStore } = await import("../infrastructure/store/inMemoryProblemStore");
const { createProblemRepository } = await import("../infrastructure/persistence/problemRepository");

interface PersistenceBaseline {
  solveCalls: FakeCall[];
  resumeCalls: FakeCall[];
  resumeSse: string;
  detail: Record<string, { status: number; text: string; calls: FakeCall[] }>;
  list: { status: number; text: string; calls: FakeCall[] };
  repositorySaveSolution: FakeCall[];
}

const BASELINE_PATH = join(dirname(fileURLToPath(import.meta.url)), "__baseline__", "persistenceOff.baseline.json");
const CAPTURE = process.env["STAGE5_BASELINE_CAPTURE"] === "1";

const AUTH = { Authorization: "Bearer t" };
const PID = "99999999-9999-4999-8999-999999999991";
const PID_NO_SOLUTION = "99999999-9999-4999-8999-999999999992";
const PID_MISSING = "99999999-9999-4999-8999-999999999993";

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

function fakeCas() {
  return {
    verifyWorkLines: vi.fn(() => Promise.resolve([])),
    verifyFinalAnswer: vi.fn(() => Promise.resolve({ verified: true })),
  };
}

function newFake(): FakeSupabase {
  const fake = createFakeSupabase({
    tables: BASE_TABLES,
    rows: {
      problems: [
        {
          id: PID,
          user_id: "user-1",
          grade: "M2",
          input_type: "photo",
          recognized_text: "이차함수의 최솟값",
          recognized_latex: "y=x^2-4x+3",
          created_at: "2026-10-25T01:00:00.000Z",
        },
        {
          id: PID_NO_SOLUTION,
          user_id: "user-1",
          grade: "M2",
          input_type: "handwriting",
          recognized_text: "풀이 없는 문제",
          recognized_latex: null,
          created_at: "2026-10-25T00:00:00.000Z",
        },
      ],
      solutions: [
        {
          id: "s-1",
          problem_id: PID,
          concept_md: "개념",
          solution_md: "## 풀이\n1. a",
          answer_md: "-1",
          concept_tags: ["이차함수 > 최대·최소"],
          ai_provider: "openai",
          ai_model: "gpt-test",
          created_at: "2026-10-25T01:00:01.000Z",
        },
      ],
      chat_messages: [
        { id: "c-1", problem_id: PID, role: "user", content: "왜요?", created_at: "2026-10-25T01:00:02.000Z" },
        { id: "c-2", problem_id: PID, role: "assistant", content: "그래서요.", created_at: "2026-10-25T01:00:03.000Z" },
      ],
    },
  });
  holder.fake = fake;
  return fake;
}

function seedMemory(): void {
  inMemoryProblemStore.clear();
  inMemoryProblemStore.set({
    problemId: PID,
    userId: "user-1",
    grade: "M2",
    problem: { recognizedText: "이차함수의 최솟값", recognizedLatex: "y=x^2-4x+3" },
    createdAt: "2026-10-25T01:00:00.000Z",
    workLines: [
      { lineNo: 1, latex: "y = x^{2} - 4x + 3", isLowConfidence: false },
      { lineNo: 2, latex: "y=(x+2)^2-1", isLowConfidence: false },
    ],
    diagnosis: DIAG,
  });
}

async function collect(): Promise<PersistenceBaseline> {
  const app = () => createApp(new FakeLLMAdapter(), fakeCas());

  let fake = newFake();
  seedMemory();
  await request(app()).post(`/api/problems/${PID}/solve`).set(AUTH).send({ options: { concept: true, solution: true } });
  const solveCalls = [...fake.calls];

  fake = newFake();
  seedMemory();
  const resume = await request(app()).post(`/api/problems/${PID}/resume`).set(AUTH).send({ mode: "own" });
  const resumeCalls = [...fake.calls];

  const detail: PersistenceBaseline["detail"] = {};
  for (const [key, pid] of [
    ["withSolution", PID],
    ["noSolution", PID_NO_SOLUTION],
    ["missing", PID_MISSING],
  ] as const) {
    fake = newFake();
    const res = await request(app()).get(`/api/problems/${pid}`).set(AUTH);
    detail[key] = { status: res.status, text: res.text, calls: [...fake.calls] };
  }

  fake = newFake();
  const listRes = await request(app()).get("/api/problems").set(AUTH);
  const list = { status: listRes.status, text: listRes.text, calls: [...fake.calls] };

  fake = newFake();
  await createProblemRepository(fake.client).saveSolution({
    problemId: PID,
    solution: {
      conceptMd: null,
      solutionMd: "## 풀이\n1. a",
      answerMd: "-1",
      conceptTags: [],
      aiProvider: "claude",
      aiModel: "fake-whymath-v0",
    },
  });
  const repositorySaveSolution = [...fake.calls];

  return { solveCalls, resumeCalls, resumeSse: resume.text, detail, list, repositorySaveSolution };
}

const baseline: PersistenceBaseline | null = existsSync(BASELINE_PATH)
  ? (JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as PersistenceBaseline)
  : null;

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  getUserMock.mockReset();
  getUserMock.mockResolvedValue({ data: { user: { id: "user-1", user_metadata: { grade: "M2" } } }, error: null });
});

describe("Stage 5 WU0 — 저장·재조회 off 바이트 기준값", () => {
  if (CAPTURE) {
    it("기준값 캡처(파일이 없을 때만)", async () => {
      expect(baseline).toBeNull();
      writeFileSync(BASELINE_PATH, `${JSON.stringify(await collect(), null, 2)}\n`);
    });
    return;
  }

  it("solve·resume·상세·목록·saveSolution의 Supabase 호출과 응답이 기준값과 같다(resume 저장소 호출 0)", async () => {
    expect(baseline).not.toBeNull();
    const actual = await collect();
    expect(actual.resumeCalls).toEqual([]);
    expect(JSON.stringify(actual.solveCalls)).toBe(JSON.stringify(baseline?.solveCalls));
    expect(JSON.stringify(actual.resumeCalls)).toBe(JSON.stringify(baseline?.resumeCalls));
    expect(actual.resumeSse).toBe(baseline?.resumeSse);
    expect(JSON.stringify(actual.detail)).toBe(JSON.stringify(baseline?.detail));
    expect(JSON.stringify(actual.list)).toBe(JSON.stringify(baseline?.list));
    expect(JSON.stringify(actual.repositorySaveSolution)).toBe(JSON.stringify(baseline?.repositorySaveSolution));
  });
});
