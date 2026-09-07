import OpenAI from "openai";
import type {
  ChatMessage,
  Diagnosis,
  Grade,
  RecognizedProblem,
  ResumeSolution,
  ResumeStreamEvent,
  Solution,
  SolveOptions,
  WorkLine,
} from "shared-types";
import {
  diagnoseResponseSchema,
  recognizedProblemSchema,
  suggestedQuestionsResponseSchema,
  workLinesResponseSchema,
} from "validation";
import { AppError } from "../../shared/errors/AppError";
import type {
  ChatRequest,
  DiagnoseRequest,
  LLMAdapter,
  ResumeRequest,
  SolveRequest,
  SolveStreamEvent,
  SuggestQuestionsRequest,
} from "./adapter";
import { parseResumeOutput } from "./parseResumeOutput";
import { parseSolveOutput } from "./parseSolveOutput";
import {
  buildChatPrompt,
  buildDiagnosePrompt,
  buildRecognizePrompt,
  buildRecognizeWorkPrompt,
  buildResumePrompt,
  buildSuggestQuestionsPrompt,
  buildSystemPrompt,
} from "./prompts/system";

/**
 * OpenAI Responses API로 recognizeProblem/solve를 강제하는 JSON Schema(Structured Outputs).
 * `RecognizedProblem`(shared-types) 형태와 정확히 일치시킨다.
 */
const RECOGNIZED_PROBLEM_JSON_SCHEMA = {
  type: "object",
  properties: {
    recognizedText: { type: "string" },
    recognizedLatex: { type: ["string", "null"] },
  },
  required: ["recognizedText", "recognizedLatex"],
  additionalProperties: false,
} as const;

/** `suggestQuestions` 구조화 출력 스키마 — `SuggestedQuestionsResponseDto`(validation)와 일치. */
const SUGGESTED_QUESTIONS_JSON_SCHEMA = {
  type: "object",
  properties: {
    questions: { type: "array", items: { type: "string" } },
  },
  required: ["questions"],
  additionalProperties: false,
} as const;

/** `recognizeWork` 구조화 출력 스키마 — `WorkLinesResponseDto`(validation)/`WorkLine[]`(shared-types)와 일치. */
const WORK_LINES_JSON_SCHEMA = {
  type: "object",
  properties: {
    workLines: {
      type: "array",
      items: {
        type: "object",
        properties: {
          lineNo: { type: "number" },
          latex: { type: "string" },
          isLowConfidence: { type: "boolean" },
        },
        required: ["lineNo", "latex", "isLowConfidence"],
        additionalProperties: false,
      },
    },
  },
  required: ["workLines"],
  additionalProperties: false,
} as const;

/** `diagnose` 구조화 출력 스키마 — `DiagnoseResponseDto`(validation)/`Diagnosis`(shared-types)와 일치. */
const DIAGNOSIS_JSON_SCHEMA = {
  type: "object",
  properties: {
    lastValidLine: { type: "number" },
    stallLine: { type: ["number", "null"] },
    errorTypeLabel: { type: ["string", "null"] },
    errorDetail: { type: ["string", "null"] },
    relatedConcepts: { type: "array", items: { type: "string" } },
    reachedAnswerWithNotes: { type: "boolean" },
    isLowConfidence: { type: "boolean" },
    conceptExplanations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          title: { type: "string" },
          explanationMd: { type: "string" },
        },
        required: ["name", "title", "explanationMd"],
        additionalProperties: false,
      },
    },
    identifiedMethod: {
      type: ["object", "null"],
      properties: {
        methodId: { type: "string" },
        methodName: { type: "string" },
      },
      required: ["methodId", "methodName"],
      additionalProperties: false,
    },
    isMethodApplicable: { type: "boolean" },
    methodApplicabilityNote: { type: ["string", "null"] },
    problemAnswerLatex: { type: "string" },
  },
  required: [
    "lastValidLine",
    "stallLine",
    "errorTypeLabel",
    "errorDetail",
    "relatedConcepts",
    "reachedAnswerWithNotes",
    "isLowConfidence",
    "conceptExplanations",
    "identifiedMethod",
    "isMethodApplicable",
    "methodApplicabilityNote",
    "problemAnswerLatex",
  ],
  additionalProperties: false,
} as const;

/**
 * 모든 OpenAI 호출(recognize/solve/chat)에 공통 적용하는 타임아웃(Final QA MEDIUM-2 — 타임아웃이
 * 없으면 upstream이 응답을 멈춰도 요청이 무한정 열려 있는다). 값 자체는 근거 없는 임시값이라
 * 결정 필요 — PRD는 "스트리밍 첫 토큰 5초 이내"를 성능 목표로만 제시할 뿐 하드 타임아웃 값은
 * 정하지 않았다.
 */
const OPENAI_REQUEST_TIMEOUT_MS = 30_000;

/**
 * `openai` SDK를 참조하는 유일한 파일이다 — 다른 어떤 파일도 이 패키지의 타입을 직접
 * import하지 않는다. `LLMAdapter` interface(shared-types 도메인 타입만 사용)만 노출한다.
 * OpenAI Responses API(Chat Completions 아님)를 사용한다.
 */
export class OpenAIAdapter implements LLMAdapter {
  private readonly client: OpenAI;

  constructor(
    private readonly model: string,
    apiKey: string,
  ) {
    this.client = new OpenAI({ apiKey, timeout: OPENAI_REQUEST_TIMEOUT_MS });
  }

  async recognizeProblem(image: Buffer, grade: Grade): Promise<RecognizedProblem> {
    const imageUrl = `data:image/jpeg;base64,${image.toString("base64")}`;

    const response = await this.client.responses.create({
      model: this.model,
      input: [
        { role: "system", content: buildRecognizePrompt(grade) },
        {
          role: "user",
          content: [
            { type: "input_text", text: "이 이미지에서 수학 문제를 그대로 추출해줘." },
            { type: "input_image", image_url: imageUrl, detail: "auto" },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "recognized_problem",
          schema: RECOGNIZED_PROBLEM_JSON_SCHEMA,
          strict: true,
        },
      },
    });

    let parsed: unknown;
    try {
      parsed = JSON.parse(response.output_text);
    } catch {
      throw new AppError("provider_error", "문제 인식 응답을 해석하지 못했습니다.", 502);
    }

    const result = recognizedProblemSchema.safeParse(parsed);
    if (!result.success) {
      throw new AppError("provider_error", "문제 인식 응답이 예상한 형식이 아닙니다.", 502);
    }

    return result.data;
  }

  async *solve(req: SolveRequest): AsyncIterable<SolveStreamEvent> {
    const stream = await this.client.responses.create({
      model: this.model,
      stream: true,
      input: [
        { role: "system", content: buildSystemPrompt(req.grade) },
        { role: "user", content: buildSolveUserMessage(req.problem, req.options) },
      ],
    });

    let fullText = "";
    for await (const event of stream) {
      if (event.type === "response.output_text.delta") {
        fullText += event.delta;
        yield { delta: event.delta };
      }
    }

    const parsed = parseSolveOutput(fullText);
    const result: Solution = {
      conceptMd: req.options.concept ? parsed.conceptMd : null,
      solutionMd: req.options.solution ? parsed.solutionMd : null,
      answerMd: parsed.answerMd,
      conceptTags: parsed.conceptTags,
      aiProvider: "openai",
      aiModel: this.model,
    };

    yield { done: true, result };
  }

  /** 후속 질문(채팅) — 일반 완료 응답(stream:true 아님, PRD CHAT-8: 실시간 스트리밍은 P1). */
  async chat(req: ChatRequest): Promise<string> {
    const response = await this.client.responses.create({
      model: this.model,
      input: [
        { role: "system", content: buildChatPrompt(req.grade) },
        { role: "user", content: buildChatUserMessage(req) },
      ],
    });

    return response.output_text;
  }

  /** 후속 질문 제안 pill 문구 생성(Final QA MEDIUM-4) — 짧은 프롬프트/응답만 요구해 지연을 최소화한다. */
  async suggestQuestions(req: SuggestQuestionsRequest): Promise<string[]> {
    const response = await this.client.responses.create({
      model: this.model,
      input: [
        { role: "system", content: buildSuggestQuestionsPrompt(req.grade) },
        { role: "user", content: buildSuggestQuestionsUserMessage(req) },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "suggested_questions",
          schema: SUGGESTED_QUESTIONS_JSON_SCHEMA,
          strict: true,
        },
      },
    });

    let parsed: unknown;
    try {
      parsed = JSON.parse(response.output_text);
    } catch {
      throw new AppError("provider_error", "추천 질문 응답을 해석하지 못했습니다.", 502);
    }

    const result = suggestedQuestionsResponseSchema.safeParse(parsed);
    if (!result.success) {
      throw new AppError("provider_error", "추천 질문 응답이 예상한 형식이 아닙니다.", 502);
    }

    return result.data.questions;
  }

  /** 이미지에서 학생이 손으로 쓴 풀이를 줄 단위로 인식한다(WORK-2). `recognizeProblem`과 동일한
   * Vision 입력 + Structured Outputs 패턴을 따른다. */
  async recognizeWork(image: Buffer, grade: Grade): Promise<WorkLine[]> {
    const imageUrl = `data:image/jpeg;base64,${image.toString("base64")}`;

    const response = await this.client.responses.create({
      model: this.model,
      input: [
        { role: "system", content: buildRecognizeWorkPrompt(grade) },
        {
          role: "user",
          content: [
            { type: "input_text", text: "이 이미지에서 학생이 손으로 쓴 풀이를 줄 단위로 인식해줘." },
            { type: "input_image", image_url: imageUrl, detail: "auto" },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "work_lines",
          schema: WORK_LINES_JSON_SCHEMA,
          strict: true,
        },
      },
    });

    let parsed: unknown;
    try {
      parsed = JSON.parse(response.output_text);
    } catch {
      throw new AppError("provider_error", "풀이 인식 응답을 해석하지 못했습니다.", 502);
    }

    const result = workLinesResponseSchema.safeParse(parsed);
    if (!result.success) {
      throw new AppError("provider_error", "풀이 인식 응답이 예상한 형식이 아닙니다.", 502);
    }

    return result.data.workLines;
  }

  /**
   * 문제/줄 단위 풀이/CAS 검증 결과를 바탕으로 막힌 지점·오류 유형을 진단한다(DIAG).
   * 판정(정답 여부)은 이미 끝난 `casVerification`을 그대로 신뢰하도록 프롬프트에서 강제하고,
   * LLM은 그 결과를 설명/해석하는 역할만 한다 — `solve`와 동일한 Structured Outputs 패턴.
   */
  async diagnose(req: DiagnoseRequest): Promise<Diagnosis> {
    const response = await this.client.responses.create({
      model: this.model,
      input: [
        { role: "system", content: buildDiagnosePrompt(req.grade) },
        { role: "user", content: buildDiagnoseUserMessage(req) },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "diagnosis",
          schema: DIAGNOSIS_JSON_SCHEMA,
          strict: true,
        },
      },
    });

    let parsed: unknown;
    try {
      parsed = JSON.parse(response.output_text);
    } catch {
      throw new AppError("provider_error", "진단 응답을 해석하지 못했습니다.", 502);
    }

    const result = diagnoseResponseSchema.safeParse(parsed);
    if (!result.success) {
      throw new AppError("provider_error", "진단 응답이 예상한 형식이 아닙니다.", 502);
    }

    return result.data;
  }

  /**
   * 진단 결과를 이어서 풀이를 생성한다(RESUME) — `solve`와 동일한 스트리밍 구조를 따르되,
   * Structured Outputs 대신 `solve`처럼 헤더 기반 마크다운(`RESUME_HEADERS`)을 스트리밍한 뒤
   * `parseResumeOutput`으로 파싱한다. `verified`는 CAS 검증 이전이라 항상 `false`로 두고,
   * 호출부(`resume.router.ts`)가 `stubResumeCasCheck()` 결과로 덮어쓴다.
   */
  async *resume(req: ResumeRequest): AsyncIterable<ResumeStreamEvent> {
    const stream = await this.client.responses.create({
      model: this.model,
      stream: true,
      input: [
        { role: "system", content: buildResumePrompt(req.grade, req.mode) },
        { role: "user", content: buildResumeUserMessage(req) },
      ],
    });

    let fullText = "";
    for await (const event of stream) {
      if (event.type === "response.output_text.delta") {
        fullText += event.delta;
        yield { delta: event.delta };
      }
    }

    const parsed = parseResumeOutput(fullText);
    const result: ResumeSolution = {
      mode: req.mode,
      methodName: parsed.methodName,
      solutionMd: parsed.solutionMd,
      answerMd: parsed.answerMd,
      verified: false,
    };

    yield { done: true, result };
  }
}

/**
 * "시스템 지시"(behavior rules, buildSystemPrompt)와 "사용자 입력"(문제·옵션)을 분리한다 —
 * 사용자 입력을 시스템 프롬프트 문자열에 concat하지 않고 항상 별도 user 메시지로만 전달한다.
 */
function buildSolveUserMessage(problem: RecognizedProblem, options: SolveOptions): string {
  const requestedOptions = [
    options.concept ? "개념설명해주기" : null,
    options.solution ? "풀이해주기" : null,
  ]
    .filter((label): label is string => label !== null)
    .join(", ");

  const latexLine = problem.recognizedLatex ? `\n수식(LaTeX): ${problem.recognizedLatex}` : "";

  return [`요청한 옵션: ${requestedOptions}`, `문제: ${problem.recognizedText}${latexLine}`].join(
    "\n\n",
  );
}

/**
 * 채팅용 user 메시지 — 문제/최초 풀이/이전 대화 이력/이번 질문을 명확히 구분해 구성한다.
 * `buildSolveUserMessage`와 동일한 원칙(시스템 프롬프트에 사용자 데이터를 concat하지 않음)을 따른다.
 */
function buildChatUserMessage(req: ChatRequest): string {
  const latexLine = req.problem.recognizedLatex ? `\n수식(LaTeX): ${req.problem.recognizedLatex}` : "";

  const historyText =
    req.history.length > 0
      ? req.history.map((message) => `${chatRoleLabel(message.role)}: ${message.content}`).join("\n")
      : "(이전 대화 없음)";

  return [
    `문제: ${req.problem.recognizedText}${latexLine}`,
    `최초 풀이의 답: ${req.solution.answerMd}`,
    `지금까지의 대화:\n${historyText}`,
    `이번 질문: ${req.question}`,
  ].join("\n\n");
}

function chatRoleLabel(role: ChatMessage["role"]): string {
  return role === "user" ? "학생" : "튜터";
}

/** 제안 질문 생성용 user 메시지 — 문제/답만 있으면 충분하다(대화 이력 불필요, 최소 컨텍스트). */
function buildSuggestQuestionsUserMessage(req: SuggestQuestionsRequest): string {
  const latexLine = req.problem.recognizedLatex ? `\n수식(LaTeX): ${req.problem.recognizedLatex}` : "";

  return [`문제: ${req.problem.recognizedText}${latexLine}`, `답: ${req.solution.answerMd}`].join(
    "\n\n",
  );
}

/**
 * 진단(diagnose)용 user 메시지 — 문제/학생 풀이(줄 단위)/CAS 검증 결과를 명확히 구분해 전달한다.
 * CAS 검증 결과는 이미 계산이 끝난 사실로 제시해, LLM이 재판정하지 않고 그대로 신뢰하게 한다.
 */
function buildDiagnoseUserMessage(req: DiagnoseRequest): string {
  const workLinesText = req.workLines
    .map((line) => `${line.lineNo}번째 줄: ${line.latex}`)
    .join("\n");

  const casVerificationText = req.casVerification
    .map((line) => `${line.lineNo}번째 줄: ${line.isValid ? "유효(isValid:true)" : "무효(isValid:false)"}`)
    .join("\n");

  return [
    `문제: ${req.problem}`,
    `학생 풀이(줄 단위):\n${workLinesText}`,
    `CAS 검증 결과(줄 단위, 이미 계산 완료 — 그대로 신뢰할 것):\n${casVerificationText}`,
  ].join("\n\n");
}

/**
 * 이어풀기(resume)용 user 메시지 — 문제/학생 풀이(줄 단위)/이미 끝난 진단 결과를 명확히 구분해
 * 전달한다. `identifiedMethod`가 있으면 함께 알려줘 own 모드에서 같은 해법명을 유지하게 한다.
 */
function buildResumeUserMessage(req: ResumeRequest): string {
  const workLinesText = req.workLines
    .map((line) => `${line.lineNo}번째 줄: ${line.latex}`)
    .join("\n");

  const identifiedMethodText = req.diagnosis.identifiedMethod
    ? `${req.diagnosis.identifiedMethod.methodName}(methodId: ${req.diagnosis.identifiedMethod.methodId})`
    : "식별되지 않음";

  return [
    `문제: ${req.problem}`,
    `학생 풀이(줄 단위):\n${workLinesText}`,
    `진단 결과 — 마지막으로 유효했던 줄(lastValidLine): ${req.diagnosis.lastValidLine}, 막힌 지점(stallLine): ${req.diagnosis.stallLine ?? "없음"}`,
    `식별된 해법: ${identifiedMethodText}`,
    `이어풀기 모드: ${req.mode === "own" ? "내 방법으로 계속" : "다른 방법으로"}`,
  ].join("\n\n");
}
