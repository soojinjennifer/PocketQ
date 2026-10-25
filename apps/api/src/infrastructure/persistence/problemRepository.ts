import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AiProvider,
  FigureSpec,
  Grade,
  RecognizedProblem,
  ResumeMode,
  ResumeSolution,
  ResumeWorkContext,
  Solution,
  StepFigureRef,
} from "shared-types";
import { FIGURE_SCHEMA_VERSION, parseSolutionFigures, resumeWorkContextSchema } from "validation";
import { env } from "../../config/env";
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

/**
 * 도형 단계가 끝난 뒤 수용된 도형 저장(SSE로 보낸 최종 재파싱 결과와 같은 값, AI 원본 아님).
 * `solution`은 같은 실행에서 `saveSolution`에 넘긴 **같은 객체**여야 한다 — 저장소는 텍스트 upsert 때 발급한
 * `figures_run_id`를 그 객체에 묶어 두고, 행의 run id가 같을 때만 도형을 쓴다(재풀이 뒤 늦게 끝난 이전 실행의 쓰기 차단,
 * `docs/FIGURE_SPEC.md` §8). 다른 객체·도형 저장 불가 상태면 쓰기 0.
 */
export interface SaveSolutionFiguresInput {
  problemId: string;
  solution: Solution;
  figures: FigureSpec[];
  stepFigureRefs: StepFigureRef[];
}

/** CAS 검증을 통과한 이어풀기 결과 저장(`resume_solutions`, 문제당 1행). */
export interface SaveResumeSolutionInput {
  problemId: string;
  resumeSolution: ResumeSolution;
  aiProvider: AiProvider;
  aiModel: string;
  /**
   * 진단에 쓴 줄·진단 근거(§12.1). 엄격 검사(`resumeWorkContextSchema`)를 통과하면 세 컬럼에 쓰고, 없거나 실패하면 세 값 모두 null
   * (부분 저장 금지). 키를 생략하면 null과 같다.
   */
  workContext?: ResumeWorkContext | null;
}

/** `SaveSolutionFiguresInput`과 같은 규칙(같은 실행에서 `saveResumeSolution`에 넘긴 같은 객체). */
export interface SaveResumeFiguresInput {
  problemId: string;
  resumeSolution: ResumeSolution;
  figures: FigureSpec[];
  stepFigureRefs: StepFigureRef[];
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
    /** 도형 저장 on + 컬럼 탐지 + 서버 재파싱으로 수용된 도형이 1개 이상일 때만 있다. */
    figures?: FigureSpec[];
    stepFigureRefs?: StepFigureRef[];
  } | null;
  chatMessages: { role: string; content: string; createdAt: string }[];
  /** 이어풀기 저장 on + 테이블 탐지 + 행이 있을 때만 있다(없으면 키 자체가 없다 — 기존 응답과 바이트 동일). */
  resumeSolution?: {
    mode: ResumeMode;
    methodName: string;
    solutionMd: string;
    answerMd: string;
    verified: boolean;
    figures?: FigureSpec[];
    stepFigureRefs?: StepFigureRef[];
    /** 엄격 검사를 통과한 진단 맥락일 때만 있다(과거 행·변조·실패면 키 없음, 상세는 그대로 200). */
    workContext?: ResumeWorkContext;
  };
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
  /**
   * 풀이 텍스트 upsert. 도형 저장 가능 상태면 도형 컬럼을 null로 비우고 새 `figures_run_id`를 함께 쓴다(재풀이 시 이전
   * 도형 제거, run id는 `input.solution` 객체에 묶어 둔다). 도형 키 때문에 "컬럼 없음"으로 실패하면 키 없이 1회 다시
   * 시도한다(텍스트 보호). 도형 저장 off면 payload가 기존과 바이트 단위로 같다.
   */
  saveSolution(input: SaveSolutionInput): Promise<void>;
  /** 도형 update(`problem_id`와 그 실행의 `figures_run_id`가 모두 같은 행만, 0행도 정상). best-effort, throw하지 않는다. */
  saveSolutionFigures(input: SaveSolutionFiguresInput): Promise<void>;
  /**
   * 이어풀기 결과 upsert(`verified === true`만, 문제당 1행). 이어풀기 저장 on + 테이블 탐지일 때만 쓴다.
   * 도형 저장도 on이면 도형 null·새 run id를 함께 쓴다. best-effort, throw하지 않는다.
   */
  saveResumeSolution(input: SaveResumeSolutionInput): Promise<void>;
  /** 이어풀기 도형 update(run id 조건). best-effort, throw하지 않는다. */
  saveResumeFigures(input: SaveResumeFiguresInput): Promise<void>;
  /** `FIGURES_PERSIST_ENABLED` off면 즉시 false(쿼리 0). on이면 solutions 도형 컬럼 탐지 결과. */
  figureColumnsAvailable(): Promise<boolean>;
  /** `RESUME_PERSIST_ENABLED` off면 즉시 false(쿼리 0). on이면 resume_solutions 테이블 탐지 결과. */
  resumeTableAvailable(): Promise<boolean>;
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

interface SolutionFiguresRow {
  figures?: unknown;
  step_figure_refs?: unknown;
  figures_schema_version?: unknown;
}

interface ResumeSolutionRow extends SolutionFiguresRow {
  work_lines?: unknown;
  last_valid_line?: unknown;
  stall_line?: unknown;
  mode: unknown;
  method_name: unknown;
  solution_md: unknown;
  answer_md: unknown;
  verified: unknown;
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

/** PostgREST/Postgres의 "컬럼 없음"(쓰기 PGRST204, 조회 42703)과 "테이블 없음"(PGRST205, 42P01) 오류 코드. */
const MISSING_COLUMN_CODES: ReadonlySet<string> = new Set(["PGRST204", "42703"]);
const MISSING_TABLE_CODES: ReadonlySet<string> = new Set(["PGRST205", "42P01"]);

function errorCodeOf(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

function isMissingColumnError(error: unknown): boolean {
  const code = errorCodeOf(error);
  return code !== null && MISSING_COLUMN_CODES.has(code);
}

function isMissingTableError(error: unknown): boolean {
  const code = errorCodeOf(error);
  return code !== null && MISSING_TABLE_CODES.has(code);
}

/**
 * "사용 불가" 판정 뒤 다시 탐지하기까지의 시간. **결정 필요(임시값)** — 마이그레이션 적용 직후 서버를 재시작하지
 * 않아도 늦어도 이 시간 안에 켜지게 한다. "사용 가능"은 프로세스가 살아 있는 동안 유지한다.
 */
export const PERSIST_REDETECT_AFTER_MS = 5 * 60_000;

export interface ProblemRepositoryOptions {
  /** 도형 저장 플래그. 기본 false(테스트·기존 호출부는 기존 동작 그대로). 운영 인스턴스는 `env.figuresPersistEnabled`. */
  figuresPersistEnabled?: boolean;
  /** 이어풀기 저장 플래그. 기본 false. 운영 인스턴스는 `env.resumePersistEnabled`. */
  resumePersistEnabled?: boolean;
  redetectAfterMs?: number;
  now?: () => number;
  newRunId?: () => string;
}

/**
 * 첫 사용 시 컬럼/테이블 존재를 `select(...).limit(0)`으로 확인한다. 어떤 오류든 "사용 불가"(로그 1회),
 * "사용 불가"는 `redetectAfterMs` 뒤 다시 탐지, "사용 가능"은 유지. 동시에 여러 요청이 와도 탐지 쿼리는 1개만 보낸다.
 * 쓰기 중 "컬럼/테이블 없음"을 만나면 `markUnavailable`로 되돌린다.
 */
function createAvailabilityProbe(
  name: string,
  enabled: boolean,
  probe: () => PromiseLike<{ error: unknown }>,
  now: () => number,
  redetectAfterMs: number,
) {
  let state: { kind: "unknown" } | { kind: "available" } | { kind: "unavailable"; retryAt: number } = { kind: "unknown" };
  let inflight: Promise<boolean> | null = null;

  function markUnavailable(error: unknown): void {
    if (state.kind !== "unavailable") {
      // 쓰기 중 오류로도 불리므로 오류 내용 대신 코드만 남긴다(행 내용 노출 방지, 재작업 1).
      console.error(`[problemRepository] ${name} 사용 불가 — ${redetectAfterMs}ms 뒤 다시 탐지한다`, {
        code: errorCodeOf(error) ?? (error instanceof Error ? error.name : typeof error),
      });
    }
    state = { kind: "unavailable", retryAt: now() + redetectAfterMs };
  }

  async function runProbe(): Promise<boolean> {
    try {
      const { error } = await probe();
      if (error) {
        markUnavailable(error);
        return false;
      }
      state = { kind: "available" };
      return true;
    } catch (error) {
      markUnavailable(error);
      return false;
    }
  }

  return {
    async check(): Promise<boolean> {
      if (!enabled) return false;
      if (state.kind === "available") return true;
      if (state.kind === "unavailable" && now() < state.retryAt) return false;
      inflight ??= runProbe().finally(() => {
        inflight = null;
      });
      return await inflight;
    },
    markUnavailable,
  };
}

/**
 * 저장된 도형을 재조회 시 서버에서 다시 검증한다(AI 호출 0). schemaVersion이 현재 버전이 아니면 도형만 버린다.
 * 수용된 도형이 1개 이상일 때만 키를 돌려준다(없으면 빈 객체 — 응답에 키가 생기지 않는다).
 */
function restoreFigures(row: SolutionFiguresRow): { figures?: FigureSpec[]; stepFigureRefs?: StepFigureRef[] } {
  if (row.figures_schema_version !== FIGURE_SCHEMA_VERSION) return {};
  const parsed = parseSolutionFigures({ figures: row.figures, stepFigureRefs: row.step_figure_refs });
  return parsed.figures.length > 0 ? { figures: parsed.figures, stepFigureRefs: parsed.stepFigureRefs } : {};
}

/** resume_solutions 행을 응답 모양으로 바꾼다. 행 자체가 깨졌으면(변조) null — 상세 전체를 실패시키지 않는다. */
function toResumeDetail(row: ResumeSolutionRow, withFigures: boolean): ProblemHistoryDetail["resumeSolution"] | null {
  if (
    (row.mode !== "own" && row.mode !== "alternative") ||
    typeof row.method_name !== "string" ||
    typeof row.solution_md !== "string" ||
    typeof row.answer_md !== "string" ||
    typeof row.verified !== "boolean"
  ) {
    return null;
  }
  return {
    mode: row.mode,
    methodName: row.method_name,
    solutionMd: row.solution_md,
    answerMd: row.answer_md,
    verified: row.verified,
    ...(withFigures ? restoreFigures(row) : {}),
    ...restoreWorkContext(row),
  };
}

/** 저장된 진단 맥락을 관대하게 읽는다 — 엄격 검사에 실패하면 키만 생략(상세 전체는 실패시키지 않는다). */
function restoreWorkContext(row: ResumeSolutionRow): { workContext?: ResumeWorkContext } {
  if (row.work_lines === null || row.work_lines === undefined) return {};
  const parsed = resumeWorkContextSchema.safeParse({
    lines: row.work_lines,
    lastValidLine: row.last_valid_line,
    stallLine: row.stall_line ?? null,
  });
  if (!parsed.success) return {};
  return {
    workContext: {
      lines: parsed.data.lines.map((line) => ({ lineNo: line.lineNo, latex: line.latex })),
      lastValidLine: parsed.data.lastValidLine,
      stallLine: parsed.data.stallLine,
    },
  };
}

/** 저장할 진단 맥락 세 컬럼. 검사 실패·없음이면 셋 다 null. 실패 사유는 줄 내용 없이 경로·코드만 로그한다. */
function workContextColumns(workContext: ResumeWorkContext | null | undefined): {
  work_lines: { lineNo: number; latex: string }[] | null;
  last_valid_line: number | null;
  stall_line: number | null;
} {
  const empty = { work_lines: null, last_valid_line: null, stall_line: null };
  if (!workContext) return empty;
  const parsed = resumeWorkContextSchema.safeParse(workContext);
  if (!parsed.success) {
    console.error(
      "[problemRepository] saveResumeSolution workContext 검사 실패 — 세 값 null로 저장",
      parsed.error.issues.slice(0, 3).map((issue) => ({ code: issue.code, path: issue.path.join(".") })),
    );
    return empty;
  }
  return {
    work_lines: parsed.data.lines.map((line) => ({ lineNo: line.lineNo, latex: line.latex })),
    last_valid_line: parsed.data.lastValidLine,
    stall_line: parsed.data.stallLine,
  };
}

/** resume upsert·도형 update 오류 로그 — Postgres 오류 문구·details에는 행 내용(학생 풀이 줄)이 들어갈 수 있어 코드만 남긴다. */
function logResumeWriteError(operation: string, error: unknown): void {
  if (error) console.error(`[problemRepository] ${operation} 실패`, { code: errorCodeOf(error) });
}

const SOLUTION_DETAIL_COLUMNS = "concept_md, solution_md, answer_md, concept_tags, ai_provider, ai_model";
const FIGURE_COLUMNS = "figures, step_figure_refs, figures_schema_version";
const RESUME_DETAIL_COLUMNS = "mode, method_name, solution_md, answer_md, verified, work_lines, last_valid_line, stall_line";

/** 도형 컬럼을 비우는 값(재풀이·재실행 시 이전 도형 제거). */
function clearedFigureColumns(runId: string) {
  return { figures: null, step_figure_refs: null, figures_schema_version: null, figures_run_id: runId };
}

/**
 * 오늘(UTC 자정 기준) 0시 ISO 문자열. 이 프로젝트에는 아직 별도 타임존 관례가 없어(예:
 * `problems.created_at`도 서버 `new Date().toISOString()`을 그대로 저장) UTC를 기준으로 삼는다.
 */
function getStartOfTodayUtcIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

export function createProblemRepository(
  client: SupabaseClient,
  options: ProblemRepositoryOptions = {},
): ProblemRepository {
  const figuresPersistEnabled = options.figuresPersistEnabled === true;
  const resumePersistEnabled = options.resumePersistEnabled === true;
  const now = options.now ?? Date.now;
  const redetectAfterMs = options.redetectAfterMs ?? PERSIST_REDETECT_AFTER_MS;
  const newRunId = options.newRunId ?? randomUUID;

  const figureColumns = createAvailabilityProbe(
    "solutions 도형 컬럼",
    figuresPersistEnabled,
    () => client.from("solutions").select("figures, step_figure_refs, figures_schema_version, figures_run_id").limit(0),
    now,
    redetectAfterMs,
  );
  const resumeTable = createAvailabilityProbe(
    "resume_solutions 테이블",
    resumePersistEnabled,
    () => client.from("resume_solutions").select("id, work_lines").limit(0),
    now,
    redetectAfterMs,
  );

  /** 텍스트 upsert에 성공한 실행의 run id(실행 결과 객체 → run id). 같은 객체로만 도형을 쓸 수 있다. */
  const runIds = new WeakMap<object, string>();

  /** run id 조건 도형 update(solutions·resume_solutions 공용). */
  async function updateFigures(
    table: "solutions" | "resume_solutions",
    { problemId, runId, figures, stepFigureRefs }: { problemId: string; runId: string; figures: FigureSpec[]; stepFigureRefs: StepFigureRef[] },
    onMissing: (error: unknown) => void,
  ): Promise<void> {
    try {
      const { error } = await client
        .from(table)
        .update({ figures, step_figure_refs: stepFigureRefs, figures_schema_version: FIGURE_SCHEMA_VERSION })
        .eq("problem_id", problemId)
        .eq("figures_run_id", runId);
      if (error && (isMissingColumnError(error) || isMissingTableError(error))) onMissing(error);
      // 오류 코드만 남긴다 — PostgREST 오류의 message·details에는 "Failing row contains (…)"처럼 행 내용(resume 행이면
      // 학생 풀이 줄)이 실릴 수 있다(재작업 1, QA LOW-1). upsert 경로의 `logResumeWriteError`와 같은 규칙.
      logResumeWriteError(`${table} 도형 저장`, error);
    } catch (error) {
      console.error(`[problemRepository] ${table} 도형 저장 실패`, { name: error instanceof Error ? error.name : typeof error });
    }
  }

  async function readResumeDetail(problemId: string): Promise<ProblemHistoryDetail["resumeSolution"] | null> {
    try {
      const result = (await client
        .from("resume_solutions")
        .select(figuresPersistEnabled ? `${RESUME_DETAIL_COLUMNS}, ${FIGURE_COLUMNS}` : RESUME_DETAIL_COLUMNS)
        .eq("problem_id", problemId)
        .maybeSingle()) as { data: ResumeSolutionRow | null; error: unknown };
      if (result.error) {
        if (isMissingTableError(result.error) || isMissingColumnError(result.error)) resumeTable.markUnavailable(result.error);
        logIfError("getProblemDetail.resumeSolution", result.error);
        return null;
      }
      return result.data ? toResumeDetail(result.data, figuresPersistEnabled) : null;
    } catch (error) {
      console.error("[problemRepository] getProblemDetail.resumeSolution 실패", error);
      return null;
    }
  }

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
        const textPayload = {
          problem_id: problemId,
          concept_md: solution.conceptMd,
          solution_md: solution.solutionMd,
          answer_md: solution.answerMd,
          concept_tags: solution.conceptTags,
          ai_provider: solution.aiProvider,
          ai_model: solution.aiModel,
        };
        if (!(await figureColumns.check())) {
          // 같은 problemId로 재호출(재풀이)돼도 덮어쓰도록 upsert한다 — 중복 행 방지.
          const { error } = await client.from("solutions").upsert(textPayload, { onConflict: "problem_id" });
          logIfError("saveSolution", error);
          return;
        }

        const runId = newRunId();
        const { error } = await client
          .from("solutions")
          .upsert({ ...textPayload, ...clearedFigureColumns(runId) }, { onConflict: "problem_id" });
        if (!error) {
          runIds.set(solution, runId);
          return;
        }
        if (isMissingColumnError(error)) {
          // 탐지 뒤 컬럼이 사라졌다(롤백 등) — 도형 키 없이 1회 다시 시도해 텍스트를 지킨다.
          figureColumns.markUnavailable(error);
          const retry = await client.from("solutions").upsert(textPayload, { onConflict: "problem_id" });
          logIfError("saveSolution(도형 키 없이 재시도)", retry.error);
          return;
        }
        logIfError("saveSolution", error);
      } catch (error) {
        console.error("[problemRepository] saveSolution 실패", error);
      }
    },

    async saveSolutionFigures({ problemId, solution, figures, stepFigureRefs }) {
      const runId = runIds.get(solution);
      if (runId === undefined || figures.length === 0 || !(await figureColumns.check())) return;
      await updateFigures("solutions", { problemId, runId, figures, stepFigureRefs }, (error) =>
        figureColumns.markUnavailable(error),
      );
    },

    async saveResumeSolution({ problemId, resumeSolution, aiProvider, aiModel, workContext }) {
      // CAS 검증을 통과한 결과만 저장한다 — 실패면 쓰기 0, 이전에 저장된 통과 행을 그대로 둔다.
      if (resumeSolution.verified !== true) return;
      try {
        if (!(await resumeTable.check())) return;
        const textPayload = {
          problem_id: problemId,
          mode: resumeSolution.mode,
          method_name: resumeSolution.methodName,
          solution_md: resumeSolution.solutionMd,
          answer_md: resumeSolution.answerMd,
          verified: true,
          ai_provider: aiProvider,
          ai_model: aiModel,
          updated_at: new Date(now()).toISOString(),
          ...workContextColumns(workContext),
        };
        const runId = figuresPersistEnabled ? newRunId() : null;
        const { error } = await client
          .from("resume_solutions")
          .upsert(runId ? { ...textPayload, ...clearedFigureColumns(runId) } : textPayload, { onConflict: "problem_id" });
        if (!error) {
          if (runId) runIds.set(resumeSolution, runId);
          return;
        }
        if (isMissingTableError(error)) {
          resumeTable.markUnavailable(error);
        } else if (runId && isMissingColumnError(error)) {
          const retry = await client.from("resume_solutions").upsert(textPayload, { onConflict: "problem_id" });
          logResumeWriteError("saveResumeSolution(도형 키 없이 재시도)", retry.error);
          return;
        }
        logResumeWriteError("saveResumeSolution", error);
      } catch (error) {
        console.error("[problemRepository] saveResumeSolution 실패", { name: error instanceof Error ? error.name : typeof error });
      }
    },

    async saveResumeFigures({ problemId, resumeSolution, figures, stepFigureRefs }) {
      const runId = runIds.get(resumeSolution);
      if (runId === undefined || figures.length === 0 || !(await resumeTable.check())) return;
      await updateFigures("resume_solutions", { problemId, runId, figures, stepFigureRefs }, (error) =>
        resumeTable.markUnavailable(error),
      );
    },

    figureColumnsAvailable: () => figureColumns.check(),
    resumeTableAvailable: () => resumeTable.check(),

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

      const selectSolution = (columns: string) =>
        client.from("solutions").select(columns).eq("problem_id", problemId).maybeSingle() as PromiseLike<{
          data: (SolutionDetailRow & SolutionFiguresRow) | null;
          error: unknown;
        }>;
      // 도형 컬럼은 탐지된 경우에만 select에 넣는다 — 모르는 컬럼이 select에 있으면 PostgREST가 조회 전체를 거부한다.
      let withFigures = await figureColumns.check();
      let solutionResult = await selectSolution(
        withFigures ? `${SOLUTION_DETAIL_COLUMNS}, ${FIGURE_COLUMNS}` : SOLUTION_DETAIL_COLUMNS,
      );
      if (withFigures && isMissingColumnError(solutionResult.error)) {
        figureColumns.markUnavailable(solutionResult.error);
        withFigures = false;
        solutionResult = await selectSolution(SOLUTION_DETAIL_COLUMNS);
      }
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
      // 이어풀기 결과는 별도 쿼리(best-effort) — 실패해도 상세 전체를 500으로 만들지 않고 키만 뺀다.
      const resumeSolution = (await resumeTable.check()) ? await readResumeDetail(problemId) : null;

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
              ...(withFigures ? restoreFigures(solution) : {}),
            }
          : null,
        chatMessages: (messagesResult.data ?? []).map((row) => ({
          role: row.role,
          content: row.content,
          createdAt: row.created_at,
        })),
        ...(resumeSolution ? { resumeSolution } : {}),
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
      defaultRepository = createProblemRepository(getSupabaseServerClient(), {
        figuresPersistEnabled: env.figuresPersistEnabled,
        resumePersistEnabled: env.resumePersistEnabled,
      });
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
  async saveSolutionFigures(input) {
    await getDefaultRepository()?.saveSolutionFigures(input);
  },
  async saveResumeSolution(input) {
    await getDefaultRepository()?.saveResumeSolution(input);
  },
  async saveResumeFigures(input) {
    await getDefaultRepository()?.saveResumeFigures(input);
  },
  async figureColumnsAvailable() {
    return (await getDefaultRepository()?.figureColumnsAvailable()) ?? false;
  },
  async resumeTableAvailable() {
    return (await getDefaultRepository()?.resumeTableAvailable()) ?? false;
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
