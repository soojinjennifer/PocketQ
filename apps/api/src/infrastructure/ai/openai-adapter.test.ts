import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ResumeStreamEvent } from "shared-types";

// openai SDK를 완전히 mock한다 — 이 테스트 파일을 포함해 어떤 자동화 테스트도
// 실제 OpenAI API를 호출하지 않는다(네트워크 호출 자체가 발생하지 않음).
const createMock = vi.fn();

vi.mock("openai", () => {
  class MockOpenAI {
    responses = { create: createMock };
  }
  return { default: MockOpenAI, OpenAI: MockOpenAI };
});

const { OpenAIAdapter } = await import("./openai-adapter");

beforeEach(() => {
  createMock.mockReset();
});

interface RequestInput {
  model: string;
  stream?: boolean;
  text?: { format: { type: string } };
  input: Array<{ role: string; content: unknown }>;
}

describe("OpenAIAdapter.recognizeProblem", () => {
  it("이미지 콘텐츠와 Structured Outputs 스키마를 포함해 Responses API를 호출한다", async () => {
    createMock.mockResolvedValue({
      output_text: JSON.stringify({ recognizedText: "1+1=?", recognizedLatex: null }),
    });

    const adapter = new OpenAIAdapter("test-model", "test-key");
    const result = await adapter.recognizeProblem(Buffer.from("fake-image-bytes"), "M2");

    expect(result).toEqual({ recognizedText: "1+1=?", recognizedLatex: null });

    const callArgs = createMock.mock.calls[0]?.[0] as RequestInput;
    expect(callArgs.model).toBe("test-model");
    expect(callArgs.text?.format.type).toBe("json_schema");
    expect(callArgs.stream).toBeUndefined();

    const userMessage = callArgs.input.find((m) => m.role === "user");
    const content = userMessage?.content as Array<{ type: string }> | undefined;
    expect(content?.some((part) => part.type === "input_image")).toBe(true);
  });

  it("응답이 검증 스키마와 다르면 provider_error(502)를 던진다", async () => {
    createMock.mockResolvedValue({ output_text: JSON.stringify({ unexpected: "shape" }) });

    const adapter = new OpenAIAdapter("test-model", "test-key");

    await expect(adapter.recognizeProblem(Buffer.from("x"), "M2")).rejects.toMatchObject({
      code: "provider_error",
      status: 502,
    });
  });

  it("응답이 JSON으로 파싱되지 않으면 provider_error(502)를 던진다", async () => {
    createMock.mockResolvedValue({ output_text: "이건 JSON이 아님" });

    const adapter = new OpenAIAdapter("test-model", "test-key");

    await expect(adapter.recognizeProblem(Buffer.from("x"), "M2")).rejects.toMatchObject({
      code: "provider_error",
    });
  });
});

describe("OpenAIAdapter.solve", () => {
  it("stream:true로 요청하고, 델타를 순서대로 yield한 뒤 파싱된 결과를 done으로 yield한다", async () => {
    async function* fakeStream() {
      await Promise.resolve();
      yield { type: "response.output_text.delta", delta: "## 최종 답\n" };
      yield { type: "response.output_text.delta", delta: "3입니다." };
      yield { type: "response.completed" };
    }
    createMock.mockResolvedValue(fakeStream());

    const adapter = new OpenAIAdapter("test-model", "test-key");
    const events: Array<{ delta: string } | { done: true; result: { answerMd: string } }> = [];

    for await (const event of adapter.solve({
      problem: { recognizedText: "1+1=?", recognizedLatex: null },
      options: { concept: false, solution: false },
      grade: "M2",
    })) {
      events.push(event);
    }

    expect(events[0]).toEqual({ delta: "## 최종 답\n" });
    expect(events[1]).toEqual({ delta: "3입니다." });

    const done = events[2] as { done: true; result: { answerMd: string; aiProvider: string; aiModel: string } };
    expect(done.done).toBe(true);
    expect(done.result.answerMd).toBe("3입니다.");
    expect(done.result.aiProvider).toBe("openai");
    expect(done.result.aiModel).toBe("test-model");

    const callArgs = createMock.mock.calls[0]?.[0] as RequestInput;
    expect(callArgs.stream).toBe(true);
  });
});

describe("OpenAIAdapter.chat", () => {
  it("stream:true 없이(일반 완료 응답) 호출하고 output_text를 answerMd로 반환한다", async () => {
    createMock.mockResolvedValue({ output_text: "2인 이유는 1+1이기 때문입니다." });

    const adapter = new OpenAIAdapter("test-model", "test-key");

    const answerMd = await adapter.chat({
      problem: { recognizedText: "1+1=?", recognizedLatex: null },
      solution: {
        conceptMd: null,
        solutionMd: null,
        answerMd: "2입니다.",
        conceptTags: [],
        aiProvider: "openai",
        aiModel: "test-model",
      },
      history: [{ role: "user", content: "이전 질문" }],
      question: "왜 2인가요?",
      grade: "M2",
    });

    expect(answerMd).toBe("2인 이유는 1+1이기 때문입니다.");

    const callArgs = createMock.mock.calls[0]?.[0] as RequestInput;
    expect(callArgs.model).toBe("test-model");
    expect(callArgs.stream).toBeUndefined();

    const userMessage = callArgs.input.find((m) => m.role === "user");
    expect(typeof userMessage?.content).toBe("string");
    expect(userMessage?.content as string).toContain("왜 2인가요?");
  });
});

describe("OpenAIAdapter.suggestQuestions", () => {
  it("Structured Outputs로 요청하고 파싱된 질문 배열을 반환한다(Final QA MEDIUM-4)", async () => {
    createMock.mockResolvedValue({
      output_text: JSON.stringify({ questions: ["다른 방법도 있나요?", "비슷한 문제 더 풀래요"] }),
    });

    const adapter = new OpenAIAdapter("test-model", "test-key");
    const questions = await adapter.suggestQuestions({
      problem: { recognizedText: "1+1=?", recognizedLatex: null },
      solution: {
        conceptMd: null,
        solutionMd: null,
        answerMd: "2입니다.",
        conceptTags: [],
        aiProvider: "openai",
        aiModel: "test-model",
      },
      grade: "M2",
    });

    expect(questions).toEqual(["다른 방법도 있나요?", "비슷한 문제 더 풀래요"]);

    const callArgs = createMock.mock.calls[0]?.[0] as RequestInput;
    expect(callArgs.model).toBe("test-model");
    expect(callArgs.text?.format.type).toBe("json_schema");
    expect(callArgs.stream).toBeUndefined();
  });

  it("응답이 검증 스키마와 다르면 provider_error(502)를 던진다", async () => {
    createMock.mockResolvedValue({ output_text: JSON.stringify({ unexpected: "shape" }) });

    const adapter = new OpenAIAdapter("test-model", "test-key");

    await expect(
      adapter.suggestQuestions({
        problem: { recognizedText: "1+1=?", recognizedLatex: null },
        solution: {
          conceptMd: null,
          solutionMd: null,
          answerMd: "2입니다.",
          conceptTags: [],
          aiProvider: "openai",
          aiModel: "test-model",
        },
        grade: "M2",
      }),
    ).rejects.toMatchObject({ code: "provider_error", status: 502 });
  });

  it("응답이 JSON으로 파싱되지 않으면 provider_error(502)를 던진다", async () => {
    createMock.mockResolvedValue({ output_text: "이건 JSON이 아님" });

    const adapter = new OpenAIAdapter("test-model", "test-key");

    await expect(
      adapter.suggestQuestions({
        problem: { recognizedText: "1+1=?", recognizedLatex: null },
        solution: {
          conceptMd: null,
          solutionMd: null,
          answerMd: "2입니다.",
          conceptTags: [],
          aiProvider: "openai",
          aiModel: "test-model",
        },
        grade: "M2",
      }),
    ).rejects.toMatchObject({ code: "provider_error" });
  });
});

describe("OpenAIAdapter.recognizeWork", () => {
  it("이미지 콘텐츠와 Structured Outputs 스키마를 포함해 Responses API를 호출하고 줄 단위 결과를 반환한다", async () => {
    createMock.mockResolvedValue({
      output_text: JSON.stringify({
        workLines: [
          { lineNo: 1, latex: "y = x^2 - 4x + 3", isLowConfidence: false },
          { lineNo: 2, latex: "y = (x-2)^2 - 1", isLowConfidence: true },
        ],
      }),
    });

    const adapter = new OpenAIAdapter("test-model", "test-key");
    const result = await adapter.recognizeWork(Buffer.from("fake-image-bytes"), "M2");

    expect(result).toEqual([
      { lineNo: 1, latex: "y = x^2 - 4x + 3", isLowConfidence: false },
      { lineNo: 2, latex: "y = (x-2)^2 - 1", isLowConfidence: true },
    ]);

    const callArgs = createMock.mock.calls[0]?.[0] as RequestInput;
    expect(callArgs.model).toBe("test-model");
    expect(callArgs.text?.format.type).toBe("json_schema");
    expect(callArgs.stream).toBeUndefined();

    const userMessage = callArgs.input.find((m) => m.role === "user");
    const content = userMessage?.content as Array<{ type: string }> | undefined;
    expect(content?.some((part) => part.type === "input_image")).toBe(true);
  });

  it("응답이 검증 스키마와 다르면 provider_error(502)를 던진다", async () => {
    createMock.mockResolvedValue({ output_text: JSON.stringify({ unexpected: "shape" }) });

    const adapter = new OpenAIAdapter("test-model", "test-key");

    await expect(adapter.recognizeWork(Buffer.from("x"), "M2")).rejects.toMatchObject({
      code: "provider_error",
      status: 502,
    });
  });

  it("응답이 JSON으로 파싱되지 않으면 provider_error(502)를 던진다", async () => {
    createMock.mockResolvedValue({ output_text: "이건 JSON이 아님" });

    const adapter = new OpenAIAdapter("test-model", "test-key");

    await expect(adapter.recognizeWork(Buffer.from("x"), "M2")).rejects.toMatchObject({
      code: "provider_error",
    });
  });
});

describe("OpenAIAdapter.diagnose", () => {
  it("Structured Outputs로 요청하고, CAS 검증 결과를 user 메시지에 포함해 진단 결과를 반환한다", async () => {
    createMock.mockResolvedValue({
      output_text: JSON.stringify({
        lastValidLine: 1,
        stallLine: 2,
        errorTypeLabel: "부호 오류",
        errorDetail: "2번째 줄에서 부호를 잘못 옮겼어요.",
        relatedConcepts: ["이차함수 > 완전제곱식"],
        reachedAnswerWithNotes: false,
        isLowConfidence: false,
        conceptExplanations: [
          {
            name: "이차함수 > 완전제곱식",
            title: "완전제곱식",
            explanationMd: "이차식을 (x-p)^2 + q 형태로 바꾸는 방법입니다.",
          },
        ],
        identifiedMethod: { methodId: "perfect-square", methodName: "완전제곱식" },
        isMethodApplicable: true,
        methodApplicabilityNote: null,
        problemAnswerLatex: "-1",
      }),
    });

    const adapter = new OpenAIAdapter("test-model", "test-key");
    const result = await adapter.diagnose({
      problem: "이차함수 y = x^2 - 4x + 3의 최솟값을 구하시오.",
      workLines: [
        { lineNo: 1, latex: "y = x^2 - 4x + 3", isLowConfidence: false },
        { lineNo: 2, latex: "y = (x-2)^2 + 1", isLowConfidence: false },
      ],
      casVerification: [
        { lineNo: 1, isValid: true },
        { lineNo: 2, isValid: false },
      ],
      grade: "M2",
    });

    expect(result).toEqual({
      lastValidLine: 1,
      stallLine: 2,
      errorTypeLabel: "부호 오류",
      errorDetail: "2번째 줄에서 부호를 잘못 옮겼어요.",
      relatedConcepts: ["이차함수 > 완전제곱식"],
      reachedAnswerWithNotes: false,
      isLowConfidence: false,
      conceptExplanations: [
        {
          name: "이차함수 > 완전제곱식",
          title: "완전제곱식",
          explanationMd: "이차식을 (x-p)^2 + q 형태로 바꾸는 방법입니다.",
        },
      ],
      identifiedMethod: { methodId: "perfect-square", methodName: "완전제곱식" },
      isMethodApplicable: true,
      methodApplicabilityNote: null,
      problemAnswerLatex: "-1",
    });

    const callArgs = createMock.mock.calls[0]?.[0] as RequestInput;
    expect(callArgs.model).toBe("test-model");
    expect(callArgs.text?.format.type).toBe("json_schema");
    expect(callArgs.stream).toBeUndefined();

    const userMessage = callArgs.input.find((m) => m.role === "user");
    expect(typeof userMessage?.content).toBe("string");
    expect(userMessage?.content as string).toContain("isValid:true");
    expect(userMessage?.content as string).toContain("isValid:false");
  });

  it("응답이 검증 스키마와 다르면 provider_error(502)를 던진다", async () => {
    createMock.mockResolvedValue({ output_text: JSON.stringify({ unexpected: "shape" }) });

    const adapter = new OpenAIAdapter("test-model", "test-key");

    await expect(
      adapter.diagnose({
        problem: "1+1=?",
        workLines: [{ lineNo: 1, latex: "2", isLowConfidence: false }],
        casVerification: [{ lineNo: 1, isValid: true }],
        grade: "M2",
      }),
    ).rejects.toMatchObject({ code: "provider_error", status: 502 });
  });

  it("응답이 JSON으로 파싱되지 않으면 provider_error(502)를 던진다", async () => {
    createMock.mockResolvedValue({ output_text: "이건 JSON이 아님" });

    const adapter = new OpenAIAdapter("test-model", "test-key");

    await expect(
      adapter.diagnose({
        problem: "1+1=?",
        workLines: [{ lineNo: 1, latex: "2", isLowConfidence: false }],
        casVerification: [{ lineNo: 1, isValid: true }],
        grade: "M2",
      }),
    ).rejects.toMatchObject({ code: "provider_error" });
  });
});

describe("OpenAIAdapter.resume", () => {
  const BASE_DIAGNOSIS = {
    lastValidLine: 1,
    stallLine: null,
    errorTypeLabel: null,
    errorDetail: null,
    relatedConcepts: [],
    reachedAnswerWithNotes: false,
    isLowConfidence: false,
    conceptExplanations: [],
    identifiedMethod: { methodId: "perfect-square", methodName: "완전제곱식" },
    isMethodApplicable: true,
    methodApplicabilityNote: null,
    problemAnswerLatex: "-1",
  };

  it("stream:true로 요청하고, 델타를 순서대로 yield한 뒤 헤더 기준으로 파싱된 결과를 done으로 yield한다", async () => {
    async function* fakeStream() {
      await Promise.resolve();
      yield { type: "response.output_text.delta", delta: "## 해법\n완전제곱식\n\n" };
      yield { type: "response.output_text.delta", delta: "## 이어풀기\n다음 단계는...\n\n" };
      yield { type: "response.output_text.delta", delta: "## 최종 답\n최솟값은 -1입니다." };
      yield { type: "response.completed" };
    }
    createMock.mockResolvedValue(fakeStream());

    const adapter = new OpenAIAdapter("test-model", "test-key");
    const events: ResumeStreamEvent[] = [];

    for await (const event of adapter.resume({
      problem: "이차함수 y = x^2 - 4x + 3의 최솟값을 구하시오.",
      workLines: [{ lineNo: 1, latex: "y = x^2 - 4x + 3", isLowConfidence: false }],
      diagnosis: BASE_DIAGNOSIS,
      mode: "own",
      grade: "M2",
    })) {
      events.push(event);
    }

    expect(events[0]).toEqual({ delta: "## 해법\n완전제곱식\n\n" });
    expect(events[1]).toEqual({ delta: "## 이어풀기\n다음 단계는...\n\n" });
    expect(events[2]).toEqual({ delta: "## 최종 답\n최솟값은 -1입니다." });

    const done = events[3] as { done: true; result: { mode: string; methodName: string; solutionMd: string; answerMd: string; verified: boolean } };
    expect(done.done).toBe(true);
    expect(done.result.mode).toBe("own");
    expect(done.result.methodName).toBe("완전제곱식");
    expect(done.result.solutionMd).toBe("다음 단계는...");
    expect(done.result.answerMd).toBe("최솟값은 -1입니다.");
    expect(done.result.verified).toBe(false);

    const callArgs = createMock.mock.calls[0]?.[0] as RequestInput;
    expect(callArgs.model).toBe("test-model");
    expect(callArgs.stream).toBe(true);

    const userMessage = callArgs.input.find((m) => m.role === "user");
    expect(typeof userMessage?.content).toBe("string");
    expect(userMessage?.content as string).toContain("완전제곱식");
  });

  it("mode가 alternative이면 result.mode도 alternative다", async () => {
    async function* fakeStream() {
      await Promise.resolve();
      yield { type: "response.output_text.delta", delta: "## 해법\n판별식\n\n## 이어풀기\n다른 방법으로...\n\n## 최종 답\n최솟값은 -1입니다." };
      yield { type: "response.completed" };
    }
    createMock.mockResolvedValue(fakeStream());

    const adapter = new OpenAIAdapter("test-model", "test-key");
    const events: ResumeStreamEvent[] = [];

    for await (const event of adapter.resume({
      problem: "이차함수 y = x^2 - 4x + 3의 최솟값을 구하시오.",
      workLines: [{ lineNo: 1, latex: "y = x^2 - 4x + 3", isLowConfidence: false }],
      diagnosis: BASE_DIAGNOSIS,
      mode: "alternative",
      grade: "M2",
    })) {
      events.push(event);
    }

    const done = events[events.length - 1] as { done: true; result: { mode: string } };
    expect(done.done).toBe(true);
    expect(done.result.mode).toBe("alternative");
  });
});
