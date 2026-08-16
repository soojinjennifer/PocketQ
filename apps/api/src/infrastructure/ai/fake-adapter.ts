import type { AiProvider, Grade, RecognizedProblem, Solution } from "shared-types";
import type { ChatRequest, LLMAdapter, SolveRequest, SolveStreamEvent } from "./adapter";

const FAKE_RECOGNIZED_TEXT = "이차함수 y = x^2 - 4x + 3의 최솟값을 구하시오.";
const FAKE_RECOGNIZED_LATEX = "y = x^{2} - 4x + 3";

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
