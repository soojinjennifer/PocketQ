/**
 * 점 라벨 방향 계산(순수 함수) — `docs/FIGURE_DESIGN.md` §6.3(Stage 2 재작업 1, design-agent P1-2).
 *
 * JSXGraph `autoPosition`은 쓰지 않는다(결과가 그리기 순서·상태에 따라 달라 결정적이지 않다).
 *
 * 규칙
 * 1. 다각형 꼭짓점: 그 다각형 무게중심의 반대 방향.
 * 2. 그 밖의 점: 점에 붙은 선분·직선·반직선·원·곡선·각의 방향을 "막힌 방향"으로 모으고, 24개 후보 방향
 *    (15° 간격) 중 막힌 방향과의 최소 각도 차가 가장 큰 방향을 고른다. 동점에 가까우면 도형 바깥쪽
 *    (도형 중심에서 점으로 향하는 방향)에 가까운 후보를 고른다. 선분 위의 점(수선의 발·중점)은 선분
 *    양쪽 방향이 막히므로 자연히 법선 방향 중 바깥쪽이 고른다.
 *    - 선분: 점이 내부에 있으면 양쪽, 끝점이면 반대 끝점 쪽 한 방향.
 *    - 직선(lineEquation 포함): 양쪽. 반직선: 시작점이면 한 방향, 그 밖이면 양쪽.
 *    - 원 위의 점: 접선 양쪽 + 원 안쪽(중심 방향) — 라벨을 원 바깥에 둔다.
 *    - 곡선 위의 점: 가장 가까운 조각 구간의 양쪽.
 *    - 각의 꼭짓점: 두 팔과 이등분선(직각 표시·호가 있는 사분면).
 *
 * 모든 계산은 **화면 px 좌표**(y 아래쪽이 +)가 아니라 "px 단위 수학 좌표"(x 오른쪽, y 위쪽 +)에서 한다.
 * 함수 그래프처럼 가로·세로 단위가 다른 보드에서도 화면에서 보이는 각도대로 고르기 위해서다.
 */
import type { Vec2 } from "validation";

export interface PlacementLine {
  p1: Vec2;
  p2: Vec2;
  kind: "segment" | "line" | "ray";
}

export interface PlacementScene {
  lines: PlacementLine[];
  circles: { center: Vec2; radius: number }[];
  curves: Vec2[][];
  /** 각: [첫째, 꼭짓점, 셋째]. */
  angles: [Vec2, Vec2, Vec2][];
  /** 도형 전체 중심(바깥쪽 판정 기준). */
  center: Vec2;
}

/** 사용자 좌표 → px 단위 수학 좌표(y 위쪽 +) 변환 계수. */
export interface PxScale {
  x: number;
  y: number;
}

const CANDIDATE_COUNT = 24;
/** 점이 선·원·곡선 위에 있다고 볼 거리(px). */
const ON_TOLERANCE_PX = 1.5;
/** 바깥쪽 선호 가중치(라디안 단위 점수에 더함). */
const OUTWARD_WEIGHT = 0.35;

function toPx(p: Vec2, scale: PxScale): Vec2 {
  return { x: p.x * scale.x, y: p.y * scale.y };
}

function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

function angleOf(v: Vec2): number {
  return Math.atan2(v.y, v.x);
}

function angularGap(a: number, b: number): number {
  const diff = Math.abs(a - b) % (2 * Math.PI);
  return diff > Math.PI ? 2 * Math.PI - diff : diff;
}

function unit(v: Vec2): Vec2 {
  const length = Math.hypot(v.x, v.y);
  return length > 0 ? { x: v.x / length, y: v.y / length } : { x: 0, y: 0 };
}

/** 점에서 막힌 방향(라디안, px 수학 좌표)을 모은다. */
export function blockedDirections(point: Vec2, scene: PlacementScene, scale: PxScale): number[] {
  const p = toPx(point, scale);
  const blocked: number[] = [];
  const pushBoth = (direction: Vec2): void => {
    const angle = angleOf(direction);
    blocked.push(angle, angle + Math.PI);
  };

  for (const line of scene.lines) {
    const a = toPx(line.p1, scale);
    const b = toPx(line.p2, scale);
    const direction = sub(b, a);
    const lengthSquared = direction.x * direction.x + direction.y * direction.y;
    if (!(lengthSquared > 0)) continue;
    const length = Math.sqrt(lengthSquared);
    const t = ((p.x - a.x) * direction.x + (p.y - a.y) * direction.y) / lengthSquared;
    const distance = Math.abs(direction.x * (p.y - a.y) - direction.y * (p.x - a.x)) / length;
    if (distance > ON_TOLERANCE_PX) continue;
    const slack = ON_TOLERANCE_PX / length;
    const atStart = Math.abs(t) <= slack;
    const atEnd = Math.abs(t - 1) <= slack;
    if (line.kind === "line") {
      pushBoth(direction);
    } else if (line.kind === "ray") {
      if (atStart) blocked.push(angleOf(direction));
      else if (t > 0) pushBoth(direction);
    } else if (atStart) {
      blocked.push(angleOf(direction));
    } else if (atEnd) {
      blocked.push(angleOf(sub(a, b)));
    } else if (t > 0 && t < 1) {
      pushBoth(direction);
    }
  }

  for (const circle of scene.circles) {
    const c = toPx(circle.center, scale);
    const radial = sub(p, c);
    const distance = Math.hypot(radial.x, radial.y);
    // 원의 px 반지름(가로·세로 단위가 같을 때만 원. 다르면 가로 기준 근사).
    const radiusPx = circle.radius * scale.x;
    if (distance === 0 || Math.abs(distance - radiusPx) > ON_TOLERANCE_PX) continue;
    pushBoth({ x: -radial.y, y: radial.x });
    blocked.push(angleOf({ x: -radial.x, y: -radial.y }));
  }

  for (const curve of scene.curves) {
    let best: { distance: number; direction: Vec2 } | null = null;
    for (let index = 0; index + 1 < curve.length; index += 1) {
      const start = curve[index];
      const end = curve[index + 1];
      if (start === undefined || end === undefined) continue;
      const a = toPx(start, scale);
      const b = toPx(end, scale);
      const direction = sub(b, a);
      const lengthSquared = direction.x * direction.x + direction.y * direction.y;
      if (!(lengthSquared > 0)) continue;
      const t = Math.min(1, Math.max(0, ((p.x - a.x) * direction.x + (p.y - a.y) * direction.y) / lengthSquared));
      const distance = Math.hypot(a.x + t * direction.x - p.x, a.y + t * direction.y - p.y);
      if (best === null || distance < best.distance) best = { distance, direction };
    }
    if (best !== null && best.distance <= ON_TOLERANCE_PX) pushBoth(best.direction);
  }

  for (const [first, vertex, third] of scene.angles) {
    const v = toPx(vertex, scale);
    if (Math.hypot(v.x - p.x, v.y - p.y) > ON_TOLERANCE_PX) continue;
    const armA = unit(sub(toPx(first, scale), v));
    const armC = unit(sub(toPx(third, scale), v));
    blocked.push(angleOf(armA), angleOf(armC));
    const bisector = { x: armA.x + armC.x, y: armA.y + armC.y };
    if (Math.hypot(bisector.x, bisector.y) > 1e-9) blocked.push(angleOf(bisector));
  }

  return blocked;
}

/**
 * 점 라벨 방향(px 수학 좌표의 단위 벡터, y 위쪽 +).
 * @param polygonCentroid 점이 다각형 꼭짓점이면 그 다각형의 무게중심(규칙 1).
 */
export function chooseLabelDirection(
  point: Vec2,
  scene: PlacementScene,
  scale: PxScale,
  polygonCentroid: Vec2 | null = null,
): Vec2 {
  if (polygonCentroid !== null) {
    const away = unit(sub(toPx(point, scale), toPx(polygonCentroid, scale)));
    if (away.x !== 0 || away.y !== 0) return away;
  }

  const blocked = blockedDirections(point, scene, scale);
  const outwardRaw = unit(sub(toPx(point, scale), toPx(scene.center, scale)));
  const outward = outwardRaw.x === 0 && outwardRaw.y === 0 ? unit({ x: 1, y: 1 }) : outwardRaw;

  let best = { score: -Infinity, direction: unit({ x: 1, y: 1 }) };
  for (let index = 0; index < CANDIDATE_COUNT; index += 1) {
    // 45°(오른쪽 위)부터 시작해 동점이면 오른쪽 위를 우선한다.
    const angle = Math.PI / 4 + (index * 2 * Math.PI) / CANDIDATE_COUNT;
    const direction = { x: Math.cos(angle), y: Math.sin(angle) };
    const gap = blocked.length === 0 ? Math.PI : Math.min(...blocked.map((b) => angularGap(angle, b)));
    const score = gap + OUTWARD_WEIGHT * (direction.x * outward.x + direction.y * outward.y);
    if (score > best.score + 1e-9) best = { score, direction };
  }
  return best.direction;
}

/** 선택한 방향과 막힌 방향 사이의 최소 각도(라디안). 테스트·디버그용. */
export function clearance(direction: Vec2, blocked: readonly number[]): number {
  const angle = angleOf(direction);
  return blocked.length === 0 ? Math.PI : Math.min(...blocked.map((b) => angularGap(angle, b)));
}
