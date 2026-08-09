import OpenAI from "openai";
import type { Grade, RecognizedProblem, Solution, SolveOptions } from "shared-types";
import { recognizedProblemSchema } from "validation";
import { AppError } from "../../shared/errors/AppError";
import type { LLMAdapter, SolveRequest, SolveStreamEvent } from "./adapter";
import { parseSolveOutput } from "./parseSolveOutput";
import { buildRecognizePrompt, buildSystemPrompt } from "./prompts/system";

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
    this.client = new OpenAI({ apiKey });
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
