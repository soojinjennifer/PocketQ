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
  LLMAdapter,
  ResumeRequest,
  SolveRequest,
  SolveStreamEvent,
  SuggestQuestionsRequest,
} from "./adapter";

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
 * 실제 Vision/LLM 호출 없이 고정된 가짜 결과를 반환하는 어댑터.
 * recognizeProblem은 전달받은 이미지의 실제 내용을 전혀 들여다보지 않고,
 * 항상 동일한 그럴듯한 더미 문제 텍스트를 즉시 반환한다.
 */
export class FakeLLMAdapter implements LLMAdapter {
  constructor(
    private readonly provider: AiProvider = "claude",
    private readonly model: string = "fake-whymath-v0",
  ) {}

  recognizeProblem(_image: Buffer, _grade: Grade): Promise<RecognizedProblem> {
    return Promise.resolve({
      recognizedText: FAKE_RECOGNIZED_TEXT,
      recognizedLatex: FAKE_RECOGNIZED_LATEX,
    });
  }

  async *solve(req: SolveRequest): AsyncIterable<SolveStreamEvent> {
    // 실제 스트리밍 어댑터처럼 최소 한 번은 비동기 지점을 거치게 한다(마이크로태스크 양보).
    await Promise.resolve();

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
