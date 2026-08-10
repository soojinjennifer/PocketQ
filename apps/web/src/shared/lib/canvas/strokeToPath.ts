import { getStroke } from "perfect-freehand";
import type { StrokePoint } from "./useDrawingStrokes";

interface StrokeToPathOptions {
  /** 획 두께(px). 지우개는 펜보다 크게 지정해서 스탬프처럼 지워지게 한다. */
  size: number;
}

/**
 * `perfect-freehand`의 `getStroke()`로 얻은 outline point 배열을 `Path2D`로 변환한다.
 * outline이 형성되지 않을 만큼 점이 적으면(예: 탭 한 번, 아주 짧은 드래그) 마지막 포인트를 중심으로
 * `size`를 지름으로 하는 원형 Path2D로 대체한다 — 짧은 획이 조용히 사라지지 않도록 하는 방어 처리다
 * (특히 지우개는 이 경로가 없으면 탭/짧은 드래그로 전혀 지워지지 않는 것처럼 보일 수 있다).
 */
export function strokeToPath(points: StrokePoint[], options: StrokeToPathOptions): Path2D | null {
  if (points.length === 0) {
    return null;
  }

  const outline = getStroke(
    points.map((point) => [point.x, point.y, point.pressure]),
    {
      size: options.size,
      thinning: 0.5,
      smoothing: 0.5,
      streamline: 0.5,
    },
  );

  const pathData = getSvgPathFromStroke(outline);
  if (pathData) {
    return new Path2D(pathData);
  }

  const last = points[points.length - 1];
  if (!last) {
    return null;
  }
  const fallbackDot = new Path2D();
  fallbackDot.arc(last.x, last.y, options.size / 2, 0, Math.PI * 2);
  return fallbackDot;
}

interface Point2D {
  x: number;
  y: number;
}

function toPoint2D(raw: number[] | undefined): Point2D | null {
  if (!raw) {
    return null;
  }
  const [x, y] = raw;
  return typeof x === "number" && typeof y === "number" ? { x, y } : null;
}

function midpoint(a: Point2D, b: Point2D): Point2D {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function fmt(point: Point2D): string {
  return `${point.x.toFixed(2)},${point.y.toFixed(2)}`;
}

/**
 * perfect-freehand 공식 예제(https://github.com/steveruizok/perfect-freehand#usage)의
 * outline point → SVG path 변환 로직을 그대로 사용한다(Quadratic curve 기반, 닫힌 도형).
 */
function getSvgPathFromStroke(points: number[][]): string {
  if (points.length < 4) {
    return "";
  }

  const first = toPoint2D(points[0]);
  const second = toPoint2D(points[1]);
  const third = toPoint2D(points[2]);
  if (!first || !second || !third) {
    return "";
  }

  let result = `M${fmt(first)} Q${fmt(second)} ${fmt(midpoint(second, third))} T`;

  for (let i = 2, max = points.length - 1; i < max; i++) {
    const a = toPoint2D(points[i]);
    const b = toPoint2D(points[i + 1]);
    if (!a || !b) {
      continue;
    }
    result += `${fmt(midpoint(a, b))} `;
  }

  return `${result}Z`;
}
