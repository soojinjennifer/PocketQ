import { describe, expect, it } from "vitest";
import { FakeLLMAdapter } from "./fake-adapter";
import type { SolveStreamEvent } from "./adapter";

async function collect(iterable: AsyncIterable<SolveStreamEvent>): Promise<SolveStreamEvent[]> {
  const events: SolveStreamEvent[] = [];
  for await (const event of iterable) {
    events.push(event);
  }
  return events;
}

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
});
