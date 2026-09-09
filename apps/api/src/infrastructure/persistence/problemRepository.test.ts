import type { SupabaseClient } from "@supabase/supabase-js";
import type { Solution } from "shared-types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createProblemRepository, ProblemHistoryQueryError } from "./problemRepository";

interface RecordedCall {
  table: string;
  method: "upsert" | "insert";
  payload: unknown;
  options?: unknown;
}

type FakeResult = { error: unknown } | Error;

/**
 * Supabase client의 `from(table).upsert/insert(...)` 부분만 흉내내는 가짜 클라이언트.
 * 모듈 mock 없이 팩토리에 직접 주입해서 호출 인자를 검증한다.
 */
function createFakeClient(result: FakeResult = { error: null }) {
  const calls: RecordedCall[] = [];

  function record(table: string, method: "upsert" | "insert") {
    return (payload: unknown, options?: unknown) => {
      calls.push({ table, method, payload, options });
      if (result instanceof Error) {
        throw result;
      }
      return Promise.resolve(result);
    };
  }

  const client = {
    from: (table: string) => ({
      upsert: record(table, "upsert"),
      insert: record(table, "insert"),
    }),
  };

  return { client: client as unknown as SupabaseClient, calls };
}

type FakeQueryResult = { data: unknown; error: unknown; count?: number | null };

/**
 * 조회용 가짜 클라이언트. `select/eq/in/order`는 자기 자신(thenable)을 돌려주고,
 * `maybeSingle()`과 await 시점에 테이블별로 미리 지정한 결과를 돌려준다.
 */
function createFakeQueryClient(resultsByTable: Record<string, FakeQueryResult>) {
  const calls: { table: string; method: string; args: unknown[] }[] = [];

  function createBuilder(table: string) {
    const result = resultsByTable[table] ?? { data: [], error: null };

    const builder = {
      select: (...args: unknown[]) => record("select", args),
      delete: (...args: unknown[]) => record("delete", args),
      eq: (...args: unknown[]) => record("eq", args),
      in: (...args: unknown[]) => record("in", args),
      gte: (...args: unknown[]) => record("gte", args),
      order: (...args: unknown[]) => record("order", args),
      maybeSingle: (...args: unknown[]) => {
        record("maybeSingle", args);
        return Promise.resolve(result);
      },
      // await 시 PostgREST 빌더처럼 결과로 resolve된다.
      then: (onFulfilled: (value: FakeQueryResult) => unknown) =>
        Promise.resolve(result).then(onFulfilled),
    };

    function record(method: string, args: unknown[]) {
      calls.push({ table, method, args });
      return builder;
    }

    return builder;
  }

  const client = { from: (table: string) => createBuilder(table) };

  return { client: client as unknown as SupabaseClient, calls };
}

const SOLUTION: Solution = {
  conceptMd: "개념 설명",
  solutionMd: "풀이 과정",
  answerMd: "42",
  conceptTags: ["일차방정식"],
  aiProvider: "openai",
  aiModel: "gpt-test",
};

describe("problemRepository", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("saveProblem", () => {
    it("problems 테이블에 올바른 payload로 upsert한다", async () => {
      const { client, calls } = createFakeClient();

      await createProblemRepository(client).saveProblem({
        problemId: "problem-1",
        userId: "user-1",
        grade: "M2",
        inputType: "photo",
        problem: { recognizedText: "2x + 1 = 5", recognizedLatex: "2x+1=5" },
        createdAt: "2026-08-16T00:00:00.000Z",
      });

      expect(calls).toHaveLength(1);
      expect(calls[0]).toEqual({
        table: "problems",
        method: "upsert",
        payload: {
          id: "problem-1",
          user_id: "user-1",
          grade: "M2",
          input_type: "photo",
          recognized_text: "2x + 1 = 5",
          recognized_latex: "2x+1=5",
          created_at: "2026-08-16T00:00:00.000Z",
        },
        options: { onConflict: "id", ignoreDuplicates: true },
      });
    });

    it("userId가 unknown이면 Supabase를 호출하지 않는다", async () => {
      const { client, calls } = createFakeClient();

      await createProblemRepository(client).saveProblem({
        problemId: "problem-1",
        userId: "unknown",
        grade: "M2",
        inputType: "handwriting",
        problem: { recognizedText: "2x + 1 = 5", recognizedLatex: null },
        createdAt: "2026-08-16T00:00:00.000Z",
      });

      expect(calls).toHaveLength(0);
    });
  });

  describe("saveSolution", () => {
    it("solutions 테이블에 onConflict problem_id로 upsert한다", async () => {
      const { client, calls } = createFakeClient();

      await createProblemRepository(client).saveSolution({
        problemId: "problem-1",
        solution: SOLUTION,
      });

      expect(calls).toHaveLength(1);
      expect(calls[0]).toEqual({
        table: "solutions",
        method: "upsert",
        payload: {
          problem_id: "problem-1",
          concept_md: "개념 설명",
          solution_md: "풀이 과정",
          answer_md: "42",
          concept_tags: ["일차방정식"],
          ai_provider: "openai",
          ai_model: "gpt-test",
        },
        options: { onConflict: "problem_id" },
      });
    });
  });

  describe("saveChatTurn", () => {
    it("chat_messages 테이블에 user→assistant 순서로 두 행을 insert한다", async () => {
      const { client, calls } = createFakeClient();

      await createProblemRepository(client).saveChatTurn({
        problemId: "problem-1",
        question: "왜 이렇게 되나요?",
        answer: "이항했기 때문입니다.",
      });

      expect(calls).toHaveLength(1);
      expect(calls[0]).toEqual({
        table: "chat_messages",
        method: "insert",
        payload: [
          { problem_id: "problem-1", role: "user", content: "왜 이렇게 되나요?" },
          { problem_id: "problem-1", role: "assistant", content: "이항했기 때문입니다." },
        ],
        options: undefined,
      });
    });
  });

  describe("실패를 삼킨다", () => {
    it("Supabase가 { error }를 반환해도 reject하지 않는다", async () => {
      const { client } = createFakeClient({ error: { message: "insert 실패" } });
      const repository = createProblemRepository(client);

      await expect(
        repository.saveProblem({
          problemId: "problem-1",
          userId: "user-1",
          grade: "M2",
          inputType: "photo",
          problem: { recognizedText: "2x + 1 = 5", recognizedLatex: null },
          createdAt: "2026-08-16T00:00:00.000Z",
        }),
      ).resolves.toBeUndefined();
      await expect(
        repository.saveSolution({ problemId: "problem-1", solution: SOLUTION }),
      ).resolves.toBeUndefined();
      await expect(
        repository.saveChatTurn({ problemId: "problem-1", question: "q", answer: "a" }),
      ).resolves.toBeUndefined();

      expect(console.error).toHaveBeenCalled();
    });

    it("Supabase 호출이 예외를 던져도 reject하지 않는다", async () => {
      const { client } = createFakeClient(new Error("네트워크 오류"));
      const repository = createProblemRepository(client);

      await expect(
        repository.saveProblem({
          problemId: "problem-1",
          userId: "user-1",
          grade: "M2",
          inputType: "photo",
          problem: { recognizedText: "2x + 1 = 5", recognizedLatex: null },
          createdAt: "2026-08-16T00:00:00.000Z",
        }),
      ).resolves.toBeUndefined();
      await expect(
        repository.saveSolution({ problemId: "problem-1", solution: SOLUTION }),
      ).resolves.toBeUndefined();
      await expect(
        repository.saveChatTurn({ problemId: "problem-1", question: "q", answer: "a" }),
      ).resolves.toBeUndefined();

      expect(console.error).toHaveBeenCalled();
    });
  });

  describe("listProblems", () => {
    it("problems와 solutions를 problemId 기준으로 병합해 반환한다", async () => {
      const { client, calls } = createFakeQueryClient({
        problems: {
          data: [
            { id: "problem-2", recognized_text: "3x = 9", created_at: "2026-08-16T01:00:00.000Z" },
            { id: "problem-1", recognized_text: "2x + 1 = 5", created_at: "2026-08-16T00:00:00.000Z" },
          ],
          error: null,
        },
        solutions: {
          data: [{ problem_id: "problem-1", concept_tags: ["일차방정식"] }],
          error: null,
        },
      });

      const items = await createProblemRepository(client).listProblems("user-1");

      expect(items).toEqual([
        {
          problemId: "problem-2",
          recognizedText: "3x = 9",
          // 매칭되는 solution이 없으면 에러가 아니라 빈 배열이다.
          conceptTags: [],
          createdAt: "2026-08-16T01:00:00.000Z",
        },
        {
          problemId: "problem-1",
          recognizedText: "2x + 1 = 5",
          conceptTags: ["일차방정식"],
          createdAt: "2026-08-16T00:00:00.000Z",
        },
      ]);
      expect(calls).toContainEqual({ table: "problems", method: "eq", args: ["user_id", "user-1"] });
      expect(calls).toContainEqual({
        table: "solutions",
        method: "in",
        args: ["problem_id", ["problem-2", "problem-1"]],
      });
    });

    it("problems가 비어 있으면 solutions를 조회하지 않는다", async () => {
      const { client, calls } = createFakeQueryClient({ problems: { data: [], error: null } });

      await expect(createProblemRepository(client).listProblems("user-1")).resolves.toEqual([]);
      expect(calls.some((call) => call.table === "solutions")).toBe(false);
    });

    it("쿼리가 에러를 반환하면 원본 메시지를 감춘 에러로 throw한다", async () => {
      const { client } = createFakeQueryClient({
        problems: { data: null, error: { message: "permission denied for table problems" } },
      });

      await expect(createProblemRepository(client).listProblems("user-1")).rejects.toThrow(
        ProblemHistoryQueryError,
      );
      await expect(createProblemRepository(client).listProblems("user-1")).rejects.not.toThrow(
        /permission denied/,
      );
    });
  });

  describe("getProblemDetail", () => {
    const PROBLEM_ROW = {
      id: "problem-1",
      recognized_text: "2x + 1 = 5",
      recognized_latex: "2x+1=5",
      created_at: "2026-08-16T00:00:00.000Z",
      user_id: "user-1",
    };

    it("문제·풀이·대화를 합쳐서 반환한다", async () => {
      const { client } = createFakeQueryClient({
        problems: { data: PROBLEM_ROW, error: null },
        solutions: {
          data: {
            concept_md: "개념 설명",
            solution_md: "풀이 과정",
            answer_md: "42",
            concept_tags: ["일차방정식"],
            ai_provider: "openai",
            ai_model: "gpt-test",
          },
          error: null,
        },
        chat_messages: {
          data: [
            { role: "user", content: "왜요?", created_at: "2026-08-16T00:01:00.000Z" },
            { role: "assistant", content: "이항했어요.", created_at: "2026-08-16T00:02:00.000Z" },
          ],
          error: null,
        },
      });

      await expect(
        createProblemRepository(client).getProblemDetail("user-1", "problem-1"),
      ).resolves.toEqual({
        problemId: "problem-1",
        recognizedText: "2x + 1 = 5",
        recognizedLatex: "2x+1=5",
        createdAt: "2026-08-16T00:00:00.000Z",
        solution: {
          conceptMd: "개념 설명",
          solutionMd: "풀이 과정",
          answerMd: "42",
          conceptTags: ["일차방정식"],
          aiProvider: "openai",
          aiModel: "gpt-test",
        },
        chatMessages: [
          { role: "user", content: "왜요?", createdAt: "2026-08-16T00:01:00.000Z" },
          { role: "assistant", content: "이항했어요.", createdAt: "2026-08-16T00:02:00.000Z" },
        ],
      });
    });

    it("풀이/대화가 없으면 solution은 null, chatMessages는 빈 배열이다", async () => {
      const { client } = createFakeQueryClient({
        problems: { data: PROBLEM_ROW, error: null },
        solutions: { data: null, error: null },
        chat_messages: { data: null, error: null },
      });

      const detail = await createProblemRepository(client).getProblemDetail("user-1", "problem-1");

      expect(detail?.solution).toBeNull();
      expect(detail?.chatMessages).toEqual([]);
    });

    it("문제가 없으면 null을 반환한다", async () => {
      const { client } = createFakeQueryClient({ problems: { data: null, error: null } });

      await expect(
        createProblemRepository(client).getProblemDetail("user-1", "problem-1"),
      ).resolves.toBeNull();
    });

    it("다른 사용자의 문제면 null을 반환한다(없는 것과 구분하지 않는다)", async () => {
      const { client, calls } = createFakeQueryClient({
        problems: { data: { ...PROBLEM_ROW, user_id: "user-2" }, error: null },
      });

      await expect(
        createProblemRepository(client).getProblemDetail("user-1", "problem-1"),
      ).resolves.toBeNull();
      // 소유자가 아니면 풀이/대화 조회 자체를 하지 않는다.
      expect(calls.some((call) => call.table !== "problems")).toBe(false);
    });

    it("쿼리가 에러를 반환하면 throw한다", async () => {
      const { client } = createFakeQueryClient({
        problems: { data: null, error: { message: "connection reset" } },
      });

      await expect(
        createProblemRepository(client).getProblemDetail("user-1", "problem-1"),
      ).rejects.toThrow(ProblemHistoryQueryError);
    });
  });

  describe("deleteProblems", () => {
    it("user_id/id 조건으로 delete하고 실제로 삭제된 id 목록을 반환한다", async () => {
      const { client, calls } = createFakeQueryClient({
        problems: { data: [{ id: "problem-1" }, { id: "problem-2" }], error: null },
      });

      const deleted = await createProblemRepository(client).deleteProblems("user-1", [
        "problem-1",
        "problem-2",
      ]);

      expect(deleted).toEqual(["problem-1", "problem-2"]);
      expect(calls).toContainEqual({ table: "problems", method: "delete", args: [] });
      expect(calls).toContainEqual({ table: "problems", method: "eq", args: ["user_id", "user-1"] });
      expect(calls).toContainEqual({
        table: "problems",
        method: "in",
        args: ["id", ["problem-1", "problem-2"]],
      });
    });

    it("아무 것도 삭제되지 않으면(존재하지 않거나 타인 소유) 빈 배열을 반환한다", async () => {
      const { client } = createFakeQueryClient({
        problems: { data: [], error: null },
      });

      await expect(
        createProblemRepository(client).deleteProblems("user-1", ["problem-x"]),
      ).resolves.toEqual([]);
    });

    it("쿼리가 에러를 반환하면 원본 메시지를 감춘 에러로 throw한다", async () => {
      const { client } = createFakeQueryClient({
        problems: { data: null, error: { message: "permission denied for table problems" } },
      });

      await expect(
        createProblemRepository(client).deleteProblems("user-1", ["problem-1"]),
      ).rejects.toThrow(ProblemHistoryQueryError);
    });
  });

  describe("countProblemsCreatedToday", () => {
    it("오늘 생성된 problems 행 개수를 반환한다", async () => {
      const { client, calls } = createFakeQueryClient({
        problems: { data: null, error: null, count: 3 },
      });

      await expect(
        createProblemRepository(client).countProblemsCreatedToday("user-1"),
      ).resolves.toBe(3);
      expect(calls).toContainEqual({ table: "problems", method: "eq", args: ["user_id", "user-1"] });
      expect(calls.some((call) => call.table === "problems" && call.method === "gte")).toBe(true);
    });

    it("count가 null이면 0을 반환한다", async () => {
      const { client } = createFakeQueryClient({
        problems: { data: null, error: null, count: null },
      });

      await expect(
        createProblemRepository(client).countProblemsCreatedToday("user-1"),
      ).resolves.toBe(0);
    });

    it("쿼리가 에러를 반환하면 원본 메시지를 감춘 에러로 throw한다", async () => {
      const { client } = createFakeQueryClient({
        problems: { data: null, error: { message: "permission denied for table problems" } },
      });

      await expect(
        createProblemRepository(client).countProblemsCreatedToday("user-1"),
      ).rejects.toThrow(ProblemHistoryQueryError);
    });
  });

  it("가짜 client에 .from이 없어도(얕은 mock) 실패를 삼킨다", async () => {
    const repository = createProblemRepository({} as unknown as SupabaseClient);

    await expect(
      repository.saveSolution({ problemId: "problem-1", solution: SOLUTION }),
    ).resolves.toBeUndefined();
  });
});
