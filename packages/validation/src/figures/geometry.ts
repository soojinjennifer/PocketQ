/**
 * 평면 기하 계산 커널 — `docs/FIGURE_SPEC.md` §3.6, §12.
 *
 * - 좌표계는 수학 좌표계(y축 위쪽)다. 외적 `cross(a, b) = a.x·b.y − a.y·b.x`가 양수이면 a에서 b로
 *   반시계 방향(ccw)이다.
 * - DOM·외부 라이브러리에 의존하지 않는 순수 함수만 둔다(서버·웹 공용).
 * - 해가 없거나 퇴화하면 throw하지 않고 판별 가능한 결과를 돌려준다.
 */

export interface Vec2 {
  x: number;
  y: number;
}

export function vec(x: number, y: number): Vec2 {
  return { x, y };
}

export function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function scale(v: Vec2, factor: number): Vec2 {
  return { x: v.x * factor, y: v.y * factor };
}

export function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

/** 2차원 외적(스칼라). 양수이면 a → b가 반시계 방향. */
export function cross(a: Vec2, b: Vec2): number {
  return a.x * b.y - a.y * b.x;
}

export function norm(v: Vec2): number {
  return Math.hypot(v.x, v.y);
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function midpoint(a: Vec2, b: Vec2): Vec2 {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function isFiniteVec(v: Vec2): boolean {
  return Number.isFinite(v.x) && Number.isFinite(v.y);
}

/** 직선 a→b 위로의 사영 매개변수 t(점 = a + t·(b − a)). a = b이면 NaN. */
export function lineParameter(p: Vec2, a: Vec2, b: Vec2): number {
  const direction = sub(b, a);
  return dot(sub(p, a), direction) / dot(direction, direction);
}

/**
 * 점 p에서 a, b를 지나는 **무한 직선**에 내린 수선의 발. 선분 밖이어도 그대로 돌려준다.
 * a = b(방향 없음)이면 null.
 */
export function footOnLine(p: Vec2, a: Vec2, b: Vec2): Vec2 | null {
  const direction = sub(b, a);
  const lengthSquared = dot(direction, direction);
  if (!(lengthSquared > 0)) return null;
  const t = dot(sub(p, a), direction) / lengthSquared;
  const foot = add(a, scale(direction, t));
  return isFiniteVec(foot) ? foot : null;
}

/** 점 p와 a, b를 지나는 무한 직선 사이 거리. a = b이면 NaN. */
export function distanceToLine(p: Vec2, a: Vec2, b: Vec2): number {
  const direction = sub(b, a);
  return Math.abs(cross(direction, sub(p, a))) / norm(direction);
}

export type LineIntersection = { kind: "point"; point: Vec2 } | { kind: "parallel" };

/**
 * 두 무한 직선(a1→a2, b1→b2)의 교점. 정규화한 외적 `|d1 × d2| / (|d1|·|d2|)`이
 * `parallelTolerance` 이하이면 평행(일치 포함)으로 본다.
 */
export function intersectLines(a1: Vec2, a2: Vec2, b1: Vec2, b2: Vec2, parallelTolerance: number): LineIntersection {
  const d1 = sub(a2, a1);
  const d2 = sub(b2, b1);
  const denominator = cross(d1, d2);
  const lengths = norm(d1) * norm(d2);
  if (!(lengths > 0) || Math.abs(denominator) <= parallelTolerance * lengths) return { kind: "parallel" };
  const t = cross(sub(b1, a1), d2) / denominator;
  const point = add(a1, scale(d1, t));
  return isFiniteVec(point) ? { kind: "point", point } : { kind: "parallel" };
}

export type TangentPointResult = { kind: "point"; point: Vec2 } | { kind: "inside" } | { kind: "on_circle" };

/**
 * 원(중심 O, 반지름 r) 밖의 점 P에서 그은 접선의 접점 — `docs/FIGURE_SPEC.md` §3.6.
 *
 * θ = acos(r / |OP|). 단위벡터 OP/|OP|를 +θ(ccw) 또는 −θ(cw) 회전해 r배 한 점이 접점이다.
 * ccw 접점은 외적 `OPx·OTy − OPy·OTx`가 양수다.
 *
 * - `| |OP| − r | ≤ onCircleTolerance`이면 접선이 하나로 퇴화(`on_circle`).
 * - `|OP| < r`이면 접선 없음(`inside`).
 */
export function tangentPoint(
  center: Vec2,
  radius: number,
  from: Vec2,
  select: "ccw" | "cw",
  onCircleTolerance: number,
): TangentPointResult {
  const op = sub(from, center);
  const d = norm(op);
  if (Math.abs(d - radius) <= onCircleTolerance) return { kind: "on_circle" };
  if (d < radius) return { kind: "inside" };
  const theta = Math.acos(radius / d);
  const sign = select === "ccw" ? 1 : -1;
  const ux = op.x / d;
  const uy = op.y / d;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta) * sign;
  const point = { x: center.x + radius * (ux * cos - uy * sin), y: center.y + radius * (ux * sin + uy * cos) };
  return isFiniteVec(point) ? { kind: "point", point } : { kind: "inside" };
}

/** 접점 방향 판정용 외적 OP × OT. 양수이면 ccw, 음수이면 cw. */
export function tangentOrientation(center: Vec2, from: Vec2, touch: Vec2): number {
  return cross(sub(from, center), sub(touch, center));
}

export interface AngleMeasure {
  /** 0° 이상 180° 이하. */
  degrees: number;
  /** 외적이 음수여서 첫째·셋째 점을 바꿨으면 true(정규화 후 첫째 → 셋째가 ccw). */
  swapped: boolean;
}

/**
 * ∠a·vertex·c를 180° 이하 쪽으로 잰다. 정규화 순서는 첫째 팔에서 셋째 팔로 반시계 방향이 되게
 * 한다(외적이 음수면 a와 c를 바꾼다). 팔 길이가 0이면 null.
 */
export function measureAngle(a: Vec2, vertex: Vec2, c: Vec2): AngleMeasure | null {
  const v1 = sub(a, vertex);
  const v2 = sub(c, vertex);
  if (!(norm(v1) > 0) || !(norm(v2) > 0)) return null;
  const crossValue = cross(v1, v2);
  const degrees = (Math.atan2(Math.abs(crossValue), dot(v1, v2)) * 180) / Math.PI;
  if (!Number.isFinite(degrees)) return null;
  return { degrees, swapped: crossValue < 0 };
}

/** 원(중심, 반지름)의 반지름. through가 있으면 중심과의 거리. */
export function circleRadius(center: Vec2, radius: number | null, through: Vec2 | null): number {
  if (radius !== null) return radius;
  if (through !== null) return distance(center, through);
  return Number.NaN;
}

/** 다각형 부호 있는 넓이(신발끈 공식). 반시계 방향이면 양수. */
export function polygonSignedArea(vertices: readonly Vec2[]): number {
  let sum = 0;
  for (let index = 0; index < vertices.length; index += 1) {
    const current = vertices[index];
    const next = vertices[(index + 1) % vertices.length];
    if (current === undefined || next === undefined) return Number.NaN;
    sum += cross(current, next);
  }
  return sum / 2;
}

/** 방향 판정(오차 띠 포함): 1 = ccw, −1 = cw, 0 = 일직선. */
function orientation(a: Vec2, b: Vec2, c: Vec2, areaTolerance: number): number {
  const value = cross(sub(b, a), sub(c, a));
  if (Math.abs(value) <= areaTolerance) return 0;
  return value > 0 ? 1 : -1;
}

/** 일직선 위의 c가 선분 ab의 범위(축별 상자) 안에 있는지. */
function withinSegmentBox(a: Vec2, b: Vec2, c: Vec2, lengthTolerance: number): boolean {
  return (
    c.x <= Math.max(a.x, b.x) + lengthTolerance &&
    c.x >= Math.min(a.x, b.x) - lengthTolerance &&
    c.y <= Math.max(a.y, b.y) + lengthTolerance &&
    c.y >= Math.min(a.y, b.y) - lengthTolerance
  );
}

/** 두 닫힌 선분이 만나거나 겹치는지(끝점 접촉 포함). */
export function segmentsIntersect(
  p1: Vec2,
  p2: Vec2,
  p3: Vec2,
  p4: Vec2,
  areaTolerance: number,
  lengthTolerance: number,
): boolean {
  const o1 = orientation(p1, p2, p3, areaTolerance);
  const o2 = orientation(p1, p2, p4, areaTolerance);
  const o3 = orientation(p3, p4, p1, areaTolerance);
  const o4 = orientation(p3, p4, p2, areaTolerance);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && withinSegmentBox(p1, p2, p3, lengthTolerance)) return true;
  if (o2 === 0 && withinSegmentBox(p1, p2, p4, lengthTolerance)) return true;
  if (o3 === 0 && withinSegmentBox(p3, p4, p1, lengthTolerance)) return true;
  if (o4 === 0 && withinSegmentBox(p3, p4, p2, lengthTolerance)) return true;
  return false;
}

/**
 * 다각형 자기교차 검사(O(n²)). 이웃하지 않은 두 변이 만나거나, 이웃한 두 변이 일직선으로
 * 되접히면(겹침) true.
 */
export function polygonSelfIntersects(vertices: readonly Vec2[], areaTolerance: number, lengthTolerance: number): boolean {
  const count = vertices.length;
  const at = (index: number): Vec2 => vertices[((index % count) + count) % count] ?? { x: Number.NaN, y: Number.NaN };

  for (let index = 0; index < count; index += 1) {
    const a = at(index);
    const b = at(index + 1);
    const c = at(index + 2);
    const ab = sub(b, a);
    const bc = sub(c, b);
    if (Math.abs(cross(ab, bc)) <= areaTolerance && dot(ab, bc) < 0) return true;
  }

  for (let i = 0; i < count; i += 1) {
    for (let j = i + 2; j < count; j += 1) {
      if (i === 0 && j === count - 1) continue; // 첫 변과 마지막 변은 이웃한다.
      if (segmentsIntersect(at(i), at(i + 1), at(j), at(j + 1), areaTolerance, lengthTolerance)) return true;
    }
  }
  return false;
}

/** 원(중심, 반지름)의 둘레가 축 정렬 상자 [left, top, right, bottom]와 만나는지. */
export function circleCrossesBox(
  center: Vec2,
  radius: number,
  box: readonly [number, number, number, number],
): boolean {
  const [left, top, right, bottom] = box;
  const nearestX = Math.min(Math.max(center.x, left), right);
  const nearestY = Math.min(Math.max(center.y, bottom), top);
  const nearest = Math.hypot(center.x - nearestX, center.y - nearestY);
  const farthestX = Math.max(Math.abs(center.x - left), Math.abs(center.x - right));
  const farthestY = Math.max(Math.abs(center.y - top), Math.abs(center.y - bottom));
  const farthest = Math.hypot(farthestX, farthestY);
  return nearest <= radius && farthest >= radius;
}

/** 점이 축 정렬 상자 안(경계 포함, 허용오차 확장)에 있는지. */
export function pointInBox(p: Vec2, box: readonly [number, number, number, number], tolerance: number): boolean {
  const [left, top, right, bottom] = box;
  return p.x >= left - tolerance && p.x <= right + tolerance && p.y >= bottom - tolerance && p.y <= top + tolerance;
}

/**
 * a, b를 지나는 무한 직선이 축 정렬 상자와 만나는지. 네 모서리의 부호 있는 거리가 모두 같은 쪽으로
 * `tolerance`보다 멀면 만나지 않는다. a = b이면 false.
 */
export function lineCrossesBox(
  a: Vec2,
  b: Vec2,
  box: readonly [number, number, number, number],
  tolerance: number,
): boolean {
  const direction = sub(b, a);
  const length = norm(direction);
  if (!(length > 0)) return false;
  const [left, top, right, bottom] = box;
  const corners: Vec2[] = [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
  ];
  const distances = corners.map((corner) => cross(direction, sub(corner, a)) / length);
  const allAbove = distances.every((d) => d > tolerance);
  const allBelow = distances.every((d) => d < -tolerance);
  return !(allAbove || allBelow);
}

