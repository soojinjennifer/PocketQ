import type {
  AiProvider,
  ConceptExplanation,
  Diagnosis,
  Grade,
  RecognizedProblem,
  ResumeStreamEvent,
  ResumeSolution,
  Solution,
  WorkLine,
} from "shared-types";
import type {
  ChatRequest,
  DiagnoseRequest,
  FigureCallResult,
  GenerateFiguresRequest,
  LLMAdapter,
  RepairFigureRequest,
  ResumeRequest,
  SolveRequest,
  SolveStreamEvent,
  SuggestQuestionsRequest,
} from "./adapter";
import { parseResumeOutput } from "./parseResumeOutput";
import { parseSolveOutput } from "./parseSolveOutput";

const FAKE_RECOGNIZED_TEXT = "이차함수 y = x^2 - 4x + 3의 최솟값을 구하시오.";
const FAKE_RECOGNIZED_LATEX = "y = x^{2} - 4x + 3";

/** `diagnose`가 결정론적으로 채우는 고정된 식별 해법(실제 `method_catalog` 테이블이 없어 하드코딩). */
const FAKE_IDENTIFIED_METHOD = { methodId: "perfect-square", methodName: "완전제곱식" };

/**
 * `diagnose`가 결정론적으로 채우는 고정된 정답 LaTeX(RESUME-5 CAS 최종 답 검증 기준값).
 * `FAKE_RECOGNIZED_TEXT`(이차함수 y = x^2 - 4x + 3의 최솟값을 구하시오)의 실제 정답인 -1을 담는다.
 */
const FAKE_PROBLEM_ANSWER_LATEX = "-1";

/** `recognizeWork`가 이미지 내용과 무관하게 항상 반환하는 고정된 학생 풀이 줄들. */
const FAKE_WORK_LINES: WorkLine[] = [
  { lineNo: 1, latex: "y = x^{2} - 4x + 3", isLowConfidence: false },
  { lineNo: 2, latex: "y = (x - 2)^{2} - 1", isLowConfidence: false },
  { lineNo: 3, latex: "\\text{최솟값은 } -1", isLowConfidence: false },
];

/**
 * `generateFigures`/`repairFigure`의 결정적 시나리오(Stage 3 테스트·로컬 개발용).
 * - `valid`: F07(y = x² − 4x + 3, 단계 s1~s3) 도형 1개 + 단계 연결 3개
 * - `none`: 도형 없음(`omitReason: "not_helpful"`)
 * - `invalid-then-repaired`: F07 + 잘못된 참조가 있는 도형 1개, 보정하면 통과
 * - `invalid-twice`: 위와 같지만 보정도 같은 잘못을 되풀이
 * - `throw`: 생성 호출이 실패
 * - `malformed`: 최상위 구조가 깨짐(`figures`가 배열이 아님)
 * - `hang`: 응답하지 않다가 `signal`이 취소되면 실패
 */
export type FakeFigureScenario =
  | "valid"
  | "none"
  | "invalid-then-repaired"
  | "invalid-twice"
  | "throw"
  | "malformed"
  | "hang";

export interface FakeLLMAdapterOptions {
  figureScenario?: FakeFigureScenario;
}

/** 잘못된 참조(그래프 id 오타)가 있는 F07 변형 — 보정 대상. */
const FAKE_BROKEN_FIGURE_ID = "fig-bad";

/**
 * 테스트 전용 fixture(`validation/fixtures`)를 도형 시나리오가 실제로 쓰일 때만 불러온다(Stage 4 L-5).
 * 운영 `resolveAdapter`는 `AI_PROVIDER`가 없을 때 이 클래스를 정적 import하므로, 정적 import면 운영 기동에
 * fixture 모듈이 로드된다. 도형 호출(`FIGURES_ENABLED` on + Fake)에서만 로드된다.
 */
async function fakeFigure(figureId: string, broken: boolean): Promise<unknown> {
  const { F07_QUADRATIC } = await import("validation/fixtures");
  const figure = JSON.parse(JSON.stringify(F07_QUADRATIC.raw)) as {
    figureId: string;
    elements: Record<string, unknown>[];
  };
  figure.figureId = figureId;
  if (broken) {
    const vertex = figure.elements[1];
    if (vertex) vertex["graph"] = "missing";
  }
  return figure;
}

function fakeRefs(figureIds: readonly string[]): { stepId: string; figureId: string }[] {
  return figureIds.flatMap((figureId) => ["s1", "s2", "s3"].map((stepId) => ({ stepId, figureId })));
}

function abortError(): Error {
  const error = new Error("Request was aborted.");
  error.name = "AbortError";
  return error;
}

/** `signal`이 취소될 때까지 응답하지 않는다(`hang` 시나리오). */
function waitForAbort(signal: AbortSignal): Promise<never> {
  return new Promise((_resolve, reject) => {
    if (signal.aborted) {
      reject(abortError());
      return;
    }
    signal.addEventListener("abort", () => reject(abortError()), { once: true });
  });
}

/**
 * 실제 Vision/LLM 호출 없이 고정된 가짜 결과를 반환하는 어댑터.
 * recognizeProblem은 전달받은 이미지의 실제 내용을 전혀 들여다보지 않고,
 * 항상 동일한 그럴듯한 더미 문제 텍스트를 즉시 반환한다.
 */
export class FakeLLMAdapter implements LLMAdapter {
  private readonly figureScenario: FakeFigureScenario;

  constructor(
    private readonly provider: AiProvider = "claude",
    private readonly model: string = "fake-whymath-v0",
    options: FakeLLMAdapterOptions = {},
  ) {
    this.figureScenario = options.figureScenario ?? "valid";
  }

  recognizeProblem(_image: Buffer, _grade: Grade): Promise<RecognizedProblem> {
    return Promise.resolve({
      recognizedText: FAKE_RECOGNIZED_TEXT,
      recognizedLatex: FAKE_RECOGNIZED_LATEX,
    });
  }

  async *solve(req: SolveRequest): AsyncIterable<SolveStreamEvent> {
    // 실제 스트리밍 어댑터처럼 최소 한 번은 비동기 지점을 거치게 한다(마이크로태스크 양보).
    await Promise.resolve();

    if (req.stepMarkers === true) {
      yield* this.solveWithStepMarkers(req);
      return;
    }

    for (const delta of this.buildChunks(req)) {
      yield { delta };
    }

    const result: Solution = {
      conceptMd: req.options.concept
        ? "## 개념 설명\n이차함수의 최솟값은 꼭짓점의 y좌표입니다."
        : null,
      solutionMd: req.options.solution
        ? "## 풀이\n1. 완전제곱식으로 변형합니다.\n2. 꼭짓점의 좌표를 구합니다."
        : null,
      answerMd: "최솟값은 -1입니다.",
      conceptTags: ["이차함수 > 최대·최소"],
      aiProvider: this.provider,
      aiModel: this.model,
    };

    yield { done: true, result };
  }

  /** 실제 Vision/LLM 호출 없이, 질문 내용을 그대로 되짚어주는 결정적인 가짜 답변을 반환한다. */
  chat(req: ChatRequest): Promise<string> {
    return Promise.resolve(
      `## 답변\n"${req.question}"에 대한 답입니다.\n\n관련 개념: ${req.problem.recognizedText}\n최초 풀이의 답: ${req.solution.answerMd}`,
    );
  }

  /** 문제 내용과 무관하게 항상 같은 결정적인 더미 질문 2개를 반환한다. */
  suggestQuestions(_req: SuggestQuestionsRequest): Promise<string[]> {
    return Promise.resolve(["이 문제를 다른 방법으로도 풀 수 있나요?", "비슷한 문제를 더 풀어보고 싶어요"]);
  }

  /** 실제 Vision 호출 없이, 전달받은 이미지의 실제 내용을 들여다보지 않고 고정된 학생 풀이를 반환한다. */
  recognizeWork(_image: Buffer, _grade: Grade): Promise<WorkLine[]> {
    return Promise.resolve(FAKE_WORK_LINES);
  }

  /**
   * 입력된 `casVerification`을 반영해 결정적으로 진단한다 — 실제 오류 분류 LLM 호출 없이,
   * 첫 `isValid: false` 줄 직전까지를 `lastValidLine`으로, 그 줄을 `stallLine`으로 삼는다.
   * 모든 줄이 유효하면 오류 없음(중단형 아님)으로 간주해 마지막 줄까지를 `lastValidLine`으로 삼는다.
   */
  diagnose(req: DiagnoseRequest): Promise<Diagnosis> {
    const sorted = [...req.casVerification].sort((a, b) => a.lineNo - b.lineNo);
    const firstInvalid = sorted.find((line) => !line.isValid);

    if (!firstInvalid) {
      const lastLine = sorted.at(-1)?.lineNo ?? 0;
      return Promise.resolve({
        lastValidLine: lastLine,
        stallLine: null,
        errorTypeLabel: null,
        errorDetail: null,
        relatedConcepts: [],
        reachedAnswerWithNotes: false,
        isLowConfidence: false,
        conceptExplanations: [],
        identifiedMethod: FAKE_IDENTIFIED_METHOD,
        isMethodApplicable: true,
        methodApplicabilityNote: null,
        problemAnswerLatex: FAKE_PROBLEM_ANSWER_LATEX,
      });
    }

    const relatedConcepts = ["이차함수 > 완전제곱식"];

    return Promise.resolve({
      lastValidLine: firstInvalid.lineNo - 1,
      stallLine: firstInvalid.lineNo,
      errorTypeLabel: "부호 오류",
      errorDetail: `${firstInvalid.lineNo}번째 줄의 계산을 다시 확인해보세요.`,
      relatedConcepts,
      reachedAnswerWithNotes: false,
      isLowConfidence: false,
      conceptExplanations: buildFakeConceptExplanations(relatedConcepts),
      identifiedMethod: FAKE_IDENTIFIED_METHOD,
      isMethodApplicable: true,
      methodApplicabilityNote: null,
      problemAnswerLatex: FAKE_PROBLEM_ANSWER_LATEX,
    });
  }

  /** `solve`와 동일한 결정론적 청크 스트리밍 패턴으로 이어풀기(RESUME) 결과를 생성한다. */
  async *resume(req: ResumeRequest): AsyncIterable<ResumeStreamEvent> {
    await Promise.resolve();

    if (req.stepMarkers === true) {
      yield* this.resumeWithStepMarkers(req);
      return;
    }

    const chunks = this.buildResumeChunks(req);
    for (const delta of chunks) {
      yield { delta };
    }

    const result: ResumeSolution = {
      mode: req.mode,
      // `methodName`은 해법 이름이 아니라 "이어가는 지점 요약"이다(2026-09 design-agent Figma
      // 실측 `255:92` 반영, `shared-types`의 `ResumeSolution.methodName` JSDoc 참고).
      methodName:
        req.mode === "own" ? `${req.diagnosis.lastValidLine + 1}번째 줄부터 이어가기` : "새로운 방법으로 처음부터 풀기",
      solutionMd: chunks.join(""),
      // CAS(`verify-final-answer`)가 순수 LaTeX만 파싱할 수 있다 — 자연어 문장이면 파싱에
      // 실패해 항상 verified:false가 된다(2026-09 CAS Phase 1 연동 중 발견). `problemAnswerLatex`와
      // 동일하게 프레이밍 문장 없이 값만 채운다.
      answerMd: "-1",
      verified: false,
    };

    yield { done: true, result };
  }

  /** 도형 생성(시나리오별 결정적 결과). 실제 호출 없음. */
  async generateFigures(req: GenerateFiguresRequest): Promise<FigureCallResult> {
    await Promise.resolve();
    switch (this.figureScenario) {
      case "valid":
        return {
          raw: { figures: [await fakeFigure("fig-f07", false)], stepFigureRefs: fakeRefs(["fig-f07"]), omitReason: null },
          usage: null,
        };
      case "none":
        return { raw: { figures: [], stepFigureRefs: [], omitReason: "not_helpful" }, usage: null };
      case "invalid-then-repaired":
      case "invalid-twice":
        return {
          raw: {
            figures: [await fakeFigure("fig-f07", false), await fakeFigure(FAKE_BROKEN_FIGURE_ID, true)],
            stepFigureRefs: fakeRefs(["fig-f07", FAKE_BROKEN_FIGURE_ID]),
            omitReason: null,
          },
          usage: null,
        };
      case "throw":
        throw new Error("fake figures provider error");
      case "malformed":
        return { raw: { figures: "not-an-array", stepFigureRefs: [], omitReason: null }, usage: null };
      case "hang":
        return waitForAbort(req.signal);
    }
  }

  /** 도형 보정 — `invalid-then-repaired`만 고친 도형을 돌려주고, 그 밖에는 같은 잘못을 되풀이한다. */
  async repairFigure(req: RepairFigureRequest): Promise<FigureCallResult> {
    await Promise.resolve();
    if (this.figureScenario === "hang") return waitForAbort(req.signal);
    const repaired = this.figureScenario === "invalid-then-repaired";
    return { raw: { figure: await fakeFigure(FAKE_BROKEN_FIGURE_ID, !repaired) }, usage: null };
  }

  /**
   * 도형 시각화 on(`stepMarkers: true`) 전용 풀이 — `## 풀이`에 `**1단계**`~`**3단계**`(F07 s1~s3와 일치).
   * 실제 어댑터처럼 전체 텍스트를 `parseSolveOutput`으로 파싱해 결과를 만든다.
   */
  private async *solveWithStepMarkers(req: SolveRequest): AsyncIterable<SolveStreamEvent> {
    await Promise.resolve();
    const chunks: string[] = [];
    if (req.options.concept) {
      chunks.push("## 관련 개념\n", "이차함수의 최솟값은 꼭짓점의 y좌표입니다.\n\n");
    }
    if (req.options.solution) {
      chunks.push(
        "## 풀이\n",
        "**1단계** 이차함수 y = x^2 - 4x + 3의 그래프를 그립니다.\n",
        "**2단계** y = (x - 2)^2 - 1로 바꾸면 꼭짓점은 (2, -1)입니다.\n",
        "**3단계** y = 0을 풀면 x = 1, 3이므로 x축과 (1, 0), (3, 0)에서 만납니다.\n\n",
      );
    }
    chunks.push("## 최종 답\n", "최솟값은 -1입니다.\n", '{"concept_tags": ["이차함수 > 최대·최소"]}');

    for (const delta of chunks) {
      yield { delta };
    }

    const parsed = parseSolveOutput(chunks.join(""));
    const result: Solution = {
      conceptMd: req.options.concept ? parsed.conceptMd : null,
      solutionMd: req.options.solution ? parsed.solutionMd : null,
      answerMd: parsed.answerMd,
      conceptTags: parsed.conceptTags,
      aiProvider: this.provider,
      aiModel: this.model,
    };
    yield { done: true, result };
  }

  /**
   * 도형 시각화 on 전용 이어풀기 — `## 해법`/`## 이어풀기`(**1단계**~**3단계**)/`## 최종 답`(순수 LaTeX).
   * own의 s1은 학생 줄 번호와 무관하게 이어서 쓴 첫 단계다.
   */
  private async *resumeWithStepMarkers(req: ResumeRequest): AsyncIterable<ResumeStreamEvent> {
    await Promise.resolve();
    const methodLine =
      req.mode === "own" ? `${req.diagnosis.lastValidLine + 1}번째 줄부터 이어가기` : "새로운 방법으로 처음부터 풀기";
    const chunks = [
      "## 해법\n",
      `${methodLine}\n\n`,
      "## 이어풀기\n",
      "**1단계** 이차함수 y = x^2 - 4x + 3의 그래프를 떠올립니다.\n",
      "**2단계** y = (x - 2)^2 - 1이므로 꼭짓점은 (2, -1)입니다.\n",
      "**3단계** x축과는 (1, 0), (3, 0)에서 만나고 최솟값은 꼭짓점의 y좌표입니다.\n\n",
      "## 최종 답\n",
      "-1",
    ];

    for (const delta of chunks) {
      yield { delta };
    }

    const parsed = parseResumeOutput(chunks.join(""));
    const result: ResumeSolution = {
      mode: req.mode,
      methodName: parsed.methodName,
      solutionMd: parsed.solutionMd,
      answerMd: parsed.answerMd,
      verified: false,
    };
    yield { done: true, result };
  }

  private buildResumeChunks(req: ResumeRequest): string[] {
    return req.mode === "own"
      ? ["## 이어풀기\n", `${req.diagnosis.lastValidLine + 1}번째 줄부터 이어서 진행합니다.\n\n`, "최솟값은 -1입니다."]
      : ["## 다른 방법으로\n", "판별식을 이용해 처음부터 다시 풀어봅시다.\n\n", "최솟값은 -1입니다."];
  }

  private buildChunks(req: SolveRequest): string[] {
    const chunks: string[] = [];

    if (req.options.concept) {
      chunks.push("## 개념 설명\n", "이차함수의 최솟값은 ", "꼭짓점의 y좌표입니다.\n\n");
    }
    if (req.options.solution) {
      chunks.push("## 풀이\n", "1. 완전제곱식으로 변형합니다.\n", "2. 꼭짓점의 좌표를 구합니다.\n\n");
    }
    chunks.push("최솟값은 -1입니다.");

    return chunks;
  }
}

/**
 * `relatedConcepts` 각 이름에 대해 고정된 제목+설명을 결정적으로 생성한다(실제 수학적으로 정확할
 * 필요는 없다 — 테스트가 결정적으로 검증할 수 있는 값이면 충분하다).
 */
function buildFakeConceptExplanations(relatedConcepts: string[]): ConceptExplanation[] {
  return relatedConcepts.map((name) => ({
    name,
    title: `${name} 개념 정리`,
    explanationMd: `${name}은(는) 이 문제를 푸는 데 필요한 핵심 개념입니다. 정의와 핵심 원리를 다시 확인해보세요.`,
  }));
}
