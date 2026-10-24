/**
 * 도형 명세 의미 검증기(Stage 2) — PRD §4.12 FIG, `docs/FIGURE_SPEC.md` §6, §12, §13.
 *
 * 구조 스키마(`figureSpecSchema`)를 통과한 명세에 대해 다음을 검사하고, 통과하면 요소별 계산 결과
 * (`ResolvedFigure`)를 돌려준다.
 * - 참조: 없는 ID, 뒤쪽 요소 참조(의존 순서), 자기 참조, 자리별 타입 호환, 중복 참조
 * - 단계: appearAt·steps의 stepId 일관성, 단계 순서, 강조·숨김 대상의 가시성(숨김은 누적)
 * - 수치: 퇴화, 해 없음, 화면(boundingBox) 밖, 반지름 상한, 계산량 예산
 * - 제약: 좌표와 제약의 일치(스케일 기반 허용오차)
 *
 * 규칙:
 * - **절대 throw하지 않는다.** 예기치 못한 예외는 `unexpected_error` 하나로 보고한다.
 * - ID 조회는 Map/Set만 쓴다(`constructor`·`toString` 같은 ID도 일반 ID와 똑같이 동작).
 * - 오류는 최대 `MAX_SEMANTIC_ISSUES`건까지 보고한다.
 *
 * 검증 통과는 "명세가 안전하고 서로 모순되지 않는다"는 뜻일 뿐 풀이·증명이 옳다는 뜻이 아니다.
 */
import type { FigureConstraint, FigureElement, FigureSpec } from "shared-types";
import {
  circleCrossesBox,
  circleRadius,
  cross,
  distance,
  distanceToLine,
  dot,
  footOnLine,
  intersectLines,
  isFiniteVec,
  lineCrossesBox,
  lineParameter,
  measureAngle,
  midpoint,
  norm,
  pointInBox,
  polygonSelfIntersects,
  polygonSignedArea,
  sub,
  tangentPoint,
  type Vec2,
} from "./geometry";
import { createEvalBudget, evaluateWithBudget, isDefinedGraphValue, piecesVisible, sampleFunctionGraph } from "./sampleFunction";
import {
  ANGLE_TOL_DEG,
  DEGENERATE_REL,
  DIRECTION_TOL,
  MAX_BBOX_ASPECT_RATIO,
  MAX_RADIUS_REL,
  MAX_SEMANTIC_ISSUES,
  MIN_BBOX_SPAN,
  degenerateLength,
  distanceTolerance,
  figureScale,
  lengthsEqual,
} from "./tolerance";

/* ---------------------------------------------------------------------------------------------
 * 공개 타입
 * ------------------------------------------------------------------------------------------- */

export type FigureSemanticIssueCode =
  | "unknown_reference"
  | "forward_reference"
  | "self_reference"
  | "type_mismatch"
  | "duplicate_reference"
  | "unsupported"
  | "unknown_step"
  | "step_order"
  | "not_yet_visible"
  | "invalid_bounding_box"
  | "degenerate"
  | "point_out_of_view"
  | "radius_too_large"
  | "circle_out_of_view"
  | "line_out_of_view"
  | "dependency_not_visible"
  | "no_solution"
  | "invalid_pick"
  | "no_tangent"
  | "degenerate_tangent"
  | "self_intersecting"
  | "constraint_violation"
  | "graph_not_visible"
  | "out_of_domain"
  | "undefined_at_point"
  | "compute_budget_exceeded"
  | "unexpected_error";

export interface FigureSemanticIssue {
  code: FigureSemanticIssueCode;
  /** 도형 명세 루트 기준 경로(예: `["elements", 2, "through", 1]`, `["constraints", 0]`). */
  path: (string | number)[];
  message: string;
}

export type PointElementType = "point" | "midpoint" | "foot" | "intersection" | "tangentPoint" | "pointOnGraph";
export type LineElementType = "segment" | "line" | "ray" | "lineEquation";

export type ResolvedFigureElement =
  | { kind: "point"; id: string; type: PointElementType; xy: Vec2 }
  | {
      kind: "line";
      id: string;
      type: LineElementType;
      /** segment·ray는 through 순서 그대로(ray는 p1에서 p2 방향으로 뻗음). lineEquation은 직선 위의 두 점. */
      p1: Vec2;
      p2: Vec2;
    }
  | { kind: "circle"; id: string; center: Vec2; radius: number }
  | { kind: "polygon"; id: string; vertices: Vec2[]; area: number }
  | {
      kind: "angle";
      id: string;
      /** 정규화한 순서 [첫째, 꼭짓점, 셋째] — 첫째 팔에서 셋째 팔로 반시계 방향, 180° 이하. */
      points: [string, string, string];
      xy: [Vec2, Vec2, Vec2];
      degrees: number;
    }
  | { kind: "graph"; id: string; pieces: Vec2[][]; range: [number, number] | null };

export interface ResolvedFigure {
  figureId: string;
  /** 좌표 스케일 S(= boundingBox 가로·세로 중 큰 값). */
  scale: number;
  /** 요소 ID → 계산 결과. 삽입 순서 = 의존 순서. */
  elements: Map<string, ResolvedFigureElement>;
}

export type FigureSemanticsResult =
  | { ok: true; resolved: ResolvedFigure }
  | { ok: false; issues: FigureSemanticIssue[] };

/* ---------------------------------------------------------------------------------------------
 * 타입 호환표
 * ------------------------------------------------------------------------------------------- */

const POINT_TYPES: ReadonlySet<string> = new Set<PointElementType>([
  "point",
  "midpoint",
  "foot",
  "intersection",
  "tangentPoint",
  "pointOnGraph",
]);
const LINE_TYPES: ReadonlySet<string> = new Set<LineElementType>(["segment", "line", "ray", "lineEquation"]);

type Slot = "point" | "line" | "circle" | "graph" | "segment" | "angle";

const SLOT_LABEL: Record<Slot, string> = {
  point: "점(point·midpoint·foot·intersection·tangentPoint·pointOnGraph)",
  line: "선(segment·line·ray·lineEquation)",
  circle: "circle",
  graph: "functionGraph",
  segment: "segment",
  angle: "angle",
};

function slotAccepts(slot: Slot, type: FigureElement["type"]): boolean {
  switch (slot) {
    case "point":
      return POINT_TYPES.has(type);
    case "line":
      return LINE_TYPES.has(type);
    case "circle":
      return type === "circle";
    case "graph":
      return type === "functionGraph";
    case "segment":
      return type === "segment";
    case "angle":
      return type === "angle";
    default: {
      const unreachable: never = slot;
      void unreachable;
      return false;
    }
  }
}

/* ---------------------------------------------------------------------------------------------
 * 내부 상태
 * ------------------------------------------------------------------------------------------- */

type Path = (string | number)[];

interface Context {
  spec: FigureSpec;
  scale: number;
  box: [number, number, number, number];
  issues: FigureSemanticIssue[];
  /** 모든 요소 ID → 인덱스(정의 순서). */
  indexById: Map<string, number>;
  /** 모든 요소 ID → 타입. */
  typeById: Map<string, FigureElement["type"]>;
  /** 계산에 성공한 요소. */
  resolved: Map<string, ResolvedFigureElement>;
  budget: ReturnType<typeof createEvalBudget>;
  budgetExceeded: boolean;
}

function report(ctx: Context, code: FigureSemanticIssueCode, path: Path, message: string): void {
  if (ctx.issues.length < MAX_SEMANTIC_ISSUES) ctx.issues.push({ code, path, message });
}

/**
 * 요소 정의 안의 참조 하나를 검사한다. 통과하면 true.
 * 참조 대상이 앞에서 계산에 실패했으면 false를 돌려주되 새 오류는 보고하지 않는다(원인 오류가 이미 있다).
 */
function checkElementRef(ctx: Context, selfId: string, selfIndex: number, ref: string, slot: Slot, path: Path): boolean {
  if (ref === selfId) {
    report(ctx, "self_reference", path, `요소 ${selfId}가 자기 자신을 참조합니다.`);
    return false;
  }
  const refIndex = ctx.indexById.get(ref);
  if (refIndex === undefined) {
    report(ctx, "unknown_reference", path, `존재하지 않는 요소 ID를 참조합니다.`);
    return false;
  }
  if (refIndex > selfIndex) {
    report(ctx, "forward_reference", path, `뒤쪽에 정의된 요소를 참조합니다(앞쪽 요소만 참조 가능).`);
    return false;
  }
  const refType = ctx.typeById.get(ref);
  if (refType === undefined || !slotAccepts(slot, refType)) {
    report(ctx, "type_mismatch", path, `이 자리에는 ${SLOT_LABEL[slot]}만 올 수 있습니다.`);
    return false;
  }
  return ctx.resolved.has(ref);
}

/** 제약·단계·상호작용에서 요소를 참조할 때의 검사(순서 제약 없음). */
function checkLooseRef(ctx: Context, ref: string, slot: Slot | null, path: Path): boolean {
  const refType = ctx.typeById.get(ref);
  if (refType === undefined) {
    report(ctx, "unknown_reference", path, `존재하지 않는 요소 ID를 참조합니다.`);
    return false;
  }
  if (slot !== null && !slotAccepts(slot, refType)) {
    report(ctx, "type_mismatch", path, `이 자리에는 ${SLOT_LABEL[slot]}만 올 수 있습니다.`);
    return false;
  }
  return true;
}

/** 목록 안의 중복 ID를 보고한다(두 번째 등장 위치). 중복이 있으면 true. */
function reportDuplicates(ctx: Context, ids: readonly string[], basePath: Path): boolean {
  const seen = new Set<string>();
  let found = false;
  ids.forEach((id, index) => {
    if (seen.has(id)) {
      report(ctx, "duplicate_reference", [...basePath, index], `같은 요소를 두 번 참조합니다.`);
      found = true;
    }
    seen.add(id);
  });
  return found;
}

function getPoint(ctx: Context, id: string): Vec2 | null {
  const element = ctx.resolved.get(id);
  return element?.kind === "point" ? element.xy : null;
}

function getLine(ctx: Context, id: string): Extract<ResolvedFigureElement, { kind: "line" }> | null {
  const element = ctx.resolved.get(id);
  return element?.kind === "line" ? element : null;
}

function getCircle(ctx: Context, id: string): Extract<ResolvedFigureElement, { kind: "circle" }> | null {
  const element = ctx.resolved.get(id);
  return element?.kind === "circle" ? element : null;
}

/* ---------------------------------------------------------------------------------------------
 * 요소 계산
 * ------------------------------------------------------------------------------------------- */

function addPoint(ctx: Context, element: FigureElement, type: PointElementType, xy: Vec2, path: Path): void {
  if (!isFiniteVec(xy)) {
    report(ctx, "degenerate", path, "점 좌표를 계산할 수 없습니다.");
    return;
  }
  if (!pointInBox(xy, ctx.box, degenerateLength(ctx.scale))) {
    report(ctx, "point_out_of_view", path, "점이 boundingBox 밖에 있습니다.");
    return;
  }
  ctx.resolved.set(element.id, { kind: "point", id: element.id, type, xy });
}

function resolveElement(ctx: Context, element: FigureElement, index: number): void {
  const base: Path = ["elements", index];
  const ref = (refId: string, slot: Slot, field: Path): boolean =>
    checkElementRef(ctx, element.id, index, refId, slot, [...base, ...field]);
  const minLength = degenerateLength(ctx.scale);

  switch (element.type) {
    case "point": {
      addPoint(ctx, element, "point", { x: element.x, y: element.y }, base);
      return;
    }
    case "midpoint": {
      const [a, b] = element.of;
      const okA = ref(a, "point", ["of", 0]);
      const okB = ref(b, "point", ["of", 1]);
      if (a === b) report(ctx, "duplicate_reference", [...base, "of", 1], "같은 점을 두 번 참조합니다.");
      const pa = okA ? getPoint(ctx, a) : null;
      const pb = okB ? getPoint(ctx, b) : null;
      if (pa === null || pb === null || a === b) return;
      addPoint(ctx, element, "midpoint", midpoint(pa, pb), base);
      return;
    }
    case "foot": {
      const okFrom = ref(element.from, "point", ["from"]);
      const okTo = ref(element.to, "line", ["to"]);
      const p = okFrom ? getPoint(ctx, element.from) : null;
      const line = okTo ? getLine(ctx, element.to) : null;
      if (p === null || line === null) return;
      const foot = footOnLine(p, line.p1, line.p2);
      if (foot === null) {
        report(ctx, "degenerate", base, "수선의 발을 계산할 수 없습니다.");
        return;
      }
      addPoint(ctx, element, "foot", foot, base);
      return;
    }
    case "intersection": {
      const [a, b] = element.of;
      let blocked = false;
      element.of.forEach((refId, k) => {
        if (ctx.typeById.get(refId) === "circle" && (ctx.indexById.get(refId) ?? Number.POSITIVE_INFINITY) < index) {
          report(ctx, "unsupported", [...base, "of", k], "원이 포함된 교점은 아직 지원하지 않습니다.");
          blocked = true;
        }
      });
      if (blocked) return;
      const okA = ref(a, "line", ["of", 0]);
      const okB = ref(b, "line", ["of", 1]);
      if (a === b) report(ctx, "duplicate_reference", [...base, "of", 1], "같은 선을 두 번 참조합니다.");
      if (element.pick !== 0) {
        report(ctx, "invalid_pick", [...base, "pick"], "두 직선의 교점은 하나뿐이므로 pick은 0이어야 합니다.");
        return;
      }
      const la = okA ? getLine(ctx, a) : null;
      const lb = okB ? getLine(ctx, b) : null;
      if (la === null || lb === null || a === b) return;
      const result = intersectLines(la.p1, la.p2, lb.p1, lb.p2, DEGENERATE_REL);
      if (result.kind === "parallel") {
        report(ctx, "no_solution", base, "두 직선이 평행(또는 일치)해서 교점이 없습니다.");
        return;
      }
      addPoint(ctx, element, "intersection", result.point, base);
      return;
    }
    case "tangentPoint": {
      const okCircle = ref(element.circle, "circle", ["circle"]);
      const okFrom = ref(element.from, "point", ["from"]);
      const circle = okCircle ? getCircle(ctx, element.circle) : null;
      const p = okFrom ? getPoint(ctx, element.from) : null;
      if (circle === null || p === null) return;
      const result = tangentPoint(
        circle.center,
        circle.radius,
        p,
        element.select,
        distanceTolerance(ctx.scale),
      );
      if (result.kind === "inside") {
        report(ctx, "no_tangent", base, "점이 원 안에 있어 접선이 없습니다.");
        return;
      }
      if (result.kind === "on_circle") {
        report(ctx, "degenerate_tangent", base, "점이 원 위에 있어 접점이 그 점 자신으로 퇴화합니다.");
        return;
      }
      addPoint(ctx, element, "tangentPoint", result.point, base);
      return;
    }
    case "pointOnGraph": {
      if (!ref(element.graph, "graph", ["graph"])) return;
      const graphElement = ctx.spec.elements[ctx.indexById.get(element.graph) ?? -1];
      if (graphElement?.type !== "functionGraph") return;
      if (graphElement.domain !== null && (element.x < graphElement.domain[0] || element.x > graphElement.domain[1])) {
        report(ctx, "out_of_domain", [...base, "x"], "x가 함수의 정의역(domain) 밖입니다.");
        return;
      }
      if (ctx.budgetExceeded) return;
      const y = evaluateWithBudget(graphElement.expr, element.x, ctx.budget);
      if (y === null) {
        ctx.budgetExceeded = true;
        report(ctx, "compute_budget_exceeded", base, "도형의 계산량 예산을 넘었습니다.");
        return;
      }
      if (!isDefinedGraphValue(y)) {
        report(ctx, "undefined_at_point", [...base, "x"], "이 x에서 함숫값이 정의되지 않습니다.");
        return;
      }
      addPoint(ctx, element, "pointOnGraph", { x: element.x, y }, base);
      return;
    }
    case "segment":
    case "line":
    case "ray": {
      const [a, b] = element.through;
      const okA = ref(a, "point", ["through", 0]);
      const okB = ref(b, "point", ["through", 1]);
      if (a === b) report(ctx, "duplicate_reference", [...base, "through", 1], "같은 점을 두 번 참조합니다.");
      const pa = okA ? getPoint(ctx, a) : null;
      const pb = okB ? getPoint(ctx, b) : null;
      if (pa === null || pb === null || a === b) return;
      if (!(distance(pa, pb) > minLength)) {
        report(ctx, "degenerate", [...base, "through"], "두 점이 같은 위치에 있어 선을 정할 수 없습니다.");
        return;
      }
      if (!lineCrossesBox(pa, pb, ctx.box, distanceTolerance(ctx.scale))) {
        report(ctx, "line_out_of_view", base, "선이 boundingBox와 만나지 않습니다.");
        return;
      }
      ctx.resolved.set(element.id, { kind: "line", id: element.id, type: element.type, p1: pa, p2: pb });
      return;
    }
    case "lineEquation": {
      const n = Math.hypot(element.a, element.b);
      // a, b가 c/S에 비해 거의 0이면(직선이 사실상 무한히 멀거나 정의되지 않음) 퇴화로 본다.
      // 계수 스케일 = max(|a|, |b|, |c| / S). a = b = 0도 여기서 걸린다.
      const coefficientScale = Math.max(Math.abs(element.a), Math.abs(element.b), Math.abs(element.c) / ctx.scale);
      if (!(n > 0) || !(n > DEGENERATE_REL * coefficientScale)) {
        report(ctx, "degenerate", base, "a와 b가 0이거나 거의 0이라 직선이 아닙니다.");
        return;
      }
      // 직선 위에서 boundingBox 중심에 가장 가까운 점 p1과, 방향 (−b, a)로 S만큼 떨어진 p2.
      const [left, top, right, bottom] = ctx.box;
      const center = { x: (left + right) / 2, y: (top + bottom) / 2 };
      const nx = element.a / n;
      const ny = element.b / n;
      const offset = nx * center.x + ny * center.y - element.c / n;
      const p1 = { x: center.x - offset * nx, y: center.y - offset * ny };
      const p2 = { x: p1.x - ny * ctx.scale, y: p1.y + nx * ctx.scale };
      if (!isFiniteVec(p1) || !isFiniteVec(p2)) {
        report(ctx, "degenerate", base, "직선을 계산할 수 없습니다.");
        return;
      }
      if (!lineCrossesBox(p1, p2, ctx.box, distanceTolerance(ctx.scale))) {
        report(ctx, "line_out_of_view", base, "직선이 boundingBox와 만나지 않습니다.");
        return;
      }
      ctx.resolved.set(element.id, { kind: "line", id: element.id, type: "lineEquation", p1, p2 });
      return;
    }
    case "circle": {
      const okCenter = ref(element.center, "point", ["center"]);
      const okThrough = element.through === null ? true : ref(element.through, "point", ["through"]);
      if (element.through !== null && element.through === element.center) {
        report(ctx, "duplicate_reference", [...base, "through"], "중심과 같은 점을 지나는 원은 반지름이 0입니다.");
        return;
      }
      const center = okCenter ? getPoint(ctx, element.center) : null;
      const through = element.through === null ? null : okThrough ? getPoint(ctx, element.through) : null;
      if (center === null || (element.through !== null && through === null)) return;
      const radius = circleRadius(center, element.radius, through);
      const radiusPath: Path = element.radius !== null ? [...base, "radius"] : [...base, "through"];
      if (!(radius > minLength) || !Number.isFinite(radius)) {
        report(ctx, "degenerate", radiusPath, "반지름이 너무 작습니다(퇴화한 원).");
        return;
      }
      if (radius > MAX_RADIUS_REL * ctx.scale) {
        report(ctx, "radius_too_large", radiusPath, `반지름이 boundingBox 크기의 ${MAX_RADIUS_REL}배를 넘습니다.`);
        return;
      }
      if (!circleCrossesBox(center, radius, ctx.box)) {
        report(ctx, "circle_out_of_view", base, "원의 둘레가 boundingBox와 만나지 않습니다.");
        return;
      }
      ctx.resolved.set(element.id, { kind: "circle", id: element.id, center, radius });
      return;
    }
    case "polygon": {
      const oks = element.vertices.map((vertexId, k) => ref(vertexId, "point", ["vertices", k]));
      const hasDuplicate = reportDuplicates(ctx, element.vertices, [...base, "vertices"]);
      if (hasDuplicate || oks.some((ok) => !ok)) return;
      const vertices: Vec2[] = [];
      for (const vertexId of element.vertices) {
        const p = getPoint(ctx, vertexId);
        if (p === null) return;
        vertices.push(p);
      }
      for (let k = 0; k < vertices.length; k += 1) {
        const current = vertices[k];
        const next = vertices[(k + 1) % vertices.length];
        if (current === undefined || next === undefined || !(distance(current, next) > minLength)) {
          report(ctx, "degenerate", [...base, "vertices"], "이웃한 두 꼭짓점이 같은 위치에 있습니다.");
          return;
        }
      }
      const area = polygonSignedArea(vertices);
      const areaTolerance = DEGENERATE_REL * ctx.scale * ctx.scale;
      if (!(Math.abs(area) > areaTolerance)) {
        report(ctx, "degenerate", [...base, "vertices"], "다각형의 넓이가 너무 작습니다(퇴화).");
        return;
      }
      if (polygonSelfIntersects(vertices, areaTolerance, minLength)) {
        report(ctx, "self_intersecting", [...base, "vertices"], "다각형의 변이 서로 교차합니다.");
        return;
      }
      ctx.resolved.set(element.id, { kind: "polygon", id: element.id, vertices, area: Math.abs(area) });
      return;
    }
    case "angle": {
      const [a, vertex, c] = element.points;
      const oks = element.points.map((pointId, k) => ref(pointId, "point", ["points", k]));
      const hasDuplicate = reportDuplicates(ctx, element.points, [...base, "points"]);
      if (hasDuplicate || oks.some((ok) => !ok)) return;
      const pa = getPoint(ctx, a);
      const pv = getPoint(ctx, vertex);
      const pc = getPoint(ctx, c);
      if (pa === null || pv === null || pc === null) return;
      const measure =
        distance(pa, pv) > minLength && distance(pc, pv) > minLength ? measureAngle(pa, pv, pc) : null;
      if (measure === null || measure.degrees < ANGLE_TOL_DEG) {
        report(ctx, "degenerate", [...base, "points"], "각의 두 변이 겹치거나 길이가 0입니다.");
        return;
      }
      if (element.rightAngleMark && Math.abs(measure.degrees - 90) > ANGLE_TOL_DEG) {
        report(ctx, "constraint_violation", [...base, "rightAngleMark"], "직각 표시가 있지만 각이 90°가 아닙니다.");
        return;
      }
      const points: [string, string, string] = measure.swapped ? [c, vertex, a] : [a, vertex, c];
      const xy: [Vec2, Vec2, Vec2] = measure.swapped ? [pc, pv, pa] : [pa, pv, pc];
      ctx.resolved.set(element.id, { kind: "angle", id: element.id, points, xy, degrees: measure.degrees });
      return;
    }
    case "functionGraph": {
      if (ctx.budgetExceeded) return;
      const result = sampleFunctionGraph(element.expr, { domain: element.domain, boundingBox: ctx.box, budget: ctx.budget });
      if (!result.ok) {
        ctx.budgetExceeded = true;
        report(ctx, "compute_budget_exceeded", base, "도형의 계산량 예산을 넘었습니다.");
        return;
      }
      const [, top, , bottom] = ctx.box;
      if (!piecesVisible(result.pieces, top, bottom)) {
        report(ctx, "graph_not_visible", base, "boundingBox 안에 보이는 그래프 점이 없습니다.");
        return;
      }
      ctx.resolved.set(element.id, { kind: "graph", id: element.id, pieces: result.pieces, range: result.range });
      return;
    }
    default: {
      const unreachable: never = element;
      void unreachable;
      return;
    }
  }
}

/* ---------------------------------------------------------------------------------------------
 * 제약
 * ------------------------------------------------------------------------------------------- */

/** 점 p가 선(종류별 범위 포함) 위에 있는지. */
function pointOnLineWithinRange(p: Vec2, line: Extract<ResolvedFigureElement, { kind: "line" }>, scale: number): boolean {
  const tolerance = distanceTolerance(scale);
  if (!(distanceToLine(p, line.p1, line.p2) <= tolerance)) return false;
  if (line.type === "line" || line.type === "lineEquation") return true;
  const length = distance(line.p1, line.p2);
  const t = lineParameter(p, line.p1, line.p2);
  const slack = tolerance / length;
  if (line.type === "ray") return t >= -slack;
  return t >= -slack && t <= 1 + slack;
}

function direction(line: Extract<ResolvedFigureElement, { kind: "line" }>): Vec2 {
  return sub(line.p2, line.p1);
}

function checkConstraint(ctx: Context, constraint: FigureConstraint, index: number): void {
  const base: Path = ["constraints", index];
  const violated = (message: string): void => report(ctx, "constraint_violation", base, message);

  switch (constraint.type) {
    case "perpendicular":
    case "parallel": {
      const okA = checkLooseRef(ctx, constraint.a, "line", [...base, "a"]);
      const okB = checkLooseRef(ctx, constraint.b, "line", [...base, "b"]);
      const la = okA ? getLine(ctx, constraint.a) : null;
      const lb = okB ? getLine(ctx, constraint.b) : null;
      if (la === null || lb === null) return;
      const da = direction(la);
      const db = direction(lb);
      const lengths = norm(da) * norm(db);
      if (constraint.type === "perpendicular") {
        if (!(Math.abs(dot(da, db)) / lengths <= DIRECTION_TOL)) violated("두 선이 수직이 아닙니다.");
      } else if (!(Math.abs(cross(da, db)) / lengths <= DIRECTION_TOL)) {
        violated("두 선이 평행하지 않습니다.");
      }
      return;
    }
    case "equalLength": {
      const okA = checkLooseRef(ctx, constraint.a, "segment", [...base, "a"]);
      const okB = checkLooseRef(ctx, constraint.b, "segment", [...base, "b"]);
      const la = okA ? getLine(ctx, constraint.a) : null;
      const lb = okB ? getLine(ctx, constraint.b) : null;
      if (la === null || lb === null) return;
      if (!lengthsEqual(distance(la.p1, la.p2), distance(lb.p1, lb.p2), ctx.scale)) violated("두 선분의 길이가 다릅니다.");
      return;
    }
    case "length": {
      const ok = checkLooseRef(ctx, constraint.segment, "segment", [...base, "segment"]);
      const line = ok ? getLine(ctx, constraint.segment) : null;
      if (line === null) return;
      if (!lengthsEqual(distance(line.p1, line.p2), constraint.value, ctx.scale)) {
        violated("선분의 좌표상 길이가 조건의 길이와 다릅니다.");
      }
      return;
    }
    case "angleMeasure": {
      const ok = checkLooseRef(ctx, constraint.angle, "angle", [...base, "angle"]);
      if (constraint.degrees > 180) {
        report(ctx, "unsupported", [...base, "degrees"], "180°를 넘는 각 조건은 아직 지원하지 않습니다.");
        return;
      }
      const angle = ok ? ctx.resolved.get(constraint.angle) : undefined;
      if (angle?.kind !== "angle") return;
      if (!(Math.abs(angle.degrees - constraint.degrees) <= ANGLE_TOL_DEG)) violated("각의 크기가 조건과 다릅니다.");
      return;
    }
    case "pointOnCircle": {
      const okP = checkLooseRef(ctx, constraint.point, "point", [...base, "point"]);
      const okC = checkLooseRef(ctx, constraint.circle, "circle", [...base, "circle"]);
      const p = okP ? getPoint(ctx, constraint.point) : null;
      const circle = okC ? getCircle(ctx, constraint.circle) : null;
      if (p === null || circle === null) return;
      if (!lengthsEqual(distance(p, circle.center), circle.radius, ctx.scale)) violated("점이 원 위에 있지 않습니다.");
      return;
    }
    case "pointOnLine": {
      const okP = checkLooseRef(ctx, constraint.point, "point", [...base, "point"]);
      const okL = checkLooseRef(ctx, constraint.line, "line", [...base, "line"]);
      const p = okP ? getPoint(ctx, constraint.point) : null;
      const line = okL ? getLine(ctx, constraint.line) : null;
      if (p === null || line === null) return;
      if (!pointOnLineWithinRange(p, line, ctx.scale)) violated("점이 선 위(선분·반직선은 범위 포함)에 있지 않습니다.");
      return;
    }
    case "tangent": {
      const okL = checkLooseRef(ctx, constraint.line, "line", [...base, "line"]);
      const okC = checkLooseRef(ctx, constraint.circle, "circle", [...base, "circle"]);
      const line = okL ? getLine(ctx, constraint.line) : null;
      const circle = okC ? getCircle(ctx, constraint.circle) : null;
      if (line === null || circle === null) return;
      const touch = footOnLine(circle.center, line.p1, line.p2);
      if (
        touch === null ||
        !lengthsEqual(distance(touch, circle.center), circle.radius, ctx.scale) ||
        !pointOnLineWithinRange(touch, line, ctx.scale)
      ) {
        violated("선이 원에 접하지 않습니다.");
      }
      return;
    }
    case "collinear": {
      const oks = constraint.points.map((pointId, k) => checkLooseRef(ctx, pointId, "point", [...base, "points", k]));
      const hasDuplicate = reportDuplicates(ctx, constraint.points, [...base, "points"]);
      if (hasDuplicate || oks.some((ok) => !ok)) return;
      const points: Vec2[] = [];
      for (const pointId of constraint.points) {
        const p = getPoint(ctx, pointId);
        if (p === null) return;
        points.push(p);
      }
      // 첫 점에서 가장 먼 점을 기준선으로 삼는다(가까운 두 점으로 방향을 정하면 불안정하다).
      const first = points[0];
      if (first === undefined) return;
      let far = first;
      for (const p of points) if (distance(first, p) > distance(first, far)) far = p;
      if (!(distance(first, far) > degenerateLength(ctx.scale))) {
        violated("점들이 모두 같은 위치라 일직선을 정할 수 없습니다.");
        return;
      }
      const tolerance = distanceTolerance(ctx.scale);
      if (points.some((p) => !(distanceToLine(p, first, far) <= tolerance))) violated("점들이 한 직선 위에 있지 않습니다.");
      return;
    }
    default: {
      const unreachable: never = constraint;
      void unreachable;
      return;
    }
  }
}

/* ---------------------------------------------------------------------------------------------
 * 단계·상호작용
 * ------------------------------------------------------------------------------------------- */

function stepNumber(stepId: string): number {
  return Number.parseInt(stepId.slice(1), 10);
}

function checkSteps(ctx: Context, stepOrder: Map<string, number>): void {
  const { spec } = ctx;

  let previous = 0;
  spec.steps.forEach((step, index) => {
    const n = stepNumber(step.stepId);
    if (!(n > previous)) report(ctx, "step_order", ["steps", index, "stepId"], "steps는 sN 오름차순이어야 합니다.");
    previous = Math.max(previous, n);
  });

  // 요소의 등장 단계 인덱스(−1 = 처음부터).
  const appearIndex = new Map<string, number>();
  spec.elements.forEach((element, index) => {
    if (element.appearAt === null) {
      appearIndex.set(element.id, -1);
      return;
    }
    const order = stepOrder.get(element.appearAt);
    if (order === undefined) {
      report(ctx, "unknown_step", ["elements", index, "appearAt"], "steps에 없는 stepId입니다.");
      return;
    }
    appearIndex.set(element.id, order);
  });

  checkDependencyVisibility(ctx, appearIndex);

  // 숨김은 누적된다(D6): 한 번 숨긴 요소는 이후 단계에서도 숨겨진 상태다.
  const hidden = new Set<string>();
  spec.steps.forEach((step, stepIndex) => {
    const base: Path = ["steps", stepIndex];
    reportDuplicates(ctx, step.highlight, [...base, "highlight"]);
    reportDuplicates(ctx, step.hide, [...base, "hide"]);
    const highlighted = new Set(step.highlight);

    const checkVisible = (id: string, path: Path): void => {
      if (!checkLooseRef(ctx, id, null, path)) return;
      const appear = appearIndex.get(id);
      if (appear === undefined) return; // appearAt 오류가 이미 보고됨
      if (appear > stepIndex) {
        report(ctx, "not_yet_visible", path, "아직 등장하지 않은 요소입니다.");
      } else if (hidden.has(id)) {
        report(ctx, "not_yet_visible", path, "앞 단계에서 이미 숨긴 요소입니다.");
      }
    };

    step.highlight.forEach((id, k) => checkVisible(id, [...base, "highlight", k]));
    step.hide.forEach((id, k) => {
      if (highlighted.has(id)) {
        report(ctx, "duplicate_reference", [...base, "hide", k], "같은 단계에서 강조와 숨김을 동시에 지정했습니다.");
        return;
      }
      checkVisible(id, [...base, "hide", k]);
    });
    step.hide.forEach((id) => hidden.add(id));
  });
}

/** 요소가 참조(의존)하는 요소 ID 목록. 좌표를 직접 갖는 요소(point, lineEquation, functionGraph)는 빈 목록. */
export function elementDependencies(element: FigureElement): string[] {
  switch (element.type) {
    case "point":
    case "lineEquation":
    case "functionGraph":
      return [];
    case "midpoint":
    case "intersection":
      return [...element.of];
    case "foot":
      return [element.from, element.to];
    case "tangentPoint":
      return [element.circle, element.from];
    case "pointOnGraph":
      return [element.graph];
    case "segment":
    case "line":
    case "ray":
      return [...element.through];
    case "circle":
      return element.through === null ? [element.center] : [element.center, element.through];
    case "polygon":
      return [...element.vertices];
    case "angle":
      return [...element.points];
    default: {
      const unreachable: never = element;
      void unreachable;
      return [];
    }
  }
}

/**
 * 의존 요소 가시성(Stage 2 QA LOW-1, 후속 정리 QA LOW 2·3):
 * 1. 요소는 자기가 참조하는 요소보다 먼저 등장할 수 없다(appearAt 순서). 모든 요소에 적용.
 * 2. 참조 대상이 숨겨지는 단계에서 그 요소를 참조하는 요소가 보이는 채로 남으면 안 된다(함께 hide).
 * 3. 이미 숨겨진 요소에 의존하는 요소가 그 이후(또는 같은) 단계에 새로 등장하면 안 된다.
 *
 * 2·3은 참조 점을 그려서 만드는 요소(선분·직선·반직선·원·다각형·각 등)에만 적용한다. 점류(midpoint·foot·
 * intersection·tangentPoint·pointOnGraph)는 계산된 좌표만 있으면 되므로 부모가 숨겨져도 보일 수 있다
 * (오너 결정, 예: F06에서 두 직선을 숨기고 교점 P만 남김).
 */
function checkDependencyVisibility(ctx: Context, appearIndex: ReadonlyMap<string, number>): void {
  const { spec } = ctx;
  spec.elements.forEach((element, index) => {
    const own = appearIndex.get(element.id);
    if (own === undefined) return;
    for (const dependency of elementDependencies(element)) {
      const depAppear = appearIndex.get(dependency);
      if (depAppear !== undefined && own < depAppear) {
        report(
          ctx,
          "dependency_not_visible",
          ["elements", index, "appearAt"],
          "참조하는 요소보다 먼저 등장할 수 없습니다.",
        );
        return;
      }
    }
  });

  // 각 요소가 처음 숨겨지는 단계(누적).
  const hiddenAt = new Map<string, number>();
  spec.steps.forEach((step, stepIndex) => {
    for (const id of step.hide) if (!hiddenAt.has(id)) hiddenAt.set(id, stepIndex);
  });

  // 규칙 3: 숨겨진 부모에 의존하는 요소가 그 뒤에 등장.
  spec.elements.forEach((element, index) => {
    if (POINT_TYPES.has(element.type)) return;
    const own = appearIndex.get(element.id);
    if (own === undefined) return;
    for (const dependency of elementDependencies(element)) {
      const hidden = hiddenAt.get(dependency);
      if (hidden !== undefined && hidden <= own) {
        report(
          ctx,
          "dependency_not_visible",
          ["elements", index, "appearAt"],
          "이미 숨긴 요소를 참조하는 요소가 등장합니다.",
        );
        return;
      }
    }
  });

  // 규칙 2: 부모를 숨기는데 의존 요소가 보이는 채로 남음.
  const hidden = new Set<string>();
  spec.steps.forEach((step, stepIndex) => {
    step.hide.forEach((id) => hidden.add(id));
    step.hide.forEach((hiddenId, hideIndex) => {
      for (const element of spec.elements) {
        if (POINT_TYPES.has(element.type) || hidden.has(element.id)) continue;
        const appear = appearIndex.get(element.id);
        if (appear === undefined || appear > stepIndex) continue;
        if (elementDependencies(element).includes(hiddenId)) {
          report(
            ctx,
            "dependency_not_visible",
            ["steps", stepIndex, "hide", hideIndex],
            `숨긴 요소를 참조하는 요소(${element.id})가 계속 보입니다. 함께 숨겨야 합니다.`,
          );
          return;
        }
      }
    });
  });
}

function checkInteraction(ctx: Context): void {
  const { interaction } = ctx.spec;
  if (interaction.mode !== "explore") return;
  const base: Path = ["interaction", "draggable"];
  reportDuplicates(ctx, interaction.draggable, base);
  interaction.draggable.forEach((id, k) => {
    const type = ctx.typeById.get(id);
    if (type === undefined) {
      report(ctx, "unknown_reference", [...base, k], "존재하지 않는 요소 ID를 참조합니다.");
    } else if (type !== "point") {
      report(ctx, "type_mismatch", [...base, k], "끌 수 있는 요소는 자유 점(point)뿐입니다.");
    }
  });
}

function checkBoundingBox(ctx: Context): void {
  const [left, top, right, bottom] = ctx.box;
  const width = right - left;
  const height = top - bottom;
  if (!(width >= MIN_BBOX_SPAN) || !(height >= MIN_BBOX_SPAN)) {
    report(ctx, "invalid_bounding_box", ["boundingBox"], `boundingBox 가로·세로는 ${MIN_BBOX_SPAN} 이상이어야 합니다.`);
    return;
  }
  if (ctx.spec.keepAspectRatio && Math.max(width, height) / Math.min(width, height) > MAX_BBOX_ASPECT_RATIO) {
    report(
      ctx,
      "invalid_bounding_box",
      ["boundingBox"],
      `keepAspectRatio 도형의 boundingBox 가로세로비는 1:${MAX_BBOX_ASPECT_RATIO} 이하여야 합니다.`,
    );
  }
}

/* ---------------------------------------------------------------------------------------------
 * 공개 API
 * ------------------------------------------------------------------------------------------- */

/**
 * 구조 스키마를 통과한 도형 명세의 의미를 검증한다. 절대 throw하지 않는다.
 * 통과하면 요소별 계산 결과(`resolved`)를, 실패하면 오류 목록(최대 10건)을 돌려준다.
 */
export function validateFigureSemantics(spec: FigureSpec): FigureSemanticsResult {
  try {
    const box: [number, number, number, number] = [
      spec.boundingBox[0],
      spec.boundingBox[1],
      spec.boundingBox[2],
      spec.boundingBox[3],
    ];
    const ctx: Context = {
      spec,
      scale: figureScale(box),
      box,
      issues: [],
      indexById: new Map(),
      typeById: new Map(),
      resolved: new Map(),
      budget: createEvalBudget(),
      budgetExceeded: false,
    };

    checkBoundingBox(ctx);

    spec.elements.forEach((element, index) => {
      if (!ctx.indexById.has(element.id)) {
        ctx.indexById.set(element.id, index);
        ctx.typeById.set(element.id, element.type);
      }
    });

    const stepOrder = new Map<string, number>();
    spec.steps.forEach((step, index) => {
      if (!stepOrder.has(step.stepId)) stepOrder.set(step.stepId, index);
    });

    spec.elements.forEach((element, index) => resolveElement(ctx, element, index));
    checkInteraction(ctx);
    spec.constraints.forEach((constraint, index) => checkConstraint(ctx, constraint, index));
    checkSteps(ctx, stepOrder);

    if (ctx.issues.length > 0) return { ok: false, issues: ctx.issues };
    return { ok: true, resolved: { figureId: spec.figureId, scale: ctx.scale, elements: ctx.resolved } };
  } catch {
    return { ok: false, issues: [{ code: "unexpected_error", path: [], message: "도형을 검증하는 중 예기치 못한 오류가 발생했습니다." }] };
  }
}

/** 의미 검증을 통과하면 계산 결과를, 아니면 null을 돌려준다(렌더러용 편의 함수). */
export function resolveFigure(spec: FigureSpec): ResolvedFigure | null {
  const result = validateFigureSemantics(spec);
  return result.ok ? result.resolved : null;
}
