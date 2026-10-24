import { describe, expect, it } from "vitest";
import {
  F02_FOOT_OF_PERPENDICULAR,
  F03_MIDPOINT_MEDIAN,
  F04_CIRCLE_CHORD,
  F05_CIRCLE_TANGENT,
  F07_QUADRATIC,
  F09_STEPWISE_AUXILIARY,
} from "validation/fixtures";
import type { FigureSpec } from "shared-types";
import type { ResolvedFigure, Vec2 } from "validation";
import { buildBoardScene, type SceneItem } from "./buildBoardScene";
import { blockedDirections, chooseLabelDirection, clearance, type PlacementScene } from "./labelPlacement";
import { sceneOptionsFor } from "./mountFigureBoard";
import { loadFixture } from "./testFixtures";
import { computeViewport } from "./viewport";

interface Box {
  left: number;
  right: number;
  bottom: number;
  top: number;
}

/** px 수학 좌표(y 위쪽 +)에서 점 라벨 상자. 글자 폭 15px × 0.62, 높이 20px. */
function labelBox(item: Extract<SceneItem, { kind: "point" }>, scale: { x: number; y: number }): Box {
  const width = [...(item.label ?? "")].length * 15 * 0.62 + 2;
  const height = 20;
  const ax = item.xy.x * scale.x + item.labelOffsetPx.x;
  const ay = item.xy.y * scale.y + item.labelOffsetPx.y;
  const left = item.labelAnchor[0] === "left" ? ax : item.labelAnchor[0] === "right" ? ax - width : ax - width / 2;
  const bottom = item.labelAnchor[1] === "bottom" ? ay : item.labelAnchor[1] === "top" ? ay - height : ay - height / 2;
  return { left, right: left + width, bottom, top: bottom + height };
}

function segmentHitsBox(a: Vec2, b: Vec2, box: Box): boolean {
  // 선분을 촘촘히 샘플해 상자 안에 들어가는 점이 있는지(테스트용 단순 판정).
  for (let i = 0; i <= 200; i += 1) {
    const t = i / 200;
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;
    if (x > box.left && x < box.right && y > box.bottom && y < box.top) return true;
  }
  return false;
}

/** 그려지는 선·원·곡선(px 수학 좌표)의 선분 목록. 직선은 보드 범위 안으로 자른다. */
function drawnSegments(resolved: ResolvedFigure, spec: FigureSpec, scale: { x: number; y: number }, span: number): [Vec2, Vec2][] {
  const px = (p: Vec2): Vec2 => ({ x: p.x * scale.x, y: p.y * scale.y });
  const segments: [Vec2, Vec2][] = [];
  for (const element of resolved.elements.values()) {
    if (element.kind === "line") {
      const d = { x: element.p2.x - element.p1.x, y: element.p2.y - element.p1.y };
      const from = element.type === "segment" || element.type === "ray" ? 0 : -span;
      const to = element.type === "segment" ? 1 : span;
      segments.push([px({ x: element.p1.x + d.x * from, y: element.p1.y + d.y * from }), px({ x: element.p1.x + d.x * to, y: element.p1.y + d.y * to })]);
    } else if (element.kind === "polygon") {
      element.vertices.forEach((v, i) => segments.push([px(v), px(element.vertices[(i + 1) % element.vertices.length] ?? v)]));
    } else if (element.kind === "circle") {
      for (let i = 0; i < 72; i += 1) {
        const a0 = (i * Math.PI) / 36;
        const a1 = ((i + 1) * Math.PI) / 36;
        segments.push([
          px({ x: element.center.x + element.radius * Math.cos(a0), y: element.center.y + element.radius * Math.sin(a0) }),
          px({ x: element.center.x + element.radius * Math.cos(a1), y: element.center.y + element.radius * Math.sin(a1) }),
        ]);
      }
    } else if (element.kind === "graph") {
      for (const piece of element.pieces) for (let i = 0; i + 1 < piece.length; i += 1) segments.push([px(piece[i] as Vec2), px(piece[i + 1] as Vec2)]);
    }
  }
  if (spec.axes.visible) {
    segments.push([px({ x: -span, y: 0 }), px({ x: span, y: 0 })], [px({ x: 0, y: -span }), px({ x: 0, y: span })]);
  }
  return segments;
}

function pointItems(raw: unknown, width = 348): { items: Extract<SceneItem, { kind: "point" }>[]; segments: [Vec2, Vec2][] } {
  const { spec, resolved } = loadFixture(raw);
  const viewport = computeViewport(spec, resolved, width);
  if (viewport === null) throw new Error("viewport");
  const options = sceneOptionsFor(viewport);
  const scene = buildBoardScene(spec, resolved, options);
  const items = scene.elements.filter((item): item is Extract<SceneItem, { kind: "point" }> => item.kind === "point");
  return { items, segments: drawnSegments(resolved, spec, options.pxPerUnit, resolved.scale * 10) };
}

describe("점 라벨 배치 — design-agent P1-2", () => {
  it.each([
    ["F02", F02_FOOT_OF_PERPENDICULAR.raw, ["A", "B", "C", "H"]],
    ["F03", F03_MIDPOINT_MEDIAN.raw, ["A", "B", "C", "M"]],
    ["F04", F04_CIRCLE_CHORD.raw, ["O", "A", "B", "M"]],
    ["F05", F05_CIRCLE_TANGENT.raw, ["O", "P", "T1", "T2"]],
    ["F07", F07_QUADRATIC.raw, ["V", "R1", "R2"]],
    ["F09", F09_STEPWISE_AUXILIARY.raw, ["A", "B", "C", "H", "M"]],
  ] as const)("%s: 라벨 상자가 어떤 선·원·곡선과도 겹치지 않는다", (_id, raw, ids) => {
    const { items, segments } = pointItems(raw);
    for (const id of ids) {
      const item = items.find((candidate) => candidate.elementId === id);
      if (item === undefined) throw new Error(`point ${id}`);
      const { spec, resolved } = loadFixture(raw);
      const viewport = computeViewport(spec, resolved, 348);
      if (viewport === null) throw new Error("viewport");
      const box = labelBox(item, sceneOptionsFor(viewport).pxPerUnit);
      const hit = segments.some(([a, b]) => segmentHitsBox(a, b, box));
      expect({ id, hit }).toEqual({ id, hit: false });
    }
  });

  it("선분 위의 점(F02 수선의 발 H)은 선분 법선 중 도형 바깥쪽(아래)으로", () => {
    const { items } = pointItems(F02_FOOT_OF_PERPENDICULAR.raw);
    const h = items.find((item) => item.elementId === "H");
    expect(h?.labelOffsetPx.y).toBeLessThan(0);
    expect(Math.abs(h?.labelOffsetPx.x ?? 1)).toBeLessThan(1e-9);
  });

  it("다각형 꼭짓점은 무게중심의 반대 방향(F03 A는 위쪽)", () => {
    const { items } = pointItems(F03_MIDPOINT_MEDIAN.raw);
    const a = items.find((item) => item.elementId === "A");
    expect(a?.labelOffsetPx.y).toBeGreaterThan(0);
  });

  it("원 위의 점(F05 T2)은 원 바깥쪽, 접선·중심 방향을 피한다", () => {
    const { items } = pointItems(F05_CIRCLE_TANGENT.raw);
    const t2 = items.find((item) => item.elementId === "T2");
    // T2 = (1, −√3): 바깥쪽 법선은 (1, −√3)/2 방향(오른쪽 아래).
    expect(t2?.labelOffsetPx.y).toBeLessThan(0);
    expect(t2?.labelOffsetPx.x).toBeGreaterThan(0);
  });

  it("막힌 방향과 최소 30° 이상 떨어진 방향을 고르고, 결과는 결정적이다", () => {
    const scene: PlacementScene = {
      lines: [
        { p1: { x: 0, y: 0 }, p2: { x: 1, y: 0 }, kind: "line" },
        { p1: { x: 0, y: 0 }, p2: { x: 0, y: 1 }, kind: "segment" },
      ],
      circles: [],
      curves: [],
      angles: [[{ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 }]],
      center: { x: 0, y: 1 },
    };
    const scale = { x: 40, y: 40 };
    const direction = chooseLabelDirection({ x: 0, y: 0 }, scene, scale);
    expect(clearance(direction, blockedDirections({ x: 0, y: 0 }, scene, scale))).toBeGreaterThanOrEqual(Math.PI / 6);
    // 직각 표시 사분면(오른쪽 위, 0°~90°)을 피한다.
    expect(direction.x < 0 || direction.y < 0).toBe(true);
    expect(chooseLabelDirection({ x: 0, y: 0 }, scene, scale)).toEqual(direction);
  });
});
