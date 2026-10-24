import { describe, expect, it } from "vitest";
import {
  FIGURE_PALETTE_TOKENS,
  angleArcStyle,
  extensionLineStyle,
  fillStyle,
  labelOpacity,
  lineStyle,
  pointStyle,
  readFigurePalette,
  type FigurePalette,
} from "./figureStyle";

const palette: FigurePalette = {
  ink: "INK",
  brand: "BRAND",
  teal: "TEAL",
  axis: "AXIS",
  grid: "GRID",
  underlay: "YELLOW",
  canvas: "CANVAS",
};

describe("figureStyle — FIGURE_DESIGN §3 매핑표(오너 승인 P1~P8)", () => {
  it.each([
    ["given", "default", "INK", 1, 0, 2],
    ["given", "highlight", "INK", 1, 0, 3],
    ["given", "dim", "INK", 0.65, 0, 2],
    ["auxiliary", "default", "BRAND", 1, 2, 1.5],
    ["auxiliary", "highlight", "BRAND", 1, 2, 2.5],
    ["auxiliary", "dim", "BRAND", 0.75, 2, 1.5],
    ["result", "default", "TEAL", 1, 0, 2.5],
    ["result", "highlight", "TEAL", 1, 0, 3.5],
    ["result", "dim", "TEAL", 0.85, 0, 2.5],
  ] as const)("선 %s/%s", (role, emphasis, color, opacity, dash, width) => {
    expect(lineStyle(role, emphasis, palette)).toEqual({ strokeColor: color, strokeOpacity: opacity, dash, strokeWidth: width });
  });

  it.each([
    ["given", "default", 3, "INK", 1, "CANVAS", 1, 1.5, null],
    ["given", "highlight", 4.5, "INK", 1, "CANVAS", 1, 1.5, 9],
    ["given", "dim", 3, "INK", 0.65, "CANVAS", 1, 1.5, null],
    ["auxiliary", "default", 3, "CANVAS", 1, "BRAND", 1, 1.5, null],
    ["auxiliary", "highlight", 4.5, "CANVAS", 1, "BRAND", 1, 2, 9],
    ["auxiliary", "dim", 3, "CANVAS", 1, "BRAND", 0.75, 1.5, null],
    ["result", "default", 4, "TEAL", 1, "CANVAS", 1, 1.5, null],
    ["result", "highlight", 5.5, "TEAL", 1, "CANVAS", 1, 1.5, 10],
    ["result", "dim", 4, "TEAL", 0.85, "CANVAS", 1, 1.5, null],
  ] as const)("점 %s/%s", (role, emphasis, size, fill, fillOpacity, stroke, strokeOpacity, strokeWidth, underlay) => {
    expect(pointStyle(role, emphasis, palette)).toEqual({
      size,
      fillColor: fill,
      fillOpacity,
      strokeColor: stroke,
      strokeOpacity,
      strokeWidth,
      underlaySize: underlay,
    });
  });

  it("채움 α(§3.3): 다각형 given 0.08/0.16/0.04, auxiliary 0, result 0.12/0.20/0.06, 각 0.12/0.24/0.06", () => {
    expect(fillStyle("given", "default", "polygon", palette)).toEqual({ fillColor: "BRAND", fillOpacity: 0.08 });
    expect(fillStyle("given", "highlight", "polygon", palette).fillOpacity).toBeCloseTo(0.16);
    expect(fillStyle("given", "dim", "polygon", palette).fillOpacity).toBeCloseTo(0.04);
    expect(fillStyle("auxiliary", "highlight", "polygon", palette).fillOpacity).toBe(0);
    expect(fillStyle("result", "default", "polygon", palette)).toEqual({ fillColor: "TEAL", fillOpacity: 0.12 });
    expect(fillStyle("result", "highlight", "angle", palette).fillOpacity).toBeCloseTo(0.2);
    expect(fillStyle("given", "default", "angle", palette)).toEqual({ fillColor: "BRAND", fillOpacity: 0.12 });
    expect(fillStyle("auxiliary", "highlight", "angle", palette).fillOpacity).toBeCloseTo(0.24);
    expect(fillStyle("auxiliary", "dim", "angle", palette).fillOpacity).toBeCloseTo(0.06);
  });

  it("각 호·연장선·라벨", () => {
    expect(angleArcStyle("auxiliary", "highlight", palette)).toEqual({ strokeColor: "BRAND", strokeOpacity: 1, dash: 2, strokeWidth: 2.5 });
    expect(angleArcStyle("given", "default", palette).strokeWidth).toBe(1.5);
    expect(extensionLineStyle("default", palette)).toEqual({ strokeColor: "BRAND", strokeOpacity: 1, dash: 1, strokeWidth: 1 });
    expect(extensionLineStyle("highlight", palette).strokeWidth).toBe(2);
    expect(labelOpacity("dim")).toBe(0.65);
    expect(labelOpacity("highlight")).toBe(1);
  });

  it("토큰을 getComputedStyle로 읽고, 하나라도 없으면 null(임의 색으로 대체하지 않음)", () => {
    const element = document.createElement("div");
    document.body.append(element);
    expect(readFigurePalette(element)).toBeNull();
    for (const name of Object.values(FIGURE_PALETTE_TOKENS)) element.style.setProperty(name, `v${name}`);
    expect(readFigurePalette(element)?.teal).toBe("v--color-accent-teal");
    element.remove();
  });
});
