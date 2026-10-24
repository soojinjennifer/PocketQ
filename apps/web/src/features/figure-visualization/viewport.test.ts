import { describe, expect, it } from "vitest";
import { F01_TRIANGLE_ANGLE, F05_CIRCLE_TANGENT, F06_COORDINATE_LINES, F07_QUADRATIC } from "validation/fixtures";
import { geometryRaw, loadFixture, point } from "./testFixtures";
import {
  VIEWPORT_EDGE_PADDING_PX,
  VIEWPORT_LABEL_SPACE_PX,
  VIEWPORT_MAX_HEIGHT,
  VIEWPORT_MIN_HEIGHT,
  computeViewport,
  contentBounds,
  type FigureViewport,
} from "./viewport";

const WIDTH = 348;

/** 이전 규칙(§7.3 원안): 높이 = 폭 × bbox 세로/가로, [180, 360]. 비교 기준. */
function legacyHeight(boundingBox: [number, number, number, number], width: number): number {
  const [left, top, right, bottom] = boundingBox;
  return Math.min(Math.max((width * (top - bottom)) / (right - left), 180), 360);
}

function pxPerUnit(viewport: FigureViewport): { x: number; y: number } {
  const [left, top, right, bottom] = viewport.boundingBox;
  return { x: viewport.width / (right - left), y: viewport.height / (top - bottom) };
}

/** 모든 내용 점이 보드 안에 있고 가장자리에서 최소 `marginPx`만큼 떨어져 있다. */
function expectInside(viewport: FigureViewport, points: { x: number; y: number }[], marginPx: number): void {
  const [left, top, right, bottom] = viewport.boundingBox;
  const unit = pxPerUnit(viewport);
  for (const p of points) {
    expect((p.x - left) * unit.x).toBeGreaterThanOrEqual(marginPx - 1e-6);
    expect((right - p.x) * unit.x).toBeGreaterThanOrEqual(marginPx - 1e-6);
    expect((top - p.y) * unit.y).toBeGreaterThanOrEqual(marginPx - 1e-6);
    expect((p.y - bottom) * unit.y).toBeGreaterThanOrEqual(marginPx - 1e-6);
  }
}

describe("computeViewport — 내용 맞춤 높이(오너 변경 2026-10-24)", () => {
  it("폭이 0이면 null(보드를 만들지 않음)", () => {
    const { spec, resolved } = loadFixture(F01_TRIANGLE_ANGLE.raw);
    expect(computeViewport(spec, resolved, 0)).toBeNull();
  });

  it("납작한 도형: 높이가 이전 규칙보다 줄고 하한 120px에 맞춘다", () => {
    const raw = geometryRaw("fig-flat", [-1, 6, 11, -5], [point("A", 0, 0), point("B", 10, 0), point("C", 5, 1)]);
    const { spec, resolved } = loadFixture(raw);
    const viewport = computeViewport(spec, resolved, WIDTH);
    if (viewport === null) throw new Error("viewport");
    expect(viewport.basis).toBe("content");
    expect(viewport.height).toBe(VIEWPORT_MIN_HEIGHT);
    expect(viewport.height).toBeLessThan(legacyHeight(spec.boundingBox, WIDTH));
    expectInside(viewport, [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 1 }], VIEWPORT_EDGE_PADDING_PX);
  });

  it("세로로 긴 도형: 상한 360px에 걸리면 가로를 대칭 확장한다(같은 단위 비율)", () => {
    const raw = geometryRaw("fig-tall", [-1, 11, 2, -1], [point("A", 0, 0), point("B", 1, 0), point("C", 0.5, 10)]);
    const { spec, resolved } = loadFixture(raw);
    const viewport = computeViewport(spec, resolved, WIDTH);
    if (viewport === null) throw new Error("viewport");
    expect(viewport.height).toBe(VIEWPORT_MAX_HEIGHT);
    const unit = pxPerUnit(viewport);
    expect(unit.x).toBeCloseTo(unit.y, 9);
    const [left, , right] = viewport.boundingBox;
    // 내용 가로 중심(0.5)을 기준으로 대칭.
    expect((left + right) / 2).toBeCloseTo(0.5, 9);
    expect(right - left).toBeGreaterThan(spec.boundingBox[2] - spec.boundingBox[0]);
    expectInside(viewport, [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0.5, y: 10 }], VIEWPORT_EDGE_PADDING_PX);
  });

  it("명세 bbox가 내용의 3배: 여백을 덜어 높이가 줄어든다", () => {
    // 내용 4×2, 명세 bbox 12×12(가로·세로 모두 내용의 3배 이상).
    const raw = geometryRaw("fig-roomy", [-4, 7, 8, -5], [point("A", 0, 0), point("B", 4, 0), point("C", 4, 2), point("D", 0, 2)]);
    const { spec, resolved } = loadFixture(raw);
    const viewport = computeViewport(spec, resolved, WIDTH);
    if (viewport === null) throw new Error("viewport");
    expect(legacyHeight(spec.boundingBox, WIDTH)).toBe(WIDTH);
    expect(viewport.height).toBeLessThan(WIDTH * 0.7);
    expect(viewport.height).toBeGreaterThanOrEqual(VIEWPORT_MIN_HEIGHT);
    // 내용 + 라벨 여백(12 + 20px)이 모두 보인다.
    expectInside(
      viewport,
      [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 2 }, { x: 0, y: 2 }],
      VIEWPORT_EDGE_PADDING_PX + VIEWPORT_LABEL_SPACE_PX - 1,
    );
    // 보이는 영역이 명세 bbox(+12px)보다 크지 않다(높이 하한에 걸리지 않은 경우).
    const unit = pxPerUnit(viewport);
    const [left, top, right, bottom] = viewport.boundingBox;
    expect(left).toBeGreaterThanOrEqual(spec.boundingBox[0] - VIEWPORT_EDGE_PADDING_PX / unit.x - 1e-9);
    expect(right).toBeLessThanOrEqual(spec.boundingBox[2] + VIEWPORT_EDGE_PADDING_PX / unit.x + 1e-9);
    expect(top).toBeLessThanOrEqual(spec.boundingBox[1] + VIEWPORT_EDGE_PADDING_PX / unit.y + 1e-9);
    expect(bottom).toBeGreaterThanOrEqual(spec.boundingBox[3] - VIEWPORT_EDGE_PADDING_PX / unit.y - 1e-9);
  });

  it("geometry는 항상 같은 단위 비율이고 높이는 정수 px, [120, 360]", () => {
    for (const fixture of [F01_TRIANGLE_ANGLE, F05_CIRCLE_TANGENT]) {
      const { spec, resolved } = loadFixture(fixture.raw);
      for (const width of [200, 348, 380, 676, 708, 1200]) {
        const viewport = computeViewport(spec, resolved, width);
        if (viewport === null) throw new Error("viewport");
        const unit = pxPerUnit(viewport);
        expect(unit.x).toBeCloseTo(unit.y, 9);
        expect(Number.isInteger(viewport.height)).toBe(true);
        expect(viewport.height).toBeGreaterThanOrEqual(VIEWPORT_MIN_HEIGHT);
        expect(viewport.height).toBeLessThanOrEqual(VIEWPORT_MAX_HEIGHT);
      }
    }
  });

  it("F05 원 전체(중심 ± 반지름)와 원 밖의 점 P가 잘리지 않는다", () => {
    const { spec, resolved } = loadFixture(F05_CIRCLE_TANGENT.raw);
    const viewport = computeViewport(spec, resolved, WIDTH);
    if (viewport === null) throw new Error("viewport");
    expectInside(viewport, [{ x: -2, y: 0 }, { x: 2, y: 2 }, { x: 0, y: -2 }, { x: 4, y: 0 }], VIEWPORT_EDGE_PADDING_PX);
  });

  it("축이 보이는 도형(F06 geometry, F07 function)은 명세 bbox를 기준으로 한다", () => {
    const f06 = loadFixture(F06_COORDINATE_LINES.raw);
    expect(computeViewport(f06.spec, f06.resolved, WIDTH)?.basis).toBe("spec");
    const f07 = loadFixture(F07_QUADRATIC.raw);
    const viewport = computeViewport(f07.spec, f07.resolved, WIDTH);
    expect(viewport?.basis).toBe("spec");
    // function(keepAspectRatio false)은 4:3.
    expect(viewport?.height).toBe(Math.round(WIDTH * 0.75));
  });

  it("무한 직선·반직선·lineEquation은 내용 범위에서 빠진다", () => {
    const raw = geometryRaw("fig-lines", [-10, 10, 10, -10], [
      point("A", 0, 0),
      point("B", 1, 0),
      point("C", 0, 1),
      { id: "l", type: "line", label: null, role: "given", appearAt: null, through: ["A", "B"], showLength: false },
      { id: "e", type: "lineEquation", label: null, role: "given", appearAt: null, a: 1, b: 1, c: 9 },
    ]);
    const { resolved } = loadFixture(raw);
    expect(contentBounds(resolved)).toEqual({ left: 0, right: 1, bottom: 0, top: 1 });
  });
});
