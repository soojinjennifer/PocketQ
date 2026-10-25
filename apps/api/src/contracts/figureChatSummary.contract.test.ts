/**
 * Stage 5 WU4 — `buildFigureChatSummary`(packages/validation `figures/chatSummary.ts`) 계약.
 * - F01~F09 단계별(최종·1..N·N+1) 요약 스냅샷(결정적)
 * - 파생점 좌표 = fixture의 손 계산값(`expected.points`, 커널 비호출 독립 계산)
 * - F09 단계 상태를 손으로 쓴 기대값과 비교(표시·강조·비강조·숨김)
 * - 상한: 도형당 ≤3,000자(초과 시 description만), 합계 ≤6,000자
 * - 라벨 안전: 검증을 우회한 악성 라벨은 요약에 0
 */
import { describe, expect, it } from "vitest";
import type { FigureSpec } from "shared-types";
import {
  buildFigureChatSummaries,
  buildFigureChatSummary,
  CHAT_FIGURE_SUMMARY_MAX_CHARS,
  CHAT_FIGURES_TOTAL_MAX_CHARS,
  parseSolutionFigures,
  stepStateAt,
} from "validation";
import { F09_STEPWISE_AUXILIARY, VALID_FIGURE_FIXTURES } from "validation/fixtures";

function spec(raw: unknown): FigureSpec {
  const parsed = parseSolutionFigures({ figures: [raw] });
  const figure = parsed.figures[0];
  if (!figure) throw new Error(`fixture rejected: ${JSON.stringify(parsed.rejected)}`);
  return figure;
}

function maxStep(figure: FigureSpec): number {
  return Math.max(0, ...figure.steps.map((s) => Number(s.stepId.slice(1))));
}

describe("F01~F09 단계별 요약", () => {
  it.each(VALID_FIGURE_FIXTURES.map((f) => [f.id, f] as const))("%s 스냅샷(최종·1..N+1), 결정적", (_id, fixture) => {
    const figure = spec(fixture.raw);
    const positions: (number | null)[] = [null];
    for (let k = 1; k <= maxStep(figure) + 1; k += 1) positions.push(k);
    const summaries = positions.map((k) => buildFigureChatSummary(figure, k));
    expect(summaries).toMatchSnapshot();
    expect(JSON.stringify(positions.map((k) => buildFigureChatSummary(figure, k)))).toBe(JSON.stringify(summaries));
    for (const summary of summaries) {
      expect(summary.truncated).toBeUndefined();
      expect(JSON.stringify(summary).length).toBeLessThanOrEqual(CHAT_FIGURE_SUMMARY_MAX_CHARS);
    }
  });

  it.each(
    VALID_FIGURE_FIXTURES.filter((f) => (f.expected?.points?.length ?? 0) > 0).map((f) => [f.id, f] as const),
  )("%s 점 좌표 = 손 계산값(소수 셋째 자리)", (_id, fixture) => {
    const summary = buildFigureChatSummary(spec(fixture.raw), null);
    for (const point of fixture.expected?.points ?? []) {
      const element = summary.elements?.find((e) => e.id === point.id);
      expect(element?.point?.x).toBeCloseTo(point.x, 3);
      expect(element?.point?.y).toBeCloseTo(point.y, 3);
    }
  });

  it("F09 단계 상태 — 손으로 쓴 기대값", () => {
    const figure = spec(F09_STEPWISE_AUXILIARY.raw);
    const view = (k: number | null) =>
      Object.fromEntries(
        (buildFigureChatSummary(figure, k).elements ?? []).map((e) => [e.id, e.visible ? (e.emphasis ?? "?") : "hidden"]),
      );
    const given = { A: "dim", B: "dim", C: "dim" };
    expect(view(1)).toEqual({
      ...given,
      segBC: "highlight",
      segAB: "highlight",
      segAC: "highlight",
      H: "hidden",
      segAH: "hidden",
      angAHC: "hidden",
      M: "hidden",
      segAM: "hidden",
    });
    expect(view(2)).toEqual({
      ...given,
      segBC: "dim",
      segAB: "dim",
      segAC: "dim",
      H: "highlight",
      segAH: "highlight",
      angAHC: "highlight",
      M: "hidden",
      segAM: "hidden",
    });
    expect(view(3)).toEqual({
      ...given,
      segBC: "dim",
      segAB: "dim",
      segAC: "dim",
      H: "dim",
      segAH: "dim",
      angAHC: "hidden",
      M: "highlight",
      segAM: "highlight",
    });
    // 도형 steps에 없는 단계 4: 누적 상태, 강조 없음.
    expect(view(4)).toEqual({
      A: "default",
      B: "default",
      C: "default",
      segBC: "default",
      segAB: "default",
      segAC: "default",
      H: "default",
      segAH: "default",
      angAHC: "hidden",
      M: "default",
      segAM: "default",
    });
    expect(view(null)).toEqual(view(4));
    const h = buildFigureChatSummary(figure, 2).elements?.find((e) => e.id === "H");
    expect(h).toMatchObject({ type: "foot", refs: ["A", "segBC"], role: "auxiliary", point: { x: 0, y: 0 } });
    expect(buildFigureChatSummary(figure, 2).constraints).toEqual([
      { type: "perpendicular", source: "derived", targets: ["segAH", "segBC"] },
      { type: "collinear", source: "derived", targets: ["B", "H", "C"] },
    ]);
    expect(stepStateAt(figure, "final").get("angAHC")).toEqual({ visible: false });
  });
});

describe("상한", () => {
  const bigRaw = {
    ...(F09_STEPWISE_AUXILIARY.raw as Record<string, unknown>),
    figureId: "fig-big",
    description: "가".repeat(500),
    interaction: { mode: "fixed" },
    elements: Array.from({ length: 60 }, (_, i) => ({ id: `Point${i}`, type: "point", label: `P${i}`, role: "given", appearAt: null, x: (i % 8) * 0.5 - 2, y: Math.floor(i / 8) * 0.4 - 0.5 })),
    constraints: [],
    steps: [],
  };

  it("도형 하나가 3,000자를 넘으면 요소·제약을 빼고 description만(truncated)", () => {
    const summary = buildFigureChatSummary(spec(bigRaw), null);
    expect(summary).toEqual({ figureId: "fig-big", kind: "geometry", description: "가".repeat(500), step: "final", truncated: true });
  });

  it("합계 6,000자 이하 — 넘으면 뒤 도형부터 description만", () => {
    const mid = spec({
      ...bigRaw,
      description: "중간 크기 도형",
      elements: (bigRaw.elements as unknown[]).slice(0, 18),
    });
    const figures = [mid, { ...mid, figureId: "fig-two" }, { ...mid, figureId: "fig-three" }];
    for (const one of figures) expect(JSON.stringify(buildFigureChatSummary(one, null)).length).toBeLessThanOrEqual(CHAT_FIGURE_SUMMARY_MAX_CHARS);
    const summaries = buildFigureChatSummaries(figures, null);
    expect(JSON.stringify(summaries).length).toBeLessThanOrEqual(CHAT_FIGURES_TOTAL_MAX_CHARS);
    expect(summaries[0]?.elements).toBeDefined();
    expect(summaries.at(-1)?.truncated).toBe(true);
    expect(summaries.map((s) => s.figureId)).toEqual(["fig-big", "fig-two", "fig-three"]);
  });
});

describe("라벨 안전", () => {
  it("검증을 우회해 들어온 악성 라벨은 요약에서 null(요소 자체·좌표는 유지)", () => {
    const figure = spec(F09_STEPWISE_AUXILIARY.raw);
    const tampered: FigureSpec = {
      ...figure,
      elements: figure.elements.map((e, i) =>
        i === 0 ? { ...e, label: "<img src=x onerror=1>" } : i === 1 ? { ...e, label: "B‮X" } : i === 2 ? { ...e, label: "C\u0000" } : e,
      ),
    };
    const summary = buildFigureChatSummary(tampered, null);
    const labels = (summary.elements ?? []).map((e) => e.label);
    expect(labels.slice(0, 3)).toEqual([null, null, null]);
    const json = JSON.stringify(summary);
    expect(json).not.toContain("<img");
    expect(json).not.toContain("‮");
    expect(summary.elements?.[0]?.point).toEqual({ x: 0, y: 3 });
  });
});
