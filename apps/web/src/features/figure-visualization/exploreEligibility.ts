/**
 * 탐색 모드 자격 판정(순수 함수) — Stage 4 D-1·D-2, `docs/FIGURE_DESIGN.md` §17.14·§17.15.
 *
 * 탐색 UI(WU9)는 이번 Stage에 구현하지 않는다(오너 D-1). 이 모듈은 "조건을 보존할 수 있는 도형만 탐색 허용"
 * 규칙을 판정만 한다. 운영에서 AI는 `fixed`만 만들므로(D-3) 자격 있는 도형은 수작업 fixture(F09)뿐이다.
 *
 * 정적 자격(`checkExploreEligibility`):
 * 1. `interaction.mode === "explore"`, `kind === "geometry"`, 축이 보이지 않음(좌표값이 조건처럼 읽힘).
 * 2. `draggable`은 좌표를 직접 갖는 자유 점(`point`)만.
 * 3. 폐포 = 끄는 점 + 그 점에 직간접으로 의존하는 모든 요소. 폐포 요소를 하나라도 참조하는 **given** 제약이 없다.
 * 4. 폐포에 수치 라벨(`showLength`·`showMeasure`)이 없다(움직이면 숫자가 원래 조건·답과 달라짐).
 * 5. 폐포의 직각 표시(`rightAngleMark`)는 derived 수직 관계(수선의 발 또는 derived `perpendicular`)로 보장돼야 한다.
 *
 * 위치 판정(`checkExplorePosition`, 탐색 중 매 프레임용): 옮긴 좌표로 다시 해석해 의미 검증을 통과하고, 퇴화
 * (점 일치·길이 0 선분·넓이 0 다각형·계산 불가)가 없고, 옮긴 점이 명세 boundingBox 안쪽 12px(P15) 이내일 때만 허용.
 *
 * 한계: 문제 원문 조건이 `constraints`에 빠져 있으면(예: "이등변"인데 equalLength 없음) 알 수 없다. AI가 explore를
 * 만들게 허용하는 시점에는 이 범위를 다시 검토해야 한다(§17.15).
 */
import type { FigureConstraint, FigureElement, FigureSpec } from "shared-types";
import { elementDependencies, resolveFigure, validateFigureSemantics, type Vec2 } from "validation";

export type ExploreIneligibleReason =
  | "not_explore"
  | "not_geometry"
  | "axes_visible"
  | "draggable_not_free_point"
  | "given_constraint_in_closure"
  | "measure_label_in_closure"
  | "unguaranteed_right_angle";

export type ExploreEligibility =
  | { eligible: true; draggable: string[]; closure: string[] }
  | { eligible: false; reasons: ExploreIneligibleReason[] };

/** 탐색 중 점 위치 제한 — 명세 boundingBox 안쪽 여백(P15 12px). */
export const EXPLORE_EDGE_PADDING_PX = 12;

function constraintRefs(constraint: FigureConstraint): string[] {
  switch (constraint.type) {
    case "perpendicular":
    case "parallel":
    case "equalLength":
      return [constraint.a, constraint.b];
    case "length":
      return [constraint.segment];
    case "angleMeasure":
      return [constraint.angle];
    case "pointOnCircle":
      return [constraint.point, constraint.circle];
    case "pointOnLine":
      return [constraint.point, constraint.line];
    case "tangent":
      return [constraint.line, constraint.circle];
    case "collinear":
      return [...constraint.points];
    default: {
      const unreachable: never = constraint;
      void unreachable;
      return [];
    }
  }
}

/** 끄는 점들 + 직간접 의존 요소(명세 순서). */
export function dependencyClosure(spec: FigureSpec, roots: readonly string[]): string[] {
  const closure = new Set(roots);
  // elements는 의존 순서(앞 요소만 참조)라 한 번 훑으면 폐포가 닫힌다.
  for (const element of spec.elements) {
    if (elementDependencies(element).some((id) => closure.has(id))) closure.add(element.id);
  }
  return spec.elements.map((element) => element.id).filter((id) => closure.has(id));
}

/** 직선류(segment·line·ray) 위에 있다고 보장되는 점 ID들. */
function pointsOnLine(spec: FigureSpec, lineId: string): Set<string> {
  const points = new Set<string>();
  const line = spec.elements.find((element) => element.id === lineId);
  if (line === undefined || (line.type !== "segment" && line.type !== "line" && line.type !== "ray")) return points;
  line.through.forEach((id) => points.add(id));
  for (const element of spec.elements) {
    if (element.type === "foot" && element.to === lineId) points.add(element.id);
    if (element.type === "intersection" && element.of.includes(lineId)) points.add(element.id);
  }
  for (const constraint of spec.constraints) {
    if (constraint.source !== "derived") continue;
    if (constraint.type === "pointOnLine" && constraint.line === lineId) points.add(constraint.point);
    if (constraint.type === "collinear" && line.through.every((id) => constraint.points.includes(id))) {
      constraint.points.forEach((id) => points.add(id));
    }
  }
  return points;
}

/** 꼭짓점 v에서 p·q로 가는 두 반직선이 derived 수직 관계로 직각이 보장되는가. */
function isGuaranteedRightAngle(spec: FigureSpec, angle: Extract<FigureElement, { type: "angle" }>): boolean {
  const [p, v, q] = angle.points;
  const vertex = spec.elements.find((element) => element.id === v);
  // ① 꼭짓점이 수선의 발: 발 → from 방향은 to 직선에 수직이다.
  if (vertex?.type === "foot") {
    const onFootLine = pointsOnLine(spec, vertex.to);
    if ((p === vertex.from && onFootLine.has(q)) || (q === vertex.from && onFootLine.has(p))) return true;
  }
  // ② derived perpendicular(a ⟂ b): 한 반직선이 a 위, 다른 반직선이 b 위.
  for (const constraint of spec.constraints) {
    if (constraint.source !== "derived" || constraint.type !== "perpendicular") continue;
    const a = pointsOnLine(spec, constraint.a);
    const b = pointsOnLine(spec, constraint.b);
    const along = (line: Set<string>, end: string): boolean => line.has(v) && line.has(end);
    if ((along(a, p) && along(b, q)) || (along(a, q) && along(b, p))) return true;
  }
  return false;
}

/** 정적 자격 판정. 자격이 없으면 이유를 모두 돌려준다. */
export function checkExploreEligibility(spec: FigureSpec): ExploreEligibility {
  const reasons: ExploreIneligibleReason[] = [];
  if (spec.interaction.mode !== "explore") return { eligible: false, reasons: ["not_explore"] };
  if (spec.kind !== "geometry") reasons.push("not_geometry");
  if (spec.axes.visible) reasons.push("axes_visible");

  const draggable = [...spec.interaction.draggable];
  const byId = new Map(spec.elements.map((element) => [element.id, element]));
  if (draggable.some((id) => byId.get(id)?.type !== "point")) reasons.push("draggable_not_free_point");

  const closure = dependencyClosure(spec, draggable);
  const inClosure = new Set(closure);
  if (spec.constraints.some((constraint) => constraint.source === "given" && constraintRefs(constraint).some((id) => inClosure.has(id)))) {
    reasons.push("given_constraint_in_closure");
  }
  const closureElements = closure.map((id) => byId.get(id)).filter((element): element is FigureElement => element !== undefined);
  if (
    closureElements.some(
      (element) =>
        ((element.type === "segment" || element.type === "line" || element.type === "ray") && element.showLength) ||
        (element.type === "angle" && element.showMeasure),
    )
  ) {
    reasons.push("measure_label_in_closure");
  }
  if (closureElements.some((element) => element.type === "angle" && element.rightAngleMark && !isGuaranteedRightAngle(spec, element))) {
    reasons.push("unguaranteed_right_angle");
  }

  return reasons.length === 0 ? { eligible: true, draggable, closure } : { eligible: false, reasons };
}

export type ExplorePositionVerdict = { ok: true } | { ok: false; reason: "out_of_bounds" | "invalid" | "degenerate" };

const DEGENERATE_EPSILON = 1e-9;

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function polygonArea(vertices: readonly Vec2[]): number {
  let twice = 0;
  vertices.forEach((p, index) => {
    const q = vertices[(index + 1) % vertices.length] ?? p;
    twice += p.x * q.y - q.x * p.y;
  });
  return Math.abs(twice) / 2;
}

/**
 * 탐색 중 점 `pointId`를 `xy`로 옮긴 위치가 허용되는가(순수 함수). `pxPerUnit`은 현재 보드의 px/단위다.
 * 거부되면 호출 측은 마지막 유효 위치에 둔다(§17.14 "무효 위치").
 */
export function checkExplorePosition(spec: FigureSpec, pointId: string, xy: Vec2, pxPerUnit: number): ExplorePositionVerdict {
  const [left, top, right, bottom] = spec.boundingBox;
  const pad = pxPerUnit > 0 ? EXPLORE_EDGE_PADDING_PX / pxPerUnit : 0;
  if (!(xy.x >= left + pad && xy.x <= right - pad && xy.y >= bottom + pad && xy.y <= top - pad)) return { ok: false, reason: "out_of_bounds" };

  const moved: FigureSpec = {
    ...spec,
    elements: spec.elements.map((element) => (element.id === pointId && element.type === "point" ? { ...element, x: xy.x, y: xy.y } : element)),
  };
  if (!validateFigureSemantics(moved).ok) return { ok: false, reason: "invalid" };
  const resolved = resolveFigure(moved);
  if (resolved === null) return { ok: false, reason: "invalid" };

  const tolerance = resolved.scale * DEGENERATE_EPSILON;
  const points: Vec2[] = [];
  for (const element of resolved.elements.values()) {
    if (element.kind === "point") {
      if (points.some((p) => distance(p, element.xy) <= tolerance)) return { ok: false, reason: "degenerate" };
      points.push(element.xy);
    } else if (element.kind === "line" && element.type === "segment" && distance(element.p1, element.p2) <= tolerance) {
      return { ok: false, reason: "degenerate" };
    } else if (element.kind === "polygon" && polygonArea(element.vertices) <= tolerance * resolved.scale) {
      return { ok: false, reason: "degenerate" };
    }
  }
  return { ok: true };
}
