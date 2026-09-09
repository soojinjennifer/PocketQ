import type { SupabaseClient } from "@supabase/supabase-js";
import type { Grade, RecognizedProblem, Solution } from "shared-types";
import { getSupabaseServerClient } from "../supabase/client";

export interface SaveProblemInput {
  problemId: string;
  userId: string;
  grade: Grade;
  inputType: "photo" | "handwriting";
  problem: RecognizedProblem;
  createdAt: string;
}

export interface SaveSolutionInput {
  problemId: string;
  solution: Solution;
}

export interface SaveChatTurnInput {
  problemId: string;
  question: string;
  answer: string;
}

/** GET /api/problems 목록 항목 (validation의 problemHistoryListItemSchema와 shape이 일치한다) */
export interface ProblemHistoryListItem {
  problemId: string;
  recognizedText: string;
  conceptTags: string[];
  createdAt: string;
}

/** GET /api/problems/:problemId 상세 (validation의 problemHistoryDetailSchema와 shape이 일치한다) */
export interface ProblemHistoryDetail {
  problemId: string;
  recognizedText: string;
  recognizedLatex: string | null;
  createdAt: string;
  solution: {
    conceptMd: string | null;
    solutionMd: string | null;
    answerMd: string;
    conceptTags: string[];
    aiProvider: string;
    aiModel: string;
  } | null;
  chatMessages: { role: string; content: string; createdAt: string }[];
}

/**
 * recognize/solve/chat 성공 결과를 Supabase에 best-effort로 영구 저장하고,
 * 마이페이지 풀이 이력을 조회한다.
 *
 * `saveXxx`의 저장 실패는 사용자 응답에 영향을 주지 않는다 — 어떤 상황에서도
 * throw하지 않고 console.error로만 로그를 남긴다. 호출부(라우터)는 별도의
 * try/catch 없이 그냥 `await` 하면 된다. 특히 solve는 SSE 스트림 도중에
 * 호출되므로, 여기서 예외가 새어나가면 어댑터 에러용 catch에 잘못 걸려
 * "풀이 생성 중 오류" 이벤트를 오발생시킬 수 있다.
 *
 * 반대로 조회 메서드(`listProblems`/`getProblemDetail`)는 실패를 삼키지 않고
 * 반드시 throw한다 — 조회 실패를 "결과 없음"으로 응답하면 사용자에게 데이터가
 * 사라진 것처럼 보이기 때문이다. 단, Supabase 원본 에러 메시지가 클라이언트로
 * 새어나가지 않도록 `ProblemHistoryQueryError`로 감싸서 던진다.
 */
export interface ProblemRepository {
  saveProblem(input: SaveProblemInput): Promise<void>;
  saveSolution(input: SaveSolutionInput): Promise<void>;
  saveChatTurn(input: SaveChatTurnInput): Promise<void>;
  listProblems(userId: string): Promise<ProblemHistoryListItem[]>;
  getProblemDetail(userId: string, problemId: string): Promise<ProblemHistoryDetail | null>;
  /**
   * 마이페이지 개선 3번(체크박스 일괄 삭제). `user_id`가 일치하는 행만 삭제하고(타인 소유 문제는
   * 조용히 건너뜀 — `getProblemDetail`과 동일한 정보 비노출 원칙), 실제로 삭제된 `problemId`
   * 목록만 반환한다. `solutions`/`chat_messages`는 FK `on delete cascade`(마이그레이션
   * `20260816000000_persistence.sql`)로 자동 삭제되므로 별도 삭제 쿼리가 필요 없다.
   * 조회 메서드와 동일하게 실패를 삼키지 않고 throw한다 — 삭제 실패를 "삭제됨"으로 오인시키면
   * 안 되기 때문이다.
   */
  deleteProblems(userId: string, problemIds: string[]): Promise<string[]>;
  /**
   * 소프트 캡(하루 10회, 매일 자정 UTC 리셋, 오너 확정) 안내용. 오늘(UTC 자정 기준) 생성된 해당
   * 유저의 `problems` 행 개수를 센다. 별도 카운터 테이블을 두지 않고 기존 `problems` 데이터로
   * 계산한다(오너 확정 — 카운트 1회 = recognize 1회 성공).
   * 조회 메서드(`listProblems`/`getProblemDetail`/`deleteProblems`)와 동일하게 실패를 삼키지 않고
   * throw한다 — 호출부(recognition 라우터)가 이 실패로 인식 자체가 막히지 않도록 best-effort로
   * 감싼다.
   */
  countProblemsCreatedToday(userId: string): Promise<number>;
}

/** 조회 실패를 라우터로 알리는 에러. Supabase 원본 메시지는 담지 않는다(클라이언트 노출 방지). */
export class ProblemHistoryQueryError extends Error {
  constructor(operation: string) {
    super(`[problemRepository] ${operation} 조회 실패`);
    this.name = "ProblemHistoryQueryError";
  }
}

/** Supabase가 예외 대신 `{ error }`로 돌려주는 조회 실패를 감싼 에러로 변환한다. */
function throwIfQueryError(operation: string, error: unknown): void {
  if (error) {
    console.error(`[problemRepository] ${operation} 실패`, error);
    throw new ProblemHistoryQueryError(operation);
  }
}

/** 조회 쿼리가 돌려주는 snake_case 행 shape (SupabaseClient가 제네릭 스키마 없이 쓰여 any가 되는 것을 막는다). */
interface ProblemListRow {
  id: string;
  recognized_text: string;
  created_at: string;
}

interface SolutionTagsRow {
  problem_id: string;
  concept_tags: string[] | null;
}

interface ProblemDetailRow extends ProblemListRow {
  recognized_latex: string | null;
  user_id: string;
}

interface SolutionDetailRow {
  concept_md: string | null;
  solution_md: string | null;
  answer_md: string;
  concept_tags: string[] | null;
  ai_provider: string;
  ai_model: string;
}

interface ChatMessageRow {
  role: string;
  content: string;
  created_at: string;
}

/** Supabase가 예외 대신 `{ error }`로 돌려주는 실패도 동일하게 로그만 남긴다. */
function logIfError(operation: string, error: unknown): void {
  if (error) {
    console.error(`[problemRepository] ${operation} 실패`, error);
  }
}

/**
 * 오늘(UTC 자정 기준) 0시 ISO 문자열. 이 프로젝트에는 아직 별도 타임존 관례가 없어(예:
 * `problems.created_at`도 서버 `new Date().toISOString()`을 그대로 저장) UTC를 기준으로 삼는다.
 */
function getStartOfTodayUtcIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

export function createProblemRepository(client: SupabaseClient): ProblemRepository {
  return {
    async saveProblem({ problemId, userId, grade, inputType, problem, createdAt }) {
      // 인증 미들웨어가 항상 유효한 id를 채우지만, 방어적으로 확인한다.
      // problems.user_id는 auth.users FK라 "unknown"으로는 저장할 수 없다.
      if (userId === "unknown") {
        console.error(
          "[problemRepository] saveProblem 건너뜀: 인증된 사용자 id가 없습니다.",
          problemId,
        );
        return;
      }

      try {
        const { error } = await client.from("problems").upsert(
          {
            id: problemId,
            user_id: userId,
            grade,
            input_type: inputType,
            recognized_text: problem.recognizedText,
            recognized_latex: problem.recognizedLatex,
            created_at: createdAt,
          },
          { onConflict: "id", ignoreDuplicates: true },
        );
        logIfError("saveProblem", error);
      } catch (error) {
        console.error("[problemRepository] saveProblem 실패", error);
      }
    },

    async saveSolution({ problemId, solution }) {
      try {
        // 같은 problemId로 재호출(재풀이)돼도 덮어쓰도록 upsert한다 — 중복 행 방지.
        const { error } = await client.from("solutions").upsert(
          {
            problem_id: problemId,
            concept_md: solution.conceptMd,
            solution_md: solution.solutionMd,
            answer_md: solution.answerMd,
            concept_tags: solution.conceptTags,
            ai_provider: solution.aiProvider,
            ai_model: solution.aiModel,
          },
          { onConflict: "problem_id" },
        );
        logIfError("saveSolution", error);
      } catch (error) {
        console.error("[problemRepository] saveSolution 실패", error);
      }
    },

    async saveChatTurn({ problemId, question, answer }) {
      try {
        // 질문/답변 두 행을 한 번에 insert해서 저장 순서를 보장한다.
        const { error } = await client.from("chat_messages").insert([
          { problem_id: problemId, role: "user", content: question },
          { problem_id: problemId, role: "assistant", content: answer },
        ]);
        logIfError("saveChatTurn", error);
      } catch (error) {
        console.error("[problemRepository] saveChatTurn 실패", error);
      }
    },

    async listProblems(userId) {
      // PostgREST embedding 대신 단순 쿼리 2회 + JS 병합으로 처리한다(가독성·디버깅 용이성 우선).
      const problemsResult = (await client
        .from("problems")
        .select("id, recognized_text, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })) as {
        data: ProblemListRow[] | null;
        error: unknown;
      };
      throwIfQueryError("listProblems.problems", problemsResult.error);

      const problems = problemsResult.data ?? [];
      if (problems.length === 0) {
        return [];
      }

      const solutionsResult = (await client
        .from("solutions")
        .select("problem_id, concept_tags")
        .in(
          "problem_id",
          problems.map((row) => row.id),
        )) as { data: SolutionTagsRow[] | null; error: unknown };
      throwIfQueryError("listProblems.solutions", solutionsResult.error);

      const tagsByProblemId = new Map(
        (solutionsResult.data ?? []).map((row) => [row.problem_id, row.concept_tags ?? []]),
      );

      return problems.map((row) => ({
        problemId: row.id,
        recognizedText: row.recognized_text,
        // 아직 풀이가 끝나지 않았거나 저장에 실패한 문제는 태그가 없다 — 에러가 아니라 빈 배열이다.
        conceptTags: tagsByProblemId.get(row.id) ?? [],
        createdAt: row.created_at,
      }));
    },

    async getProblemDetail(userId, problemId) {
      const problemResult = (await client
        .from("problems")
        .select("id, recognized_text, recognized_latex, created_at, user_id")
        .eq("id", problemId)
        .maybeSingle()) as { data: ProblemDetailRow | null; error: unknown };
      throwIfQueryError("getProblemDetail.problem", problemResult.error);

      const problem = problemResult.data;
      // "존재하지 않음"과 "타인 소유"를 구분하지 않고 동일하게 null로 처리한다(정보 노출 방지).
      if (!problem || problem.user_id !== userId) {
        return null;
      }

      const solutionResult = (await client
        .from("solutions")
        .select("concept_md, solution_md, answer_md, concept_tags, ai_provider, ai_model")
        .eq("problem_id", problemId)
        .maybeSingle()) as { data: SolutionDetailRow | null; error: unknown };
      throwIfQueryError("getProblemDetail.solution", solutionResult.error);

      const messagesResult = (await client
        .from("chat_messages")
        .select("role, content, created_at")
        .eq("problem_id", problemId)
        .order("created_at", { ascending: true })) as {
        data: ChatMessageRow[] | null;
        error: unknown;
      };
      throwIfQueryError("getProblemDetail.chatMessages", messagesResult.error);

      const solution = solutionResult.data;

      return {
        problemId: problem.id,
        recognizedText: problem.recognized_text,
        recognizedLatex: problem.recognized_latex,
        createdAt: problem.created_at,
        solution: solution
          ? {
              conceptMd: solution.concept_md,
              solutionMd: solution.solution_md,
              answerMd: solution.answer_md,
              conceptTags: solution.concept_tags ?? [],
              aiProvider: solution.ai_provider,
              aiModel: solution.ai_model,
            }
          : null,
        chatMessages: (messagesResult.data ?? []).map((row) => ({
          role: row.role,
          content: row.content,
          createdAt: row.created_at,
        })),
      };
    },

    async deleteProblems(userId, problemIds) {
      const result = (await client
        .from("problems")
        .delete()
        .eq("user_id", userId)
        .in("id", problemIds)
        .select("id")) as { data: { id: string }[] | null; error: unknown };
      throwIfQueryError("deleteProblems", result.error);

      return (result.data ?? []).map((row) => row.id);
    },

    async countProblemsCreatedToday(userId) {
      const startOfTodayUtcIso = getStartOfTodayUtcIso();
      const result = (await client
        .from("problems")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", startOfTodayUtcIso)) as { count: number | null; error: unknown };
      throwIfQueryError("countProblemsCreatedToday", result.error);

      return result.count ?? 0;
    },
  };
}

/**
 * 운영용 기본 인스턴스. 라우터는 이걸 직접 import해서 쓴다(inMemoryProblemStore와 동일 패턴).
 *
 * Supabase 클라이언트는 모듈 로드 시점이 아니라 첫 호출 시점에 만든다 —
 * 환경변수가 비어 있는 테스트 환경에서 `createClient("", "")`가 즉시 던지기 때문에,
 * import만으로 앱 부트스트랩이 깨지지 않게 하기 위함이다(authenticate 미들웨어와 동일 전략).
 */
let defaultRepository: ProblemRepository | undefined;

function getDefaultRepository(): ProblemRepository | undefined {
  if (!defaultRepository) {
    try {
      defaultRepository = createProblemRepository(getSupabaseServerClient());
    } catch (error) {
      console.error("[problemRepository] Supabase 클라이언트 초기화 실패", error);
    }
  }
  return defaultRepository;
}

export const problemRepository: ProblemRepository = {
  async saveProblem(input) {
    await getDefaultRepository()?.saveProblem(input);
  },
  async saveSolution(input) {
    await getDefaultRepository()?.saveSolution(input);
  },
  async saveChatTurn(input) {
    await getDefaultRepository()?.saveChatTurn(input);
  },
  async listProblems(userId) {
    return await requireDefaultRepository("listProblems").listProblems(userId);
  },
  async getProblemDetail(userId, problemId) {
    return await requireDefaultRepository("getProblemDetail").getProblemDetail(userId, problemId);
  },
  async deleteProblems(userId, problemIds) {
    return await requireDefaultRepository("deleteProblems").deleteProblems(userId, problemIds);
  },
  async countProblemsCreatedToday(userId) {
    return await requireDefaultRepository("countProblemsCreatedToday").countProblemsCreatedToday(
      userId,
    );
  },
};

/**
 * 조회 메서드는 저장과 달리 실패를 삼킬 수 없다 — Supabase 클라이언트 초기화조차
 * 실패한 상황을 "이력 없음"으로 응답하면 안 되므로 감싼 에러로 던진다.
 */
function requireDefaultRepository(operation: string): ProblemRepository {
  const repository = getDefaultRepository();
  if (!repository) {
    throw new ProblemHistoryQueryError(operation);
  }
  return repository;
}
