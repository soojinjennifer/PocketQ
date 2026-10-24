/**
 * role × 상태 → JSXGraph 스타일 매핑 — `docs/FIGURE_DESIGN.md` §3(오너 승인 2026-10-24, §15 P1~P12).
 *
 * 색은 모두 기존 디자인 토큰을 `getComputedStyle`로 읽어 넘긴다(`readFigurePalette`). 새 색을 만들지
 * 않고, 알파는 토큰 색에 JSXGraph `strokeOpacity`/`fillOpacity`를 곱하는 방식으로만 표현한다.
 * Stage 4는 이 표를 그대로 재사용한다.
 */
import type { FigureElementRole } from "shared-types";
import type { FigureEmphasis } from "./resolveStepState";

export interface FigurePalette {
  /** `--color-label-primary` — given 선·점, 모든 라벨. */
  ink: string;
  /** `--color-brand` — auxiliary 선·점, given/auxiliary 채움. */
  brand: string;
  /** `--color-accent-teal` — result 선·점·채움. */
  teal: string;
  /** `--color-label-secondary` — 축 선. */
  axis: string;
  /** `--color-separator` — 격자. */
  grid: string;
  /** `--color-accent-yellow` — 강조 언더레이(형광펜). */
  underlay: string;
  /** `--color-bg-canvas` — 보드 배경, 점 테두리(halo 링). */
  canvas: string;
}

export const FIGURE_PALETTE_TOKENS: Record<keyof FigurePalette, string> = {
  ink: "--color-label-primary",
  brand: "--color-brand",
  teal: "--color-accent-teal",
  axis: "--color-label-secondary",
  grid: "--color-separator",
  underlay: "--color-accent-yellow",
  canvas: "--color-bg-canvas",
};

/** 토큰 값을 읽는다. 하나라도 비어 있으면 null(임의 색으로 대체하지 않는다 → 호출 측이 대체 표시). */
export function readFigurePalette(element: Element): FigurePalette | null {
  const style = getComputedStyle(element);
  const read = (name: string): string => style.getPropertyValue(name).trim();
  const palette: FigurePalette = {
    ink: read(FIGURE_PALETTE_TOKENS.ink),
    brand: read(FIGURE_PALETTE_TOKENS.brand),
    teal: read(FIGURE_PALETTE_TOKENS.teal),
    axis: read(FIGURE_PALETTE_TOKENS.axis),
    grid: read(FIGURE_PALETTE_TOKENS.grid),
    underlay: read(FIGURE_PALETTE_TOKENS.underlay),
    canvas: read(FIGURE_PALETTE_TOKENS.canvas),
  };
  const values: string[] = [palette.ink, palette.brand, palette.teal, palette.axis, palette.grid, palette.underlay, palette.canvas];
  return values.every((value) => value.length > 0) ? palette : null;
}

/** 언더레이 불투명도(P5). */
export const UNDERLAY_OPACITY = 0.5;
/** 선 언더레이 폭(P5). */
export const UNDERLAY_LINE_WIDTH = 10;

const DIM_OPACITY: Record<FigureElementRole, number> = { given: 0.65, auxiliary: 0.75, result: 0.85 };

function roleColor(role: FigureElementRole, palette: FigurePalette): string {
  switch (role) {
    case "given":
      return palette.ink;
    case "auxiliary":
      return palette.brand;
    case "result":
      return palette.teal;
    default: {
      const unreachable: never = role;
      void unreachable;
      return palette.ink;
    }
  }
}

export interface LineStyle {
  strokeColor: string;
  strokeOpacity: number;
  /** JSXGraph dash: 0 실선, 1 = `2,2`, 2 = `5,5`. */
  dash: number;
  strokeWidth: number;
}

const LINE_WIDTH: Record<FigureElementRole, number> = { given: 2, auxiliary: 1.5, result: 2.5 };

/** §3.2 선 계열(선분·직선·반직선·원 둘레·다각형 변·함수 곡선). */
export function lineStyle(role: FigureElementRole, emphasis: FigureEmphasis, palette: FigurePalette): LineStyle {
  const base = LINE_WIDTH[role];
  return {
    strokeColor: roleColor(role, palette),
    strokeOpacity: emphasis === "dim" ? DIM_OPACITY[role] : 1,
    dash: role === "auxiliary" ? 2 : 0,
    strokeWidth: emphasis === "highlight" ? base + 1 : base,
  };
}

/** §4.4 수선의 발 연장선: `dash: 1`, 굵기 1(강조 2), brand. */
export function extensionLineStyle(emphasis: FigureEmphasis, palette: FigurePalette): LineStyle {
  return {
    strokeColor: palette.brand,
    strokeOpacity: emphasis === "dim" ? DIM_OPACITY.auxiliary : 1,
    dash: 1,
    strokeWidth: emphasis === "highlight" ? 2 : 1,
  };
}

/** §4.2 각 호: role 색, 굵기 1.5(강조 2.5), dash는 role 규칙. */
export function angleArcStyle(role: FigureElementRole, emphasis: FigureEmphasis, palette: FigurePalette): LineStyle {
  return {
    strokeColor: roleColor(role, palette),
    strokeOpacity: emphasis === "dim" ? DIM_OPACITY[role] : 1,
    dash: role === "auxiliary" ? 2 : 0,
    strokeWidth: emphasis === "highlight" ? 2.5 : 1.5,
  };
}

export interface FillStyle {
  fillColor: string;
  fillOpacity: number;
}

/** §3.3 채움. 원은 채우지 않는다(호출하지 않음). */
export function fillStyle(
  role: FigureElementRole,
  emphasis: FigureEmphasis,
  kind: "polygon" | "angle",
  palette: FigurePalette,
): FillStyle {
  const scaleBy = (base: number): number => (emphasis === "highlight" ? base * 2 : emphasis === "dim" ? base / 2 : base);
  if (role === "result") {
    const alpha = emphasis === "highlight" ? 0.2 : emphasis === "dim" ? 0.06 : 0.12;
    return { fillColor: palette.teal, fillOpacity: alpha };
  }
  if (kind === "angle") return { fillColor: palette.brand, fillOpacity: scaleBy(0.12) };
  if (role === "auxiliary") return { fillColor: palette.brand, fillOpacity: 0 };
  return { fillColor: palette.brand, fillOpacity: scaleBy(0.08) };
}

export interface PointStyle {
  size: number;
  fillColor: string;
  fillOpacity: number;
  strokeColor: string;
  strokeOpacity: number;
  strokeWidth: number;
  /** 강조 시 아래에 까는 언더레이 원 반지름. 강조가 아니면 null. */
  underlaySize: number | null;
}

/** §3.4 점(모든 점 종류 공통, role로만 결정). */
export function pointStyle(role: FigureElementRole, emphasis: FigureEmphasis, palette: FigurePalette): PointStyle {
  const highlighted = emphasis === "highlight";
  const dimOpacity = emphasis === "dim" ? DIM_OPACITY[role] : 1;
  switch (role) {
    case "given":
      return {
        size: highlighted ? 4.5 : 3,
        fillColor: palette.ink,
        fillOpacity: dimOpacity,
        strokeColor: palette.canvas,
        strokeOpacity: 1,
        strokeWidth: 1.5,
        underlaySize: highlighted ? 9 : null,
      };
    case "auxiliary":
      return {
        size: highlighted ? 4.5 : 3,
        fillColor: palette.canvas,
        fillOpacity: 1,
        strokeColor: palette.brand,
        strokeOpacity: dimOpacity,
        strokeWidth: highlighted ? 2 : 1.5,
        underlaySize: highlighted ? 9 : null,
      };
    case "result":
      return {
        size: highlighted ? 5.5 : 4,
        fillColor: palette.teal,
        fillOpacity: dimOpacity,
        strokeColor: palette.canvas,
        strokeOpacity: 1,
        strokeWidth: 1.5,
        underlaySize: highlighted ? 10 : null,
      };
    default: {
      const unreachable: never = role;
      void unreachable;
      return pointStyle("given", emphasis, palette);
    }
  }
}

/** §3.5 라벨: 기본·강조 불투명도 1, 비강조 0.65. 색은 항상 ink. */
export function labelOpacity(emphasis: FigureEmphasis): number {
  return emphasis === "dim" ? 0.65 : 1;
}

/** 라벨 글꼴 크기(px) — §6.1, §5. */
export const LABEL_FONT_PX = { element: 15, measure: 12, tick: 11, axisName: 13 } as const;

/** 거리(px) — §6.3, §4.2, P9·P10·P12. */
export const FIGURE_PX = {
  pointLabelOffset: 6,
  lengthLabelOffset: 8,
  angleRadius: 18,
  angleRadiusStep: 5,
  angleLabelGap: 10,
  rightAngleSide: 10,
  tickMinSpacing: 32,
} as const;
