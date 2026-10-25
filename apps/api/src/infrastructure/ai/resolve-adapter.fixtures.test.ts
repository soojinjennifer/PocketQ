/**
 * Stage 4 L-5(S4-L5) — 운영 경로(`resolveAdapter` → `FakeLLMAdapter`)가 테스트 전용 fixture 모듈(`validation/fixtures`)을
 * 로드하지 않는다. fixture는 Fake의 도형 시나리오(`generateFigures`/`repairFigure`)가 실제로 호출될 때만 지연 로드된다.
 * off 바이트 기준값은 `contracts/figuresOff.baseline.test.ts`가 그대로 확인한다.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

const fixtureLoads = vi.hoisted(() => ({ count: 0 }));
vi.mock("validation/fixtures", async (importOriginal) => {
  fixtureLoads.count += 1;
  return await importOriginal<typeof import("validation/fixtures")>();
});

const { resolveAdapter } = await import("./resolve-adapter");

describe("S4-L5 운영 경로 fixture 미로드", () => {
  it("fake-adapter.ts에 fixture 정적 import가 없다", () => {
    const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "fake-adapter.ts"), "utf8");
    expect(source).not.toMatch(/^import[^;]*from\s+["']validation\/fixtures["']/m);
  });

  it("resolveAdapter 기동 + 텍스트 경로(solve off/on·recognize) 동안 fixture 0회 로드, 도형 호출에서 처음 로드", async () => {
    const adapter = resolveAdapter();
    expect(adapter.constructor.name).toBe("FakeLLMAdapter");
    expect(fixtureLoads.count).toBe(0);

    await adapter.recognizeProblem(Buffer.from(""), "M2");
    const problem = { recognizedText: "문제", recognizedLatex: null };
    for await (const event of adapter.solve({ problem, options: { concept: true, solution: true }, grade: "M2" })) {
      void event;
    }
    for await (const event of adapter.solve({ problem, options: { concept: true, solution: true }, grade: "M2", stepMarkers: true })) {
      void event;
    }
    expect(fixtureLoads.count).toBe(0);

    const generated = await adapter.generateFigures({
      source: "solve",
      mode: null,
      grade: "M2",
      problemText: "문제",
      priorWork: null,
      solutionMd: null,
      answerMd: "-1",
      stepCount: null,
      signal: new AbortController().signal,
    });
    expect(fixtureLoads.count).toBe(1);
    expect((generated.raw as { figures: { figureId: string }[] }).figures[0]?.figureId).toBe("fig-f07");
  });
});
