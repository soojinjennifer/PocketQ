/**
 * Stage 4 WU3 — 도형 보정(repair) 효과 측정(게이트 밖, 수동 실행). 승인 계획 `.omc/plans/figures-stage4.md` §7.4.
 *
 * 실행(apps/api 기준):
 * - 경로 확인(비용 0): `EVAL_DRY_RUN=1 pnpm exec tsx scripts/evalFigureRepair.ts` → `.omc/research/figures-stage4-repair.dryrun.json`
 * - 실제 호출(오너 승인 최대 4회): `pnpm exec tsx scripts/evalFigureRepair.ts` → `.omc/research/figures-stage4-repair.json`
 *
 * 규칙:
 * - `apps/api/.env`의 `OPENAI_API_KEY`·`AI_MODEL`을 직접 읽는다. **키 값은 어디에도 출력·기록하지 않는다.**
 * - 호출 카운터를 두고 4회에서 하드 정지한다(5번째 호출은 어댑터에 닿기 전에 throw).
 * - 입력은 코드에 고정한 "일부러 망가뜨린" fixture 4건이고, 사례마다 `adapter.repairFigure`를 정확히 1회 호출한다.
 * - 성공 = `validateFigureCandidate` 통과 + figureId 동일 + 핵심 좌표가 기대값(손 계산, fixture `expected`)과 1e-6 이내
 *   + 원본 의미 보존(요소 ID 집합 동일, 새 given 제약 없음).
 * - 표본 4건이다. 4/4여도 "효과 일부 확인"일 뿐 보정 성공률을 일반화하지 않는다. 단가는 확인되지 않으면 비용을 계산하지 않는다.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { FigureSpec, Grade } from "shared-types";
import { resolveFigure, splitSolutionSteps, validateFigureCandidate, type FigureCandidateError } from "validation";
import { F01_TRIANGLE_ANGLE, F02_FOOT_OF_PERPENDICULAR, F09_STEPWISE_AUXILIARY } from "validation/fixtures";
import type { FigureCallResult, LLMAdapter, RepairFigureRequest } from "../src/infrastructure/ai/adapter";
import { FakeLLMAdapter } from "../src/infrastructure/ai/fake-adapter";
import { OpenAIAdapter } from "../src/infrastructure/ai/openai-adapter";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", "..", "..");

/** 오너 승인 상한(계획 O-2). */
export const MAX_REPAIR_CALLS = 4;

function readEnvValue(name: string): string {
  const text = readFileSync(join(HERE, "..", ".env"), "utf8");
  const line = text.split("\n").find((entry) => entry.startsWith(`${name}=`));
  return line ? line.slice(name.length + 1).trim() : "";
}

type Json = Record<string, unknown>;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function elementsOf(raw: Json): Json[] {
  return raw["elements"] as Json[];
}

function elementById(raw: Json, id: string): Json {
  const element = elementsOf(raw).find((e) => e["id"] === id);
  if (!element) throw new Error(`fixture element ${id} 없음`);
  return element;
}

interface RepairCase {
  id: string;
  /** 기반 fixture와 일부러 넣은 오류. */
  basis: string;
  intendedCode: string;
  grade: Grade;
  problemText: string;
  solutionMd: string;
  answerMd: string;
  broken: Json;
  /** 손 계산 기대 좌표(fixture `expected` 또는 주어진 점). */
  expectedPoints: { id: string; x: number; y: number }[];
}

/** 케이스 1: F02 boundingBox top/bottom 뒤집기 → zod(refine) 거부. */
function caseBboxFlip(): RepairCase {
  const broken = clone(F02_FOOT_OF_PERPENDICULAR.raw) as Json;
  const [left, top, right, bottom] = broken["boundingBox"] as number[];
  broken["boundingBox"] = [left, bottom, right, top];
  return {
    id: "C1-F02-bbox-flipped",
    basis: "F02 수선의 발, boundingBox [left, top, right, bottom]의 top·bottom을 뒤집음",
    intendedCode: "zod(boundingBox 순서)",
    grade: "M2",
    problemText: "좌표평면 위의 세 점 A(0, 0), B(6, 0), C(2, 4)를 꼭짓점으로 하는 삼각형 ABC에서 꼭짓점 C에서 변 AB에 내린 수선의 발 H의 좌표를 구하시오.",
    solutionMd: "**1단계** 변 AB는 x축 위의 선분입니다.\n**2단계** C(2, 4)에서 x축에 내린 수선의 발은 H(2, 0)입니다.",
    answerMd: "H(2, 0)",
    broken,
    expectedPoints: [{ id: "H", x: 2, y: 0 }],
  };
}

/** 케이스 2: F09 M·segAM `appearAt: "s5"`(steps도 s5) + 풀이 단계 3 → step_out_of_range. interaction은 fixed(D-3). */
function caseStepOutOfRange(): RepairCase {
  const broken = clone(F09_STEPWISE_AUXILIARY.raw) as Json;
  broken["interaction"] = { mode: "fixed" };
  elementById(broken, "M")["appearAt"] = "s5";
  elementById(broken, "segAM")["appearAt"] = "s5";
  const steps = broken["steps"] as Json[];
  const last = steps[steps.length - 1];
  if (last) last["stepId"] = "s5";
  return {
    id: "C2-F09-step-out-of-range",
    basis: "F09 단계별 보조선, M·segAM의 appearAt과 마지막 step을 s5로(풀이는 3단계), interaction fixed",
    intendedCode: "step_out_of_range",
    grade: "M2",
    problemText: "세 점 A(0, 3), B(-2, 0), C(4, 0)을 꼭짓점으로 하는 삼각형 ABC에서 꼭짓점 A에서 변 BC에 내린 수선의 발 H와 변 BC의 중점 M의 좌표를 각각 구하시오.",
    solutionMd:
      "**1단계** 삼각형 ABC를 그립니다.\n**2단계** 변 BC는 x축 위에 있으므로 A(0, 3)에서 내린 수선의 발은 H(0, 0)입니다.\n**3단계** 변 BC의 중점은 M((−2+4)/2, 0) = M(1, 0)입니다.",
    answerMd: "H(0, 0), M(1, 0)",
    broken,
    expectedPoints: F09_STEPWISE_AUXILIARY.expected?.points ?? [],
  };
}

/**
 * 케이스 3: 수선의 발 `foot.to`가 점 → type_mismatch.
 * 계획 §7.4는 "F03 foot.to"라고 적었지만 F03(중점과 중선)에는 foot 요소가 없어, foot이 있는 F02로 만들었다(기록).
 */
function caseFootToPoint(): RepairCase {
  const broken = clone(F02_FOOT_OF_PERPENDICULAR.raw) as Json;
  elementById(broken, "H")["to"] = "B";
  return {
    id: "C3-F02-foot-to-point",
    basis: "F02 수선의 발, H(foot)의 to를 선분 segAB 대신 점 B로(계획의 F03에는 foot이 없어 F02 사용)",
    intendedCode: "type_mismatch",
    grade: "M2",
    problemText: "좌표평면 위의 세 점 A(0, 0), B(6, 0), C(2, 4)를 꼭짓점으로 하는 삼각형 ABC에서 꼭짓점 C에서 변 AB에 내린 수선의 발 H의 좌표를 구하시오.",
    solutionMd: "**1단계** 변 AB는 x축 위의 선분입니다.\n**2단계** C(2, 4)에서 x축에 내린 수선의 발은 H(2, 0)입니다.",
    answerMd: "H(2, 0)",
    broken,
    expectedPoints: [{ id: "H", x: 2, y: 0 }],
  };
}

/** 케이스 4: F01 angleMeasure 제약을 지우고 `showMeasure: true`만 남김 → measure_without_constraint. */
function caseMeasureWithoutConstraint(): RepairCase {
  const broken = clone(F01_TRIANGLE_ANGLE.raw) as Json;
  broken["constraints"] = [];
  return {
    id: "C4-F01-measure-without-constraint",
    basis: "F01 삼각형과 각, angleMeasure 제약을 지우고 angA의 showMeasure true 유지",
    intendedCode: "measure_without_constraint",
    grade: "M2",
    problemText: "좌표평면 위의 세 점 A(0, 0), B(4, 0), C(2, 2)를 꼭짓점으로 하는 삼각형 ABC에서 ∠BAC의 크기를 구하시오.",
    solutionMd: "**1단계** 삼각형 ABC를 그립니다.\n**2단계** 벡터 AB=(4,0), AC=(2,2)의 사잇각은 cos∠BAC = 8/(4·2√2) = 1/√2이므로 45°입니다.",
    answerMd: "45°",
    broken,
    // 각 크기 45°는 주어진 세 점 좌표로 정해진다 — 세 점이 그대로여야 한다.
    expectedPoints: [
      { id: "A", x: 0, y: 0 },
      { id: "B", x: 4, y: 0 },
      { id: "C", x: 2, y: 2 },
    ],
  };
}

export const REPAIR_CASES: readonly (() => RepairCase)[] = [caseBboxFlip, caseStepOutOfRange, caseFootToPoint, caseMeasureWithoutConstraint];

function codes(errors: readonly FigureCandidateError[]): string[] {
  return errors.map((e) => `${e.code}@${e.path.join(".")}`);
}

function elementIdSet(raw: unknown): string[] {
  if (typeof raw !== "object" || raw === null) return [];
  const elements = (raw as Json)["elements"];
  if (!Array.isArray(elements)) return [];
  return elements
    .map((e) => (typeof e === "object" && e !== null ? (e as Json)["id"] : undefined))
    .filter((id): id is string => typeof id === "string")
    .sort();
}

function givenConstraintKeys(raw: unknown): string[] {
  if (typeof raw !== "object" || raw === null) return [];
  const constraints = (raw as Json)["constraints"];
  if (!Array.isArray(constraints)) return [];
  return constraints
    .filter((c): c is Json => typeof c === "object" && c !== null && (c as Json)["source"] === "given")
    .map((c) => JSON.stringify(c, Object.keys(c).sort()))
    .sort();
}

function pointHits(figure: FigureSpec, expected: readonly { id: string; x: number; y: number }[]): { id: string; hit: boolean; actual: { x: number; y: number } | null }[] {
  const resolved = resolveFigure(figure);
  return expected.map((point) => {
    const element = resolved?.elements.get(point.id);
    const actual = element && element.kind === "point" ? element.xy : null;
    return { id: point.id, hit: actual !== null && Math.abs(actual.x - point.x) <= 1e-6 && Math.abs(actual.y - point.y) <= 1e-6, actual };
  });
}

/** 호출 카운터 — `MAX_REPAIR_CALLS`를 넘으면 어댑터에 닿기 전에 throw(하드 정지). */
export function withCallLimit(adapter: Pick<LLMAdapter, "repairFigure">, limit: number): { repairFigure: (req: RepairFigureRequest) => Promise<FigureCallResult>; calls: () => number } {
  let calls = 0;
  return {
    repairFigure: (req) => {
      if (calls >= limit) throw new Error(`호출 상한 ${limit}회 도달 — 하드 정지`);
      calls += 1;
      return adapter.repairFigure(req);
    },
    calls: () => calls,
  };
}

interface CaseResult {
  id: string;
  basis: string;
  intendedCode: string;
  stepCount: number | null;
  beforeCodes: string[];
  called: boolean;
  latencyMs: number | null;
  tokens: { input: number; output: number } | null;
  callError: string | null;
  returnedNull: boolean;
  afterCodes: string[];
  checks: {
    validates: boolean;
    sameFigureId: boolean;
    keyPoints: { id: string; hit: boolean; actual: { x: number; y: number } | null }[];
    sameElementIds: boolean;
    noNewGivenConstraints: boolean;
  } | null;
  success: boolean;
  repairedFigure: unknown;
}

/** 오류 문구에서 키(값 자체와 `sk-…` 형태)를 지운다 — 공급자 오류 메시지가 키 일부를 되돌려 주는 경우 대비. */
export function redactSecrets(text: string, secret: string): string {
  const withoutSecret = secret ? text.split(secret).join("[redacted]") : text;
  return withoutSecret.replace(/sk-[A-Za-z0-9_*.-]+/g, "[redacted]");
}

async function runCase(limited: ReturnType<typeof withCallLimit>, testCase: RepairCase, secret: string): Promise<CaseResult> {
  const split = splitSolutionSteps(testCase.solutionMd);
  const stepCount = split.ok ? split.stepCount : null;
  const before = validateFigureCandidate(testCase.broken, { stepCount });
  const result: CaseResult = {
    id: testCase.id,
    basis: testCase.basis,
    intendedCode: testCase.intendedCode,
    stepCount,
    beforeCodes: before.ok ? [] : codes(before.errors),
    called: false,
    latencyMs: null,
    tokens: null,
    callError: null,
    returnedNull: false,
    afterCodes: [],
    checks: null,
    success: false,
    repairedFigure: null,
  };
  if (before.ok) {
    result.callError = "입력이 이미 통과함(망가뜨리기 실패) — 호출하지 않음";
    return result;
  }

  const startedAt = Date.now();
  let repaired: FigureCallResult;
  try {
    result.called = true;
    repaired = await limited.repairFigure({
      source: "solve",
      mode: null,
      grade: testCase.grade,
      problemText: testCase.problemText,
      priorWork: null,
      solutionMd: testCase.solutionMd,
      answerMd: testCase.answerMd,
      stepCount,
      signal: new AbortController().signal,
      figure: testCase.broken,
      errors: before.errors,
    });
  } catch (error) {
    result.latencyMs = Date.now() - startedAt;
    result.callError = error instanceof Error ? redactSecrets(`${error.name}: ${error.message}`, secret).slice(0, 200) : "unknown";
    return result;
  }
  result.latencyMs = Date.now() - startedAt;
  result.tokens = repaired.usage ? { input: repaired.usage.inputTokens, output: repaired.usage.outputTokens } : null;

  const raw = repaired.raw;
  const figure = typeof raw === "object" && raw !== null ? (raw as Json)["figure"] : undefined;
  result.repairedFigure = figure ?? null;
  if (figure === null || figure === undefined) {
    result.returnedNull = true;
    return result;
  }
  const after = validateFigureCandidate(figure, { stepCount });
  result.afterCodes = after.ok ? [] : codes(after.errors);
  const brokenId = (testCase.broken["figureId"] as string | undefined) ?? null;
  const keyPoints = after.ok ? pointHits(after.figure, testCase.expectedPoints) : testCase.expectedPoints.map((p) => ({ id: p.id, hit: false, actual: null }));
  const beforeGiven = new Set(givenConstraintKeys(testCase.broken));
  result.checks = {
    validates: after.ok,
    sameFigureId: after.ok && after.figure.figureId === brokenId,
    keyPoints,
    sameElementIds: JSON.stringify(elementIdSet(figure)) === JSON.stringify(elementIdSet(testCase.broken)),
    noNewGivenConstraints: givenConstraintKeys(figure).every((key) => beforeGiven.has(key)),
  };
  result.success =
    result.checks.validates &&
    result.checks.sameFigureId &&
    keyPoints.every((p) => p.hit) &&
    result.checks.sameElementIds &&
    result.checks.noNewGivenConstraints;
  return result;
}

async function main(): Promise<void> {
  const dryRun = process.env["EVAL_DRY_RUN"] === "1";
  const outDir = join(REPO_ROOT, ".omc", "research");
  const outFile = join(outDir, dryRun ? "figures-stage4-repair.dryrun.json" : "figures-stage4-repair.json");
  const apiKey = dryRun ? "" : readEnvValue("OPENAI_API_KEY");
  const model = dryRun ? "fake-whymath-v0" : readEnvValue("AI_MODEL");
  mkdirSync(outDir, { recursive: true });
  if (!dryRun && (!apiKey || !model)) {
    const blocked = { status: "BLOCKED", reason: "OPENAI_API_KEY 또는 AI_MODEL 없음", calls: 0 };
    writeFileSync(outFile, `${JSON.stringify(blocked, null, 2)}\n`);
    console.log(JSON.stringify(blocked));
    return;
  }
  const adapter: LLMAdapter = dryRun ? new FakeLLMAdapter("openai", model) : new OpenAIAdapter(model, apiKey);
  const limited = withCallLimit(adapter, MAX_REPAIR_CALLS);
  const startedAt = new Date().toISOString();
  const results: CaseResult[] = [];
  for (const build of REPAIR_CASES) {
    const r = await runCase(limited, build(), apiKey);
    results.push(r);
    console.log(
      `${r.id}: before=${r.beforeCodes.join(",")} success=${r.success} after=${r.afterCodes.join(",") || "-"} latencyMs=${r.latencyMs ?? "-"} tokens=${r.tokens ? `${r.tokens.input}/${r.tokens.output}` : "-"}${r.callError ? ` error=${r.callError}` : ""}`,
    );
  }
  const output = {
    model,
    dryRun,
    startedAt,
    finishedAt: new Date().toISOString(),
    callLimit: MAX_REPAIR_CALLS,
    calls: limited.calls(),
    note: "Stage 4 보정 효과 측정(계획 §7.4). 표본 4건 — 4/4여도 '효과 일부 확인'. 키 값은 기록하지 않는다. 기대 좌표는 fixture 손 계산값. 단가 미확인이면 비용 미계산.",
    summary: {
      success: results.filter((r) => r.success).length,
      of: results.length,
      tokens: {
        input: results.reduce((acc, r) => acc + (r.tokens?.input ?? 0), 0),
        output: results.reduce((acc, r) => acc + (r.tokens?.output ?? 0), 0),
      },
      latencyMs: results.map((r) => r.latencyMs),
      cost: "미계산(공식 단가 미확인)",
    },
    results,
  };
  writeFileSync(outFile, `${JSON.stringify(output, null, 2)}\n`);
  console.log(JSON.stringify({ outFile, summary: output.summary, calls: output.calls }, null, 2));
}

// 직접 실행할 때만 측정한다(테스트·다른 스크립트에서 import할 때 호출 0).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
