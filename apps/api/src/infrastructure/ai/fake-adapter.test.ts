import { describe, expect, it } from "vitest";
import type { Diagnosis, ResumeStreamEvent } from "shared-types";
import { FakeLLMAdapter } from "./fake-adapter";
import type { SolveStreamEvent } from "./adapter";

async function collect(iterable: AsyncIterable<SolveStreamEvent>): Promise<SolveStreamEvent[]> {
  const events: SolveStreamEvent[] = [];
  for await (const event of iterable) {
    events.push(event);
  }
  return events;
}

async function collectResume(iterable: AsyncIterable<ResumeStreamEvent>): Promise<ResumeStreamEvent[]> {
  const events: ResumeStreamEvent[] = [];
  for await (const event of iterable) {
    events.push(event);
  }
  return events;
}

const BASE_DIAGNOSIS: Diagnosis = {
  lastValidLine: 2,
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
};

describe("FakeLLMAdapter", () => {
  it("recognizeProblem은 이미지 내용과 무관하게 고정된 더미 문제를 반환한다", async () => {
    const adapter = new FakeLLMAdapter();

    const result = await adapter.recognizeProblem(Buffer.from("anything"), "M2");

    expect(result.recognizedText.length).toBeGreaterThan(0);
    expect(typeof result.recognizedLatex).toBe("string");
  });

  it("recognizeProblem 결과는 어떤 이미지를 넣어도 항상 동일하다", async () => {
    const adapter = new FakeLLMAdapter();

    const a = await adapter.recognizeProblem(Buffer.from("image-a"), "M1");
    const b = await adapter.recognizeProblem(Buffer.from("completely-different-image"), "H3");

    expect(a).toEqual(b);
  });

  it("solve는 delta 청크들을 먼저 yield하고 마지막에 done + result를 yield한다", async () => {
    const adapter = new FakeLLMAdapter("claude", "fake-model-1");

    const events = await collect(
      adapter.solve({
        problem: { recognizedText: "1+1=?", recognizedLatex: null },
        options: { concept: true, solution: true },
        grade: "M2",
      }),
    );

    expect(events.length).toBeGreaterThan(1);

    const last = events[events.length - 1];
    expect(last).toBeDefined();
    expect(last && "done" in last && last.done).toBe(true);

    const deltas = events.slice(0, -1);
    for (const event of deltas) {
      expect("delta" in event).toBe(true);
    }

    if (last && "done" in last) {
      expect(last.result.aiProvider).toBe("claude");
      expect(last.result.aiModel).toBe("fake-model-1");
      expect(last.result.conceptMd).not.toBeNull();
      expect(last.result.solutionMd).not.toBeNull();
      expect(last.result.answerMd.length).toBeGreaterThan(0);
      expect(Array.isArray(last.result.conceptTags)).toBe(true);
    }
  });

  it("options에서 concept/solution이 false면 해당 md는 null이다", async () => {
    const adapter = new FakeLLMAdapter();

    const events = await collect(
      adapter.solve({
        problem: { recognizedText: "1+1=?", recognizedLatex: null },
        options: { concept: false, solution: false },
        grade: "M2",
      }),
    );

    const last = events[events.length - 1];
    expect(last && "done" in last).toBe(true);
    if (last && "done" in last) {
      expect(last.result.conceptMd).toBeNull();
      expect(last.result.solutionMd).toBeNull();
      expect(last.result.answerMd.length).toBeGreaterThan(0);
    }
  });

  it("chat은 질문/문제/최초 풀이 컨텍스트를 반영한 결정적인 answerMd 문자열을 반환한다", async () => {
    const adapter = new FakeLLMAdapter();

    const answerMd = await adapter.chat({
      problem: { recognizedText: "1+1=?", recognizedLatex: null },
      solution: {
        conceptMd: null,
        solutionMd: null,
        answerMd: "2입니다.",
        conceptTags: [],
        aiProvider: "claude",
        aiModel: "fake-whymath-v0",
      },
      history: [{ role: "user", content: "이전 질문" }],
      question: "왜 2인가요?",
      grade: "M2",
    });

    expect(typeof answerMd).toBe("string");
    expect(answerMd).toContain("왜 2인가요?");
    expect(answerMd.length).toBeGreaterThan(0);
  });

  it("suggestQuestions는 문제/풀이 내용과 무관하게 고정된 문구 2개를 반환한다(Final QA MEDIUM-4)", async () => {
    const adapter = new FakeLLMAdapter();

    const questions = await adapter.suggestQuestions({
      problem: { recognizedText: "1+1=?", recognizedLatex: null },
      solution: {
        conceptMd: null,
        solutionMd: null,
        answerMd: "2입니다.",
        conceptTags: [],
        aiProvider: "claude",
        aiModel: "fake-whymath-v0",
      },
      grade: "M2",
    });

    expect(questions).toHaveLength(2);
    for (const question of questions) {
      expect(typeof question).toBe("string");
      expect(question.length).toBeGreaterThan(0);
    }
  });

  it("recognizeWork는 이미지 내용과 무관하게 고정된 학생 풀이 줄들을 반환한다", async () => {
    const adapter = new FakeLLMAdapter();

    const a = await adapter.recognizeWork(Buffer.from("image-a"), "M2");
    const b = await adapter.recognizeWork(Buffer.from("completely-different"), "H3");

    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(0);
    for (const line of a) {
      expect(typeof line.lineNo).toBe("number");
      expect(typeof line.latex).toBe("string");
      expect(typeof line.isLowConfidence).toBe("boolean");
    }
  });

  describe("diagnose", () => {
    it("모든 줄이 valid면 마지막 줄까지 lastValidLine으로, stallLine/errorTypeLabel은 null로 반환한다", async () => {
      const adapter = new FakeLLMAdapter();

      const diagnosis = await adapter.diagnose({
        problem: "1+1=?",
        workLines: [
          { lineNo: 1, latex: "a", isLowConfidence: false },
          { lineNo: 2, latex: "b", isLowConfidence: false },
        ],
        casVerification: [
          { lineNo: 1, isValid: true },
          { lineNo: 2, isValid: true },
        ],
        grade: "M2",
      });

      expect(diagnosis.lastValidLine).toBe(2);
      expect(diagnosis.stallLine).toBeNull();
      expect(diagnosis.errorTypeLabel).toBeNull();
      expect(diagnosis.reachedAnswerWithNotes).toBe(false);
      expect(diagnosis.identifiedMethod).toEqual({ methodId: "perfect-square", methodName: "완전제곱식" });
      expect(diagnosis.isMethodApplicable).toBe(true);
      expect(diagnosis.methodApplicabilityNote).toBeNull();
    });

    it("첫 isValid:false 줄 직전까지를 lastValidLine, 그 줄을 stallLine으로 반환한다", async () => {
      const adapter = new FakeLLMAdapter();

      const diagnosis = await adapter.diagnose({
        problem: "1+1=?",
        workLines: [
          { lineNo: 1, latex: "a", isLowConfidence: false },
          { lineNo: 2, latex: "b", isLowConfidence: false },
          { lineNo: 3, latex: "c", isLowConfidence: false },
        ],
        casVerification: [
          { lineNo: 1, isValid: true },
          { lineNo: 2, isValid: false },
          { lineNo: 3, isValid: true },
        ],
        grade: "M2",
      });

      expect(diagnosis.lastValidLine).toBe(1);
      expect(diagnosis.stallLine).toBe(2);
      expect(diagnosis.errorTypeLabel).not.toBeNull();
    });

    it("casVerification이 빈 배열이면 lastValidLine 0을 반환한다", async () => {
      const adapter = new FakeLLMAdapter();

      const diagnosis = await adapter.diagnose({
        problem: "1+1=?",
        workLines: [],
        casVerification: [],
        grade: "M2",
      });

      expect(diagnosis.lastValidLine).toBe(0);
      expect(diagnosis.stallLine).toBeNull();
    });
  });

  describe("resume", () => {
    it("mode가 own이면 delta 청크들을 먼저 yield하고 마지막에 done + result(mode: own)를 yield한다", async () => {
      const adapter = new FakeLLMAdapter();

      const events = await collectResume(
        adapter.resume({
          problem: "이차함수 y = x^2 - 4x + 3의 최솟값을 구하시오.",
          workLines: [{ lineNo: 1, latex: "y = x^{2} - 4x + 3", isLowConfidence: false }],
          diagnosis: BASE_DIAGNOSIS,
          mode: "own",
          grade: "M2",
        }),
      );

      expect(events.length).toBeGreaterThan(1);

      const last = events[events.length - 1];
      expect(last && "done" in last && last.done).toBe(true);
      if (last && "done" in last) {
        expect(last.result.mode).toBe("own");
        expect(last.result.methodName.length).toBeGreaterThan(0);
        expect(last.result.solutionMd.length).toBeGreaterThan(0);
        expect(last.result.answerMd.length).toBeGreaterThan(0);
      }

      const deltas = events.slice(0, -1);
      for (const event of deltas) {
        expect("delta" in event).toBe(true);
      }
    });

    it("mode가 alternative이면 result.mode도 alternative다", async () => {
      const adapter = new FakeLLMAdapter();

      const events = await collectResume(
        adapter.resume({
          problem: "이차함수 y = x^2 - 4x + 3의 최솟값을 구하시오.",
          workLines: [{ lineNo: 1, latex: "y = x^{2} - 4x + 3", isLowConfidence: false }],
          diagnosis: BASE_DIAGNOSIS,
          mode: "alternative",
          grade: "M2",
        }),
      );

      const last = events[events.length - 1];
      expect(last && "done" in last).toBe(true);
      if (last && "done" in last) {
        expect(last.result.mode).toBe("alternative");
      }
    });
  });
});
