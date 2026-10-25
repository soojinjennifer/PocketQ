import type {
  AiProvider,
  CasStepVerification,
  ChatFigureSummary,
  ChatMessage,
  Diagnosis,
  Grade,
  RecognizedProblem,
  ResumeMode,
  ResumeStreamEvent,
  Solution,
  SolveOptions,
  WorkLine,
} from "shared-types";
import { env } from "../../config/env";
import { OpenAIAdapter } from "./openai-adapter";

export interface SolveRequest {
  problem: RecognizedProblem;
  options: SolveOptions;
  grade: Grade;
  /**
   * 도형 시각화(`FIGURES_ENABLED=true`)일 때만 true — `## 풀이` 단계마다 `**N단계**` 표지를 요청한다.
   * off면 키 자체를 넣지 않는다(요청·프롬프트 바이트 불변, S3-1).
   */
  stepMarkers?: boolean;
}

export type SolveStreamEvent = { delta: string } | { done: true; result: Solution };

/**
 * CHAT 도형 맥락(Stage 5, `docs/FIGURE_SPEC.md` §17). 서버 `FIGURES_ENABLED` on이고 대화 맥락이 된 결과에 검증 도형이
 * 있을 때만 라우터가 채운다(없으면 `ChatRequest`에 키 자체가 없다 — 기존 요청과 바이트 동일). 모든 값은 서버가 만든다.
 */
export interface ChatFigureContext {
  /** 학생이 보고 있는 단계(1..99) 또는 null(최종). */
  currentStep: number | null;
  /** 그 단계 블록의 원문(최대 `CHAT_STEP_TEXT_MAX_CHARS`). 최종이거나 단계 분할 실패면 null. */
  stepText: string | null;
  /** 풀이 본문 앞부분(최대 `CHAT_SOLUTION_EXCERPT_MAX_CHARS`). */
  solutionExcerpt: string;
  /** 검증 도형 요약(`buildFigureChatSummaries`, 도형당 ≤3,000자·합계 ≤6,000자). */
  figures: ChatFigureSummary[];
}

/** 후속 질문(채팅) 요청 — 문제/최초 풀이 컨텍스트와 이전 대화 이력, 이번 질문을 함께 전달한다. */
export interface ChatRequest {
  problem: RecognizedProblem;
  solution: Solution;
  history: ChatMessage[];
  question: string;
  grade: Grade;
  /** Stage 5 도형 맥락(선택). CHAT은 도형을 생성하지 않는다 — 응답은 여전히 answerMd 하나다. */
  figureContext?: ChatFigureContext;
}

/** 후속 질문 제안 pill 문구 생성 요청 — 문제/풀이 컨텍스트만 있으면 된다(대화 이력 불필요). */
export interface SuggestQuestionsRequest {
  problem: RecognizedProblem;
  solution: Solution;
  grade: Grade;
}

/** 학생 풀이 진단(DIAG) 요청 — 문제/줄 단위 풀이/CAS 검증 결과를 함께 전달한다. */
export interface DiagnoseRequest {
  problem: string;
  workLines: WorkLine[];
  casVerification: CasStepVerification[];
  grade: Grade;
}

/**
 * 이어풀기(RESUME) 요청 — `DiagnoseRequest`와 마찬가지로 문제 원문과 학생 풀이 컨텍스트를
 * 전달하되, 이미 끝난 진단 결과(`diagnosis`)와 이어풀기 모드(`mode`)를 함께 넘겨 어댑터가
 * "어디서부터, 어떻게 이어갈지"를 판단할 수 있게 한다.
 */
export interface ResumeRequest {
  problem: string;
  workLines: WorkLine[];
  diagnosis: Diagnosis;
  mode: ResumeMode;
  grade: Grade;
  /** `SolveRequest.stepMarkers`와 같은 의미(`## 이어풀기` 섹션, s1 = 이어서 쓴 첫 단계). */
  stepMarkers?: boolean;
}

/** 학생 풀이 중 도형 생성에 넘길 유효 구간(own 모드만, `buildPriorWork`). 학생 데이터이며 지시가 아니다. */
export interface FigurePriorWork {
  lines: string[];
}

/** 도형 생성 호출 공통 맥락(`docs/FIGURE_SPEC.md` §16). 모든 텍스트는 user 메시지의 JSON 안에만 들어간다. */
export interface FigureCallContext {
  source: "solve" | "resume";
  /** resume일 때만 값이 있다. */
  mode: ResumeMode | null;
  grade: Grade;
  problemText: string;
  priorWork: FigurePriorWork | null;
  /** 단계 표지가 있는 풀이 섹션 본문(최초 풀이 `## 풀이`, 이어풀기 `## 이어풀기`). */
  solutionMd: string | null;
  answerMd: string;
  /** `splitSolutionSteps` 결과 단계 수. 분할 실패면 null. */
  stepCount: number | null;
  /** 클라이언트 연결 끊김·전체 상한 초과 시 취소. */
  signal: AbortSignal;
}

/** 도형 생성 요청(봉투 `{ figures, stepFigureRefs, omitReason }`를 strict 구조화 출력으로 받는다). */
export type GenerateFiguresRequest = FigureCallContext;

/** 검증에 실패한 도형 1개의 보정 요청. `errors`는 `toRepairErrors`로 정제된 code·path만 담는다. */
export interface RepairFigureRequest extends FigureCallContext {
  /** 실패한 도형(JSON 파싱 값을 그대로 다시 직렬화해 보낸다). */
  figure: unknown;
  errors: { code: string; path: (string | number)[] }[];
}

/** 도형 호출 토큰 사용량(`response.usage`). 공급자가 주지 않으면 null. */
export interface FigureCallUsage {
  inputTokens: number;
  outputTokens: number;
}

/**
 * 도형 호출 결과. `raw`는 JSON 파싱만 한 값이다 — 검증되지 않았으므로 그대로 클라이언트에 보내지 않는다.
 * 어댑터는 호출 실패·타임아웃·incomplete·refusal·JSON 파싱 실패면 throw한다.
 */
export interface FigureCallResult {
  raw: unknown;
  usage: FigureCallUsage | null;
}

/**
 * PRD §8.3 LLM Adapter 인터페이스.
 * 실제 SDK(OpenAI/Anthropic) 타입은 절대 노출하지 않고 shared-types 도메인 타입만 사용한다.
 */
export interface LLMAdapter {
  /** 이미지에서 문제 텍스트/LaTeX 추출 */
  recognizeProblem(image: Buffer, grade: Grade): Promise<RecognizedProblem>;
  /** 개념/풀이 생성 — 스트리밍 */
  solve(req: SolveRequest): AsyncIterable<SolveStreamEvent>;
  /**
   * 후속 질문(채팅) 응답 생성 — 일반 완료 응답(스트리밍 아님, PRD CHAT-8: 실시간 스트리밍은 P1).
   * 반환값은 answerMd 하나뿐이다.
   */
  chat(req: ChatRequest): Promise<string>;
  /**
   * 후속 질문 제안 pill 문구 생성(Final QA MEDIUM-4) — 문제/풀이를 반영한 짧은 질문 2개.
   * 로딩이 오래 걸리지 않도록 최소한의 프롬프트/응답만 요구한다.
   */
  suggestQuestions(req: SuggestQuestionsRequest): Promise<string[]>;
  /** 이미지에서 학생이 손으로 쓴 풀이를 줄 단위로 인식한다(WORK-2). */
  recognizeWork(image: Buffer, grade: Grade): Promise<WorkLine[]>;
  /** 문제/줄 단위 풀이/CAS 검증 결과를 바탕으로 막힌 지점·오류 유형을 진단한다(DIAG). */
  diagnose(req: DiagnoseRequest): Promise<Diagnosis>;
  /**
   * 진단 결과를 이어서 풀이를 생성한다(RESUME) — 스트리밍. `verified`(CAS 검증)는 어댑터가
   * 채우지 않고 항상 `false`로 yield하며, 호출부(`resume.router.ts`)가 `stubResumeCasCheck()`
   * 결과로 덮어쓴다(CAS 검증은 어댑터의 책임이 아니다).
   */
  resume(req: ResumeRequest): AsyncIterable<ResumeStreamEvent>;
  /**
   * 풀이 텍스트가 끝난 뒤(`done` 이후) 도형 명세를 별도 비스트리밍 strict 구조화 호출로 생성한다
   * (Stage 3, `docs/FIGURE_SPEC.md` §16). 자동 재시도 없음, `req.signal`로 취소된다.
   */
  generateFigures(req: GenerateFiguresRequest): Promise<FigureCallResult>;
  /** 검증에 실패한 도형 1개를 보정한다(출력 `{ figure: FigureSpec | null }`). 도형당 최대 1회만 호출된다. */
  repairFigure(req: RepairFigureRequest): Promise<FigureCallResult>;
}

/**
 * Provider별 LLMAdapter 팩토리 (PRD §8.3: `createAdapter(AI_PROVIDER, AI_MODEL)`).
 *
 * Claude adapter는 아직 구현되지 않아 호출 시 명확한 오류를 던지는 스텁으로 남아있다.
 * OpenAI adapter는 실제 Responses API로 동작하며, `OPENAI_API_KEY`/`model`이 비어있으면
 * 여기서 즉시(호출 시점에) 설정 오류를 던진다 — 조용히 다른 동작으로 대체하지 않는다.
 */
export function createAdapter(provider: AiProvider, model: string): LLMAdapter {
  switch (provider) {
    case "openai": {
      if (!env.openaiApiKey) {
        throw new Error(
          "AI_PROVIDER=openai로 설정됐지만 OPENAI_API_KEY 환경변수가 비어 있습니다.",
        );
      }
      if (!model) {
        throw new Error("AI_PROVIDER=openai로 설정됐지만 AI_MODEL 환경변수가 비어 있습니다.");
      }
      return new OpenAIAdapter(model, env.openaiApiKey);
    }
    case "claude":
      throw new Error("Claude adapter는 아직 구현되지 않았습니다 (5단계 이후 범위).");
  }
}
