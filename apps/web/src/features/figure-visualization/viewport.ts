/**
 * 보드 크기와 보이는 영역 계산(순수 함수) — `docs/FIGURE_DESIGN.md` §7.3(2026-10-24 오너 변경).
 *
 * 1. 보이는 영역의 기준
 *    - **내용 맞춤(geometry, 축 숨김)**: 의미 검증 결과(`ResolvedFigure`)에서 실제로 그려지는 요소의
 *      범위(점, 원 = 중심 ± 반지름, 다각형, 선분, 그래프 조각)를 구한다. 무한 직선·반직선·lineEquation은
 *      범위에서 빼고 다른 요소 범위까지만 잘린다. 범위가 한 점으로 퇴화하면 명세 boundingBox를 쓴다.
 *    - **명세 bbox(축이 보이는 도형, function)**: 원점과 축 눈금이 의미가 있으므로 명세 boundingBox를
 *      그대로 쓴다.
 * 2. 내용 범위에 화면 기준 여백(P15 12px + 라벨 높이 20px)을 더하고, 명세 boundingBox(+12px)와 겹치는
 *    부분만 쓴다(명세보다 키우지 않는다).
 * 3. geometry(같은 단위 비율): 높이 = 폭 × 영역 세로/가로, [120px, 360px]로 제한. 상한에 걸리면
 *    가로를, 하한에 걸리면 세로를 중심 기준으로 대칭 확장한다(내용이 잘리지 않음).
 *    function(keepAspectRatio false): 높이 = 폭 × 0.75(P14), 같은 범위로 제한, 단위 비율 자유.
 */
import type { FigureSpec } from "shared-types";
import type { ResolvedFigure, Vec2 } from "validation";

export const VIEWPORT_MIN_HEIGHT = 120;
export const VIEWPORT_MAX_HEIGHT = 360;
/** P15 — 가장자리 여백. */
export const VIEWPORT_EDGE_PADDING_PX = 12;
/** 점 라벨(Subheadline 15/20) 한 줄 높이 — 내용 맞춤 시 여백에 더한다. */
export const VIEWPORT_LABEL_SPACE_PX = 20;
/** P14 — function 기본 비율(세로/가로). */
export const FUNCTION_ASPECT = 0.75;

export type BoundingBox = [number, number, number, number];

export interface FigureViewport {
  /** 보드 폭(px). */
  width: number;
  /** 보드 높이(px, 정수). */
  height: number;
  /** JSXGraph에 넘길 [left, top, right, bottom]. */
  boundingBox: BoundingBox;
  /** "content" = 내용 맞춤, "spec" = 명세 boundingBox 기준. */
  basis: "content" | "spec";
}

interface Bounds {
  left: number;
  right: number;
  bottom: number;
  top: number;
}

function emptyBounds(): Bounds {
  return { left: Infinity, right: -Infinity, bottom: Infinity, top: -Infinity };
}

function include(bounds: Bounds, p: Vec2, radius = 0): void {
  bounds.left = Math.min(bounds.left, p.x - radius);
  bounds.right = Math.max(bounds.right, p.x + radius);
  bounds.bottom = Math.min(bounds.bottom, p.y - radius);
  bounds.top = Math.max(bounds.top, p.y + radius);
}

/** 실제로 그려지는 유한 요소의 범위. 무한 직선·반직선·lineEquation은 제외. 비면 null. */
export function contentBounds(resolved: ResolvedFigure): Bounds | null {
  const bounds = emptyBounds();
  for (const element of resolved.elements.values()) {
    switch (element.kind) {
      case "point":
        include(bounds, element.xy);
        break;
      case "circle":
        include(bounds, element.center, element.radius);
        break;
      case "polygon":
        element.vertices.forEach((vertex) => include(bounds, vertex));
        break;
      case "line":
        if (element.type === "segment") {
          include(bounds, element.p1);
          include(bounds, element.p2);
        }
        break;
      case "angle":
        element.xy.forEach((p) => include(bounds, p));
        break;
      case "graph":
        element.pieces.forEach((piece) => piece.forEach((p) => include(bounds, p)));
        break;
      default: {
        const unreachable: never = element;
        void unreachable;
      }
    }
  }
  return Number.isFinite(bounds.left) ? bounds : null;
}

function specBounds(spec: FigureSpec): Bounds {
  const [left, top, right, bottom] = spec.boundingBox;
  return { left, right, bottom, top };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** 같은 단위 비율 보드: 내용 범위 + 여백(px)을 폭에 맞춘다. */
function equalUnitViewport(
  content: Bounds,
  limitBase: Bounds,
  width: number,
  paddingPx: number,
  basis: FigureViewport["basis"],
): FigureViewport {
  const padding = Math.min(paddingPx, width / 4);
  const edge = Math.min(VIEWPORT_EDGE_PADDING_PX, width / 4);
  const contentWidth = content.right - content.left;
  const contentHeight = content.top - content.bottom;

  // px/단위 k. 가로·세로 중 더 빡빡한 쪽(세로는 상한 높이 기준)으로 정한다.
  const fit = (regionWidth: number, regionHeight: number): number => {
    const byWidth = regionWidth > 0 ? width / regionWidth : Infinity;
    const byHeight = regionHeight > 0 ? VIEWPORT_MAX_HEIGHT / regionHeight : Infinity;
    return Math.min(byWidth, byHeight);
  };

  let k = fit(contentWidth + (2 * padding * contentWidth) / Math.max(width - 2 * padding, 1), contentHeight);
  if (!Number.isFinite(k) || k <= 0) k = width / Math.max(contentWidth, contentHeight, 1e-9);

  let region: Bounds = content;
  // 여백(px)은 k에 따라 사용자 단위 길이가 달라지므로 몇 번 반복해 수렴시킨다.
  for (let iteration = 0; iteration < 4; iteration += 1) {
    const pad = padding / k;
    const limitPad = edge / k;
    region = {
      left: Math.max(content.left - pad, limitBase.left - limitPad),
      right: Math.min(content.right + pad, limitBase.right + limitPad),
      bottom: Math.max(content.bottom - pad, limitBase.bottom - limitPad),
      top: Math.min(content.top + pad, limitBase.top + limitPad),
    };
    const next = fit(region.right - region.left, region.top - region.bottom);
    if (!Number.isFinite(next) || next <= 0) break;
    k = next;
  }

  const regionHeightPx = (region.top - region.bottom) * k;
  const height = Math.round(clamp(regionHeightPx, VIEWPORT_MIN_HEIGHT, VIEWPORT_MAX_HEIGHT));
  // 상한·반올림 뒤에도 내용 세로가 들어가도록 k를 다시 맞춘다(세로가 더 빡빡하면 가로가 확장된다).
  k = Math.min(k, height / Math.max(region.top - region.bottom, 1e-12));

  const centerX = (region.left + region.right) / 2;
  const centerY = (region.bottom + region.top) / 2;
  const halfWidth = width / k / 2;
  const halfHeight = height / k / 2;
  return {
    width,
    height,
    boundingBox: [centerX - halfWidth, centerY + halfHeight, centerX + halfWidth, centerY - halfHeight],
    basis,
  };
}

/** 단위 비율이 자유로운 function 보드(4:3). 명세 boundingBox + 12px. */
function freeUnitViewport(spec: FigureSpec, width: number): FigureViewport {
  const height = Math.round(clamp(width * FUNCTION_ASPECT, VIEWPORT_MIN_HEIGHT, VIEWPORT_MAX_HEIGHT));
  const [left, top, right, bottom] = spec.boundingBox;
  const edge = Math.min(VIEWPORT_EDGE_PADDING_PX, width / 4, height / 4);
  const unitX = (width - 2 * edge) / (right - left);
  const unitY = (height - 2 * edge) / (top - bottom);
  return {
    width,
    height,
    boundingBox: [left - edge / unitX, top + edge / unitY, right + edge / unitX, bottom - edge / unitY],
    basis: "spec",
  };
}

/**
 * 폭(px)에서 보드 높이와 보이는 영역을 계산한다. 폭이 0 이하면 null(아직 측정 전 — 보드를 만들지 않음).
 */
export function computeViewport(spec: FigureSpec, resolved: ResolvedFigure, width: number): FigureViewport | null {
  if (!(width > 0)) return null;
  if (!spec.keepAspectRatio) return freeUnitViewport(spec, width);

  const specBox = specBounds(spec);
  if (spec.axes.visible || spec.kind === "function") {
    return equalUnitViewport(specBox, specBox, width, VIEWPORT_EDGE_PADDING_PX, "spec");
  }

  const content = contentBounds(resolved);
  const tiny = resolved.scale * 1e-9;
  if (content === null || (content.right - content.left <= tiny && content.top - content.bottom <= tiny)) {
    return equalUnitViewport(specBox, specBox, width, VIEWPORT_EDGE_PADDING_PX, "spec");
  }
  return equalUnitViewport(content, specBox, width, VIEWPORT_EDGE_PADDING_PX + VIEWPORT_LABEL_SPACE_PX, "content");
}

/** 측정 전 자리 잡기용 높이(결과 패널 Default 보드 폭 348px 기준, §7.4). */
export const PLACEHOLDER_BOARD_WIDTH = 348;

/**
 * 최소 보드 폭(S4-V2, 오너 승인 240px, `docs/FIGURE_DESIGN.md` §17.9). 측정 폭이 이보다 좁으면 보드를 새로 만들지도
 * 리사이즈하지도 않는다 — 기존 보드는 직전 크기를 유지(보드 상자 overflow-hidden), 아직 없으면 자리만 잡는다.
 */
export const MIN_BOARD_WIDTH = 240;
