/**
 * 잘못된 도형 명세 fixture F10 (PRD §4.12 FIG, `docs/FIGURE_SPEC.md`).
 *
 * - F10a~c: 구조는 올바르지만 의미가 잘못된 명세. Stage 1 스키마는 통과(accept)하고,
 *   Stage 2 의미 검증기가 거부(reject)해야 한다.
 * - F10d~j: 구조가 잘못된 명세. Stage 1 스키마가 `stage1Issue` 경로로 거부해야 한다.
 */
import type { FigureFixture } from "./types";

const hiddenAxes = { visible: false, xLabel: null, yLabel: null };

function point(id: string, x: number, y: number) {
  return { id, type: "point", label: id, role: "given", appearAt: null, x, y };
}

function segment(id: string, from: string, to: string) {
  return { id, type: "segment", label: null, role: "given", appearAt: null, through: [from, to], showLength: false };
}

function geometryFigure(figureId: string, elements: unknown[], extra: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    figureId,
    kind: "geometry",
    description: "잘못된 입력 검증용 도형",
    boundingBox: [-1, 5, 7, -1],
    axes: hiddenAxes,
    grid: { visible: false },
    keepAspectRatio: true,
    interaction: { mode: "fixed" },
    elements,
    constraints: [],
    steps: [],
    ...extra,
  };
}

function functionFigure(figureId: string, expr: unknown) {
  return {
    schemaVersion: 1,
    figureId,
    kind: "function",
    description: "잘못된 수식 검증용 그래프",
    boundingBox: [-5, 5, 5, -5],
    axes: { visible: true, xLabel: "x", yLabel: "y" },
    grid: { visible: true },
    keepAspectRatio: false,
    interaction: { mode: "fixed" },
    elements: [{ id: "f", type: "functionGraph", label: null, role: "given", appearAt: null, expr, domain: null }],
    constraints: [],
    steps: [],
  };
}

/** F10a 존재하지 않는 ID 참조 — segAZ가 없는 점 Z를 가리킨다. */
export const F10A_MISSING_REFERENCE: FigureFixture = {
  id: "F10a",
  title: "없는 ID 참조",
  expect: { stage1: "accept", stage2: "reject" },
  expected: { stage2Issue: { code: "unknown_reference", path: ["elements", 2, "through", 1] } },
  raw: geometryFigure("fig-f10a", [point("A", 0, 0), point("B", 4, 0), segment("segAZ", "A", "Z")]),
};

/** F10b 뒤쪽 요소 참조 — 중점 M이 아직 정의되지 않은 B를 참조한다(의존 순서 위반). */
export const F10B_FORWARD_REFERENCE: FigureFixture = {
  id: "F10b",
  title: "뒤쪽 요소 참조",
  expect: { stage1: "accept", stage2: "reject" },
  expected: { stage2Issue: { code: "forward_reference", path: ["elements", 1, "of", 1] } },
  raw: geometryFigure("fig-f10b", [
    point("A", 0, 0),
    { id: "M", type: "midpoint", label: "M", role: "auxiliary", appearAt: null, of: ["A", "B"] },
    point("B", 4, 0),
  ]),
};

/** F10c 직각 조건과 좌표 모순 — AB ⊥ AC라고 하지만 A(0,0), B(4,0), C(1,3)에서 AB·AC = 4 ≠ 0. */
export const F10C_CONTRADICTING_RIGHT_ANGLE: FigureFixture = {
  id: "F10c",
  title: "직각 조건과 좌표 모순",
  expect: { stage1: "accept", stage2: "reject" },
  expected: { stage2Issue: { code: "constraint_violation", path: ["constraints", 0] } },
  raw: geometryFigure(
    "fig-f10c",
    [point("A", 0, 0), point("B", 4, 0), point("C", 1, 3), segment("segAB", "A", "B"), segment("segAC", "A", "C")],
    { constraints: [{ type: "perpendicular", source: "given", a: "segAB", b: "segAC" }] },
  ),
};

/** F10d `<script>` 라벨. */
export const F10D_SCRIPT_LABEL: FigureFixture = {
  id: "F10d",
  title: "<script> 라벨",
  expect: { stage1: "reject", stage2: "reject" },
  stage1Issue: { path: ["elements", 0, "label"], code: "custom" },
  raw: geometryFigure("fig-f10d", [{ ...point("A", 0, 0), label: "<script>" }]),
};

/** F10e 문자열 수식 — AST가 아니라 문자열로 함수식을 보낸다. */
export const F10E_STRING_EXPRESSION: FigureFixture = {
  id: "F10e",
  title: "문자열 수식",
  expect: { stage1: "reject", stage2: "reject" },
  stage1Issue: { path: ["elements", 0, "expr"], code: "invalid_type" },
  raw: functionFigure("fig-f10e", "x^2 - 4*x + 3"),
};

/** F10f 요소 61개 — 상한(60) 초과. */
export const F10F_TOO_MANY_ELEMENTS: FigureFixture = {
  id: "F10f",
  title: "요소 61개",
  expect: { stage1: "reject", stage2: "reject" },
  stage1Issue: { path: ["elements"], code: "too_big" },
  raw: geometryFigure(
    "fig-f10f",
    Array.from({ length: 61 }, (_, index) => point(`P${index}`, index % 6, Math.floor(index / 6) % 5)),
  ),
};

/** F10g boundingBox 뒤집힘 — left > right, top < bottom. */
export const F10G_FLIPPED_BOUNDING_BOX: FigureFixture = {
  id: "F10g",
  title: "boundingBox 뒤집힘",
  expect: { stage1: "reject", stage2: "reject" },
  stage1Issue: { path: ["boundingBox"], code: "custom" },
  raw: geometryFigure("fig-f10g", [point("A", 0, 0)], { boundingBox: [7, -1, -1, 5] }),
};

/** F10h 중점에 좌표 직접 지정 — 파생 요소는 좌표를 가질 수 없다. */
export const F10H_MIDPOINT_WITH_COORDINATES: FigureFixture = {
  id: "F10h",
  title: "중점에 좌표 직접 지정",
  expect: { stage1: "reject", stage2: "reject" },
  stage1Issue: { path: ["elements", 2], code: "unrecognized_keys" },
  raw: geometryFigure("fig-f10h", [
    point("A", 0, 0),
    point("B", 4, 0),
    { id: "M", type: "midpoint", label: "M", role: "auxiliary", appearAt: null, of: ["A", "B"], x: 2, y: 0 },
  ]),
};

/** F10i 미지원 함수 — 허용 목록에 없는 `eval`. */
export const F10I_UNSUPPORTED_FUNCTION: FigureFixture = {
  id: "F10i",
  title: "미지원 fn",
  expect: { stage1: "reject", stage2: "reject" },
  stage1Issue: { path: ["elements", 0, "expr", "name"], code: "invalid_value" },
  raw: functionFigure("fig-f10i", { type: "fn", name: "eval", arg: { type: "var", name: "x" } }),
};

/** 깊이가 `depth`인 neg 사슬(맨 안쪽은 var x). */
function nestedNeg(depth: number): unknown {
  let node: unknown = { type: "var", name: "x" };
  for (let level = 1; level < depth; level += 1) node = { type: "neg", arg: node };
  return node;
}

/** F10j AST 깊이 초과 — 깊이 11(상한 10). */
export const F10J_EXPR_TOO_DEEP: FigureFixture = {
  id: "F10j",
  title: "AST 깊이 초과",
  expect: { stage1: "reject", stage2: "reject" },
  stage1Issue: { path: ["elements", 0, "expr"], code: "custom" },
  raw: functionFigure("fig-f10j", nestedNeg(11)),
};

/** 깊이 `depth`의 neg 사슬 — 테스트에서 경계값(10 허용 / 11 거부) 확인용. */
export function buildNestedNegExpr(depth: number): unknown {
  return nestedNeg(depth);
}

/** 수식만 바꾼 함수 그래프 도형 — 테스트에서 AST 경계값 확인용. */
export function buildFunctionFigure(figureId: string, expr: unknown): Record<string, unknown> {
  return functionFigure(figureId, expr);
}

/** 요소만 바꾼 기하 도형 — 테스트에서 상한·좌표 경계값 확인용. */
export function buildGeometryFigure(
  figureId: string,
  elements: unknown[],
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return geometryFigure(figureId, elements, extra);
}

export const STAGE2_REJECT_FIGURE_FIXTURES: FigureFixture[] = [
  F10A_MISSING_REFERENCE,
  F10B_FORWARD_REFERENCE,
  F10C_CONTRADICTING_RIGHT_ANGLE,
];

export const STAGE1_REJECT_FIGURE_FIXTURES: FigureFixture[] = [
  F10D_SCRIPT_LABEL,
  F10E_STRING_EXPRESSION,
  F10F_TOO_MANY_ELEMENTS,
  F10G_FLIPPED_BOUNDING_BOX,
  F10H_MIDPOINT_WITH_COORDINATES,
  F10I_UNSUPPORTED_FUNCTION,
  F10J_EXPR_TOO_DEEP,
];
