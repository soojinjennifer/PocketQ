/**
 * Stage 4 D-1·D-2 — 탐색 자격 판정(`docs/FIGURE_DESIGN.md` §17.15). fixture 중 F09만 자격.
 * 탐색 UI(WU9)는 구현하지 않는다 — "처음 모양으로"(초기화) 버튼은 미이행(오너 D-1).
 */
import { describe, expect, it } from "vitest";
import type { FigureSpec } from "shared-types";
import { F02_FOOT_OF_PERPENDICULAR, F09_STEPWISE_AUXILIARY, VALID_FIGURE_FIXTURES } from "validation/fixtures";
import { checkExploreEligibility, checkExplorePosition, dependencyClosure } from "./exploreEligibility";
import { loadFixture } from "./testFixtures";

function f09(): FigureSpec {
  return loadFixture(F09_STEPWISE_AUXILIARY.raw).spec;
}

describe("checkExploreEligibility", () => {
  it("F01~F09 중 F09만 자격이 있다", () => {
    const eligible = VALID_FIGURE_FIXTURES.filter((fixture) => checkExploreEligibility(loadFixture(fixture.raw).spec).eligible).map((f) => f.id);
    expect(eligible).toEqual(["F09"]);
  });

  it("F09 폐포 = A + A에 직간접 의존하는 요소(H·AH·∠AHC·AB·AC·AM), B·C·BC·M은 제외", () => {
    expect(dependencyClosure(f09(), ["A"])).toEqual(["A", "segAB", "segAC", "H", "segAH", "angAHC", "segAM"]);
    const verdict = checkExploreEligibility(f09());
    expect(verdict).toEqual({ eligible: true, draggable: ["A"], closure: ["A", "segAB", "segAC", "H", "segAH", "angAHC", "segAM"] });
  });

  it("fixed 도형은 not_explore", () => {
    expect(checkExploreEligibility(loadFixture(F02_FOOT_OF_PERPENDICULAR.raw).spec)).toEqual({ eligible: false, reasons: ["not_explore"] });
  });

  it("폐포에 닿는 given 제약이 있으면 거부(derived는 허용)", () => {
    const spec = f09();
    const given = { ...spec, constraints: [...spec.constraints, { type: "length" as const, source: "given" as const, segment: "segAB", value: Math.sqrt(13) }] };
    expect(checkExploreEligibility(given)).toEqual({ eligible: false, reasons: ["given_constraint_in_closure"] });
    // 폐포 밖(segBC) given 제약은 영향 없음.
    const outside = { ...spec, constraints: [...spec.constraints, { type: "length" as const, source: "given" as const, segment: "segBC", value: 6 }] };
    expect(checkExploreEligibility(outside).eligible).toBe(true);
  });

  it("폐포에 수치 라벨(showLength·showMeasure)이 있으면 거부", () => {
    const spec = f09();
    const withLength = { ...spec, elements: spec.elements.map((e) => (e.id === "segAH" && e.type === "segment" ? { ...e, showLength: true } : e)) };
    expect(checkExploreEligibility(withLength)).toEqual({ eligible: false, reasons: ["measure_label_in_closure"] });
  });

  it("derived 수직으로 보장되지 않는 직각 표시는 거부(F09 ∠AHC는 수선의 발이라 허용)", () => {
    const spec = f09();
    const extra = {
      ...spec,
      elements: [
        ...spec.elements,
        { id: "angBAC", type: "angle" as const, label: null, role: "auxiliary" as const, appearAt: null, points: ["B", "A", "C"] as [string, string, string], showMeasure: false, rightAngleMark: true },
      ],
    };
    expect(checkExploreEligibility(extra)).toEqual({ eligible: false, reasons: ["unguaranteed_right_angle"] });
  });

  it("축이 보이거나, 끄는 점이 자유 점이 아니면 거부", () => {
    const spec = f09();
    expect(checkExploreEligibility({ ...spec, axes: { visible: true, xLabel: "x", yLabel: "y" } })).toEqual({ eligible: false, reasons: ["axes_visible"] });
    expect(checkExploreEligibility({ ...spec, interaction: { mode: "explore", draggable: ["H"] } })).toEqual({
      eligible: false,
      reasons: ["draggable_not_free_point"],
    });
  });
});

describe("checkExplorePosition(탐색 중 매 프레임 판정)", () => {
  const PX = 40; // px/단위 → 여백 12px = 0.3단위

  it("정상 위치는 허용", () => {
    expect(checkExplorePosition(f09(), "A", { x: 0.5, y: 2.5 }, PX)).toEqual({ ok: true });
  });

  it("명세 boundingBox 안쪽 12px 밖이면 거부", () => {
    expect(checkExplorePosition(f09(), "A", { x: 0, y: 3.9 }, PX)).toEqual({ ok: false, reason: "out_of_bounds" });
  });

  it("A가 직선 BC 위로 내려오면(삼각형이 한 직선, H = A) 거부 — 의미 검증 단계에서 걸린다", () => {
    expect(checkExplorePosition(f09(), "A", { x: 1, y: 0 }, PX)).toEqual({ ok: false, reason: "invalid" });
  });

  it("의미 검증은 통과하지만 점이 일치하면(A.x = 1 → 수선의 발 H = 중점 M) 퇴화로 거부", () => {
    expect(checkExplorePosition(f09(), "A", { x: 1, y: 2.5 }, PX)).toEqual({ ok: false, reason: "degenerate" });
  });

  it("점 일치(A = B)면 거부", () => {
    const verdict = checkExplorePosition(f09(), "A", { x: -2, y: 0 }, PX);
    expect(verdict.ok).toBe(false);
  });
});
