import { describe, expect, it } from "vitest";
import {
  F01_TRIANGLE_ANGLE,
  F02_FOOT_OF_PERPENDICULAR,
  F07_QUADRATIC,
  F08_RATIONAL,
} from "validation/fixtures";
import { AXIS_PX, buildBoardScene, buildDecorations, formatTickLabel, niceTickStep, type SceneItem } from "./buildBoardScene";
import { geometryRaw, loadFixture, point } from "./testFixtures";

const OPTIONS = { pxPerUnit: { x: 40, y: 40 }, boundingBox: [-5, 5, 5, -5] as [number, number, number, number] };

function itemsOf(raw: unknown): SceneItem[] {
  const { spec, resolved } = loadFixture(raw);
  return buildBoardScene(spec, resolved, OPTIONS).items;
}

describe("buildBoardScene", () => {
  it("항목 순서는 명세 elements 순서를 따른다(장식 없음)", () => {
    const ids = itemsOf(F01_TRIANGLE_ANGLE.raw).map((item) => item.elementId);
    expect([...new Set(ids)]).toEqual(["A", "B", "C", "tri", "angA"]);
  });

  it("각은 검증기의 정규화 순서(반시계, 180° 이하)를 그대로 쓴다", () => {
    const angle = itemsOf(F02_FOOT_OF_PERPENDICULAR.raw).find((item) => item.kind === "angle");
    if (angle?.kind !== "angle") throw new Error("angle");
    // 명세는 [C, H, B]지만 외적이 음수라 [B, H, C].
    expect(angle.xy).toEqual([{ x: 6, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 4 }]);
    expect(angle.rightAngle).toBe(true);
    expect(angle.radiusPx).toBe(10);
  });

  it("함수 그래프는 샘플러 조각마다 curve 하나(F08 → 2개), 조각 값은 모두 유한", () => {
    const curves = itemsOf(F08_RATIONAL.raw).filter((item) => item.kind === "curve");
    expect(curves).toHaveLength(2);
    for (const curve of curves) {
      if (curve.kind !== "curve") continue;
      expect(curve.points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true);
    }
  });

  it("각도 수치 라벨은 formatFigureNumber(45°)", () => {
    const text = itemsOf(F01_TRIANGLE_ANGLE.raw).find((item) => item.kind === "text");
    expect(text?.kind === "text" ? text.text : null).toBe("45°");
  });

  it("길이 라벨: length 제약이 있으면 그 값, 없으면 ≈계산값", () => {
    const elements = [
      point("A", 0, 0),
      point("B", 3, 0),
      point("C", 0, 1),
      { id: "segAB", type: "segment", label: null, role: "given", appearAt: null, through: ["A", "B"], showLength: true },
      { id: "segBC", type: "segment", label: null, role: "given", appearAt: null, through: ["B", "C"], showLength: true },
    ];
    const raw = geometryRaw("fig-len", [-1, 2, 4, -1], elements, {
      constraints: [{ type: "length", source: "given", segment: "segAB", value: 3 }],
    });
    const texts = itemsOf(raw).filter((item) => item.kind === "text").map((item) => (item.kind === "text" ? item.text : ""));
    expect(texts).toEqual(["3", "≈3.16"]);
  });

  it("수선의 발이 선분 밖이면 가까운 끝점에서 발까지 연장선(§4.4)", () => {
    const raw = geometryRaw("fig-ext", [-1, 4, 6, -1], [
      point("A", 0, 0),
      point("B", 2, 0),
      point("C", 4, 3),
      { id: "segAB", type: "segment", label: null, role: "given", appearAt: null, through: ["A", "B"], showLength: false },
      { id: "H", type: "foot", label: "H", role: "auxiliary", appearAt: null, from: "C", to: "segAB" },
    ]);
    const extension = itemsOf(raw).find((item) => item.kind === "segment" && item.variant === "extension");
    expect(extension?.kind === "segment" ? [extension.p1, extension.p2] : null).toEqual([{ x: 2, y: 0 }, { x: 4, y: 0 }]);
    expect(extension?.elementId).toBe("H");
  });

  it("발이 선분 안이면 연장선이 없다(F02)", () => {
    expect(itemsOf(F02_FOOT_OF_PERPENDICULAR.raw).some((item) => item.kind === "segment" && item.variant === "extension")).toBe(false);
  });

  it("축·눈금: 0 눈금과 원점 O를 표시하지 않고, 음수는 U+2212, 축 이름 포함", () => {
    const items = itemsOf(F07_QUADRATIC.raw);
    expect(items.filter((item) => item.kind === "axis")).toHaveLength(2);
    const ticks = items.filter((item) => item.kind === "text" && item.textKind === "tick").map((item) => (item.kind === "text" ? item.text : ""));
    expect(ticks).not.toContain("0");
    expect(ticks).not.toContain("O");
    expect(ticks).toContain("−1");
    expect(ticks.some((text) => text.startsWith("-"))).toBe(false);
    const names = items.filter((item) => item.kind === "text" && item.textKind === "axisName").map((item) => (item.kind === "text" ? item.text : ""));
    expect(names).toEqual(["x", "y"]);
    expect(items.some((item) => item.kind === "grid")).toBe(true);
  });

  it("라벨의 양방향 제어문자를 렌더러에서도 지운다", () => {
    const { spec, resolved } = loadFixture(F01_TRIANGLE_ANGLE.raw);
    const tampered = { ...spec, elements: spec.elements.map((element) => (element.id === "A" ? { ...element, label: "A‮x" } : element)) };
    const pointA = buildBoardScene(tampered, resolved, OPTIONS).items.find((item) => item.kind === "point" && item.elementId === "A");
    expect(pointA?.kind === "point" ? pointA.label : null).toBe("Ax");
  });

  it("눈금 간격은 1·2·5 계열에서 화면 32px 이상", () => {
    expect(niceTickStep(40)).toBe(1);
    expect(niceTickStep(20)).toBe(2);
    expect(niceTickStep(10)).toBe(5);
    expect(niceTickStep(100)).toBe(0.5);
    expect(formatTickLabel(-2.5)).toBe("−2.5");
  });
});

describe("장식(재작업 1: P2-1·P2-2·P3-1, F07 눈금 겹침)", () => {
  it("F07: 강조된 점 R1(1,0)·R2(3,0)과 겹치는 눈금 숫자 1·3은 생략한다", () => {
    // x축 눈금(기준점 y = 0)만 본다 — y축 눈금 "1"은 R1과 떨어져 있다.
    const xTicks = itemsOf(F07_QUADRATIC.raw)
      .filter((item) => item.kind === "text" && item.textKind === "tick" && "base" in item.position && item.position.base.y === 0)
      .map((item) => (item.kind === "text" ? item.text : ""));
    expect(xTicks).not.toContain("1");
    expect(xTicks).not.toContain("3");
    expect(xTicks).toContain("4");
  });

  it("보드 가장자리 12px 띠 안에 들어가는 눈금 숫자는 그리지 않는다", () => {
    const { spec, resolved } = loadFixture(F07_QUADRATIC.raw);
    // 폭 400px, 단위 40px: x = −5, 5의 눈금 숫자는 가장자리에 걸린다.
    const scene = buildBoardScene(spec, resolved, OPTIONS);
    const xTicks = scene.decorations
      .filter((item) => item.kind === "text" && item.textKind === "tick" && "base" in item.position && item.position.base.y === 0)
      .map((item) => (item.kind === "text" && "base" in item.position ? item.position.base.x : NaN));
    expect(xTicks).not.toContain(-5);
    expect(xTicks).not.toContain(5);
    for (const x of xTicks) expect((x + 5) * 40).toBeGreaterThanOrEqual(12);
  });

  it("장식과 요소를 따로 돌려준다(장식만 다시 만들기 위해)", () => {
    const { spec, resolved } = loadFixture(F07_QUADRATIC.raw);
    const scene = buildBoardScene(spec, resolved, OPTIONS);
    expect(scene.decorations.every((item) => item.elementId === null)).toBe(true);
    expect(scene.elements.every((item) => item.elementId !== null)).toBe(true);
    expect(scene.items).toEqual([...scene.decorations, ...scene.elements]);
  });

  it("px/단위가 바뀌면 눈금 간격이 바뀐 장식이 나온다(P2-2)", () => {
    const { spec, resolved } = loadFixture(F07_QUADRATIC.raw);
    const scene = buildBoardScene(spec, resolved, OPTIONS);
    const narrow = buildDecorations(spec, scene.elements, { pxPerUnit: { x: 12, y: 12 }, boundingBox: OPTIONS.boundingBox }, 1);
    const grid = (items: SceneItem[]) => items.find((item) => item.kind === "grid");
    const wideGrid = grid(scene.decorations);
    const narrowGrid = grid(narrow);
    expect(wideGrid?.kind === "grid" ? wideGrid.xs.length : 0).toBeGreaterThan(narrowGrid?.kind === "grid" ? narrowGrid.xs.length : 0);
    expect(narrow.every((item) => item.key.startsWith("d1"))).toBe(true);
  });

  it("축 화살표·눈금 거리는 오너 승인 시안 값(P19)", () => {
    expect(AXIS_PX).toEqual({ arrowSize: 8, xTickGap: 5, yTickGap: 4.5, xNameOffset: { x: -5, y: 8 }, yNameOffset: { x: 7.5, y: -6 } });
  });
});

describe("격자 범위(재작업 1 화면 확인 중 발견)", () => {
  it("격자선은 바깥 눈금이 아니라 보드 전체 범위까지 긋는다", () => {
    const grid = itemsOf(F07_QUADRATIC.raw).find((item) => item.kind === "grid");
    expect(grid?.kind === "grid" ? grid.range : null).toEqual(OPTIONS.boundingBox);
  });
});
