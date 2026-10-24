/**
 * 풀이 도형 생성 오케스트레이터(Stage 3) — `docs/FIGURE_SPEC.md` §16, 승인 계획 §4·§6.
 *
 * 흐름: 단계 분할 → 생성 1회 → 후보별 검증 → 실패한 도형만 병렬 보정(도형당 최대 1회) → 단계 연결 정합.
 *
 * 규칙:
 * - **절대 throw하지 않는다.** 실패는 모두 "도형 없음"으로 끝난다(텍스트 풀이를 막지 않는다).
 * - 클라이언트에 줄 수 있는 것은 서버 검증(zod 출력 + 의미 검증 + 단계 범위 + 수치 표시 근거)을
 *   통과한 도형뿐이다. AI 원본 객체를 그대로 넘기지 않는다.
 * - 최상위 구조가 깨지면(비객체·`figures` 비배열) 보정 없이 전부 버린다(전체 재생성 금지).
 * - 로그에는 문제·풀이·도형 내용 없이 개수·코드·시간만 남긴다.
 */
import type { FigureSpec, Grade, ResumeMode, StepFigureRef } from "shared-types";
import {
  MAX_FIGURES,
  MAX_STEP_FIGURE_REFS,
  parseSolutionFigures,
  readCandidateFigureId,
  splitSolutionSteps,
  stepFigureRefSchema,
  stepNumber,
  validateFigureCandidate,
  type FigureCandidateError,
} from "validation";
import { isTestEnv } from "../../config/env";
import type { FigureCallUsage, FigurePriorWork, LLMAdapter } from "../../infrastructure/ai/adapter";
import { MAX_REPAIR_FIGURE_JSON_LENGTH } from "../../infrastructure/ai/prompts/figures";

/**
 * 도형 단계 전체 상한(생성 + 보정). **결정 필요(임시값)** — 호출별 타임아웃 30초(기존 상수) 두 번을 넘지 않게
 * 60초. 평가 p95 후 확정한다(D10).
 */
export const FIGURES_TOTAL_BUDGET_MS = 60_000;

export type FigureGenerationOutcome =
  | "accepted"
  | "none"
  | "all_rejected"
  | "generate_failed"
  | "malformed"
  | "aborted"
  | "unexpected_error";

export interface FigureGenerationMetrics {
  source: "solve" | "resume";
  outcome: FigureGenerationOutcome;
  /** 단계 분할 성공 시 단계 수, 실패면 null. */
  stepCount: number | null;
  stepSplitFailure: string | null;
  /** AI가 준 omitReason(평가용, 클라이언트 미전송). 형식이 맞을 때만. */
  omitReason: string | null;
  candidates: number;
  firstPassAccepted: number;
  repairAttempted: number;
  repairSucceeded: number;
  accepted: number;
  /** 최종 거부(또는 보정 전 1차 실패) 코드별 건수. 1차 실패 코드는 `firstPassCodes`. */
  firstPassCodes: Record<string, number>;
  finalRejectCodes: Record<string, number>;
  refsReceived: number;
  refsKept: number;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
}

export interface GenerateSolutionFiguresInput {
  adapter: Pick<LLMAdapter, "generateFigures" | "repairFigure">;
  source: "solve" | "resume";
  mode: ResumeMode | null;
  grade: Grade;
  problemText: string;
  priorWork: FigurePriorWork | null;
  /** 단계 표지가 있는 풀이 섹션 본문(최초 풀이 `## 풀이`, 이어풀기 `## 이어풀기`). */
  solutionMd: string | null;
  answerMd: string;
  /** 클라이언트 연결 끊김 시 취소. */
  signal: AbortSignal;
  /** 전체 상한(ms). 기본 `FIGURES_TOTAL_BUDGET_MS`. */
  totalBudgetMs?: number;
  /** 구조화 로그 출력(내용 없음). 기본: 테스트 환경이면 출력하지 않고, 그 밖에는 console.info. */
  log?: (entry: FigureGenerationMetrics) => void;
}

export interface SolutionFiguresResult {
  figures: FigureSpec[];
  stepFigureRefs: StepFigureRef[];
  metrics: FigureGenerationMetrics;
}

const OMIT_REASONS: readonly string[] = ["not_helpful", "unsupported", "insufficient_info"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function defaultLog(entry: FigureGenerationMetrics): void {
  if (isTestEnv) return;
  console.info(JSON.stringify({ event: "solution_figures", ...entry }));
}

function countCodes(target: Record<string, number>, errors: readonly FigureCandidateError[]): void {
  for (const error of errors) target[error.code] = (target[error.code] ?? 0) + 1;
}

function addUsage(metrics: FigureGenerationMetrics, usage: FigureCallUsage | null): void {
  if (!usage) return;
  metrics.inputTokens += usage.inputTokens;
  metrics.outputTokens += usage.outputTokens;
}

/** 부모 signal과 전체 상한을 묶은 AbortSignal. `dispose`로 타이머·리스너를 정리한다. */
function linkedSignal(parent: AbortSignal, budgetMs: number): { signal: AbortSignal; dispose: () => void } {
  const controller = new AbortController();
  const onAbort = (): void => controller.abort();
  if (parent.aborted) controller.abort();
  else parent.addEventListener("abort", onAbort, { once: true });
  const timer = setTimeout(() => controller.abort(), budgetMs);
  return {
    signal: controller.signal,
    dispose: () => {
      clearTimeout(timer);
      parent.removeEventListener("abort", onAbort);
    },
  };
}

interface FailedCandidate {
  index: number;
  figureId: string;
  candidate: unknown;
  errors: FigureCandidateError[];
}

/**
 * 풀이 도형을 생성·검증·보정한다. 절대 throw하지 않는다.
 */
export async function generateSolutionFigures(input: GenerateSolutionFiguresInput): Promise<SolutionFiguresResult> {
  const startedAt = Date.now();
  const metrics: FigureGenerationMetrics = {
    source: input.source,
    outcome: "none",
    stepCount: null,
    stepSplitFailure: null,
    omitReason: null,
    candidates: 0,
    firstPassAccepted: 0,
    repairAttempted: 0,
    repairSucceeded: 0,
    accepted: 0,
    firstPassCodes: {},
    finalRejectCodes: {},
    refsReceived: 0,
    refsKept: 0,
    calls: 0,
    inputTokens: 0,
    outputTokens: 0,
    durationMs: 0,
  };
  const empty = (outcome: FigureGenerationOutcome): SolutionFiguresResult => {
    metrics.outcome = outcome;
    return { figures: [], stepFigureRefs: [], metrics };
  };
  const linked = linkedSignal(input.signal, input.totalBudgetMs ?? FIGURES_TOTAL_BUDGET_MS);
  let result: SolutionFiguresResult;

  try {
    result = await run(input, metrics, linked.signal, empty);
  } catch {
    result = empty(linked.signal.aborted ? "aborted" : "unexpected_error");
  } finally {
    linked.dispose();
  }

  metrics.durationMs = Date.now() - startedAt;
  try {
    (input.log ?? defaultLog)(metrics);
  } catch {
    // 로그 실패는 무시한다.
  }
  return result;
}

async function run(
  input: GenerateSolutionFiguresInput,
  metrics: FigureGenerationMetrics,
  signal: AbortSignal,
  empty: (outcome: FigureGenerationOutcome) => SolutionFiguresResult,
): Promise<SolutionFiguresResult> {
  const split = splitSolutionSteps(input.solutionMd);
  const stepCount = split.ok ? split.stepCount : null;
  metrics.stepCount = stepCount;
  metrics.stepSplitFailure = split.ok ? null : split.reason;

  const context = {
    source: input.source,
    mode: input.mode,
    grade: input.grade,
    problemText: input.problemText,
    priorWork: input.priorWork,
    solutionMd: input.solutionMd,
    answerMd: input.answerMd,
    stepCount,
    signal,
  };

  // 1) 생성 — 정확히 1회.
  let envelope: unknown;
  try {
    metrics.calls += 1;
    const generated = await input.adapter.generateFigures(context);
    addUsage(metrics, generated.usage);
    envelope = generated.raw;
  } catch {
    return empty(signal.aborted ? "aborted" : "generate_failed");
  }
  if (signal.aborted) return empty("aborted");

  // 2) 최상위 구조 — 깨지면 보정 없이 전부 버린다.
  if (!isRecord(envelope) || !Array.isArray(envelope["figures"])) return empty("malformed");
  const omitReason = envelope["omitReason"];
  metrics.omitReason = typeof omitReason === "string" && OMIT_REASONS.includes(omitReason) ? omitReason : null;
  const candidates: unknown[] = envelope["figures"].slice(0, MAX_FIGURES);
  metrics.candidates = candidates.length;
  if (candidates.length === 0) return empty("none");

  // 3) 후보별 검증.
  const accepted = new Map<number, FigureSpec>();
  const acceptedIds = new Set<string>();
  const failed: FailedCandidate[] = [];
  candidates.forEach((candidate, index) => {
    const verdict = validateFigureCandidate(candidate, { stepCount });
    if (verdict.ok) {
      if (acceptedIds.has(verdict.figure.figureId)) {
        countCodes(metrics.firstPassCodes, [{ code: "duplicate_reference", path: ["figureId"] }]);
        countCodes(metrics.finalRejectCodes, [{ code: "duplicate_reference", path: ["figureId"] }]);
        return;
      }
      acceptedIds.add(verdict.figure.figureId);
      accepted.set(index, verdict.figure);
      metrics.firstPassAccepted += 1;
      return;
    }
    countCodes(metrics.firstPassCodes, verdict.errors);
    const figureId = verdict.figureId ?? readCandidateFigureId(candidate);
    let serializedLength = Number.POSITIVE_INFINITY;
    try {
      serializedLength = JSON.stringify(candidate).length;
    } catch {
      // 직렬화할 수 없으면 보정하지 않는다.
    }
    if (figureId === undefined || serializedLength > MAX_REPAIR_FIGURE_JSON_LENGTH) {
      // figureId를 알 수 없으면 "같은 도형을 고쳤는지" 확인할 수 없고, 너무 큰 도형은 다시 보내지 않는다.
      countCodes(metrics.finalRejectCodes, verdict.errors);
      return;
    }
    failed.push({ index, figureId, candidate, errors: verdict.errors });
  });

  // 4) 실패한 도형만 병렬 보정 — 도형당 최대 1회.
  if (failed.length > 0 && !signal.aborted) {
    const repairs = await Promise.all(
      failed.map(async (item) => {
        metrics.repairAttempted += 1;
        metrics.calls += 1;
        try {
          const repaired = await input.adapter.repairFigure({ ...context, figure: item.candidate, errors: item.errors });
          addUsage(metrics, repaired.usage);
          const raw = repaired.raw;
          if (!isRecord(raw) || raw["figure"] === null || raw["figure"] === undefined) return { item, figure: null, errors: item.errors };
          const verdict = validateFigureCandidate(raw["figure"], { stepCount });
          if (!verdict.ok) return { item, figure: null, errors: verdict.errors };
          if (verdict.figure.figureId !== item.figureId) {
            return { item, figure: null, errors: [{ code: "invalid" as const, path: ["figureId"] }] };
          }
          return { item, figure: verdict.figure, errors: [] };
        } catch {
          return { item, figure: null, errors: item.errors };
        }
      }),
    );
    if (signal.aborted) return empty("aborted");
    for (const repair of repairs) {
      if (repair.figure && !acceptedIds.has(repair.figure.figureId)) {
        acceptedIds.add(repair.figure.figureId);
        accepted.set(repair.item.index, repair.figure);
        metrics.repairSucceeded += 1;
      } else {
        countCodes(
          metrics.finalRejectCodes,
          repair.figure ? [{ code: "duplicate_reference", path: ["figureId"] }] : repair.errors,
        );
      }
    }
  }
  if (signal.aborted) return empty("aborted");

  // 원래 순서를 유지한다.
  const ordered = [...accepted.entries()].sort((a, b) => a[0] - b[0]).map(([, figure]) => figure);

  // 5) 단계 연결 — 받아들인 도형·단계 범위 안만, 분할 실패면 [].
  const refs: StepFigureRef[] = [];
  const rawRefs = envelope["stepFigureRefs"];
  if (Array.isArray(rawRefs)) metrics.refsReceived = rawRefs.length;
  if (stepCount !== null && Array.isArray(rawRefs)) {
    const seen = new Set<string>();
    for (const candidate of rawRefs) {
      if (refs.length >= MAX_STEP_FIGURE_REFS) break;
      const parsed = stepFigureRefSchema.safeParse(candidate);
      if (!parsed.success || !acceptedIds.has(parsed.data.figureId)) continue;
      const n = stepNumber(parsed.data.stepId);
      if (n === null || n > stepCount) continue;
      const key = `${parsed.data.stepId}|${parsed.data.figureId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      refs.push(parsed.data);
    }
  }

  // 6) 최종 안전망 — 클라이언트·저장 경로와 같은 관대 파서로 한 번 더 통과시킨다(재파싱 결과가 같아야 한다).
  const final = parseSolutionFigures({ figures: ordered, stepFigureRefs: refs });
  if (final.rejected.length > 0) {
    metrics.finalRejectCodes["final_reparse_rejected"] = (metrics.finalRejectCodes["final_reparse_rejected"] ?? 0) + final.rejected.length;
  }
  metrics.accepted = final.figures.length;
  metrics.refsKept = final.stepFigureRefs.length;
  metrics.outcome = final.figures.length > 0 ? "accepted" : "all_rejected";
  return { figures: final.figures, stepFigureRefs: final.stepFigureRefs, metrics };
}
