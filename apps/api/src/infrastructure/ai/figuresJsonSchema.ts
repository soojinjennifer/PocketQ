/**
 * 도형 생성·보정 호출의 OpenAI strict 구조화 출력 JSON Schema — `docs/FIGURE_SPEC.md` §3, §16.
 *
 * `validation`의 zod 스키마(`figureSpecSchema` 등)와 키 집합이 1:1로 같아야 한다
 * (`figuresJsonSchema.test.ts`가 변형마다 키 집합·required·판별자 값을 비교한다, S3-12).
 *
 * strict 모드 규칙(OpenAI Structured Outputs 공식 문서, §16 출처 참고):
 * - 모든 객체는 `additionalProperties: false`이고 `required`에 모든 키를 둔다(선택값은 null 허용으로 표현).
 * - 루트는 객체여야 하고 루트에 anyOf를 쓸 수 없다 → 봉투 객체 `{ figures, stepFigureRefs, omitReason }`.
 * - 판별 유니온은 anyOf + 판별자 enum. 재귀 수식 AST는 `$defs.expr` 재귀 참조.
 * - 문자열 길이·라벨 금지 문자 등 strict가 표현하지 못하는 규칙은 서버의 zod 검증이 맡는다.
 *   이 스키마는 "모양"만 강제하며, 통과했다고 받아들이지 않는다(서버 재검증 필수).
 */

type JsonSchema = Record<string, unknown>;

const ELEMENT_ID: JsonSchema = { type: "string", pattern: "^[A-Za-z][A-Za-z0-9_]{0,15}$" };
const FIGURE_ID: JsonSchema = { type: "string", pattern: "^fig-[a-z0-9]{1,16}$" };
const STEP_ID: JsonSchema = { type: "string", pattern: "^s[1-9][0-9]?$" };
const COORDINATE: JsonSchema = { type: "number", minimum: -1e6, maximum: 1e6 };
const POSITIVE_MEASURE: JsonSchema = { type: "number", exclusiveMinimum: 0, maximum: 1e6 };
const BOOLEAN: JsonSchema = { type: "boolean" };
const LABEL: JsonSchema = { type: ["string", "null"] };

function nullable(schema: JsonSchema): JsonSchema {
  return { anyOf: [schema, { type: "null" }] };
}

function literal(...values: readonly (string | number)[]): JsonSchema {
  return typeof values[0] === "number" ? { type: "integer", enum: [...values] } : { type: "string", enum: [...values] };
}

/** 모든 키를 required로 두고 모르는 키를 금지하는 strict 객체. */
function strictObject(properties: Record<string, JsonSchema>): JsonSchema {
  return { type: "object", properties, required: Object.keys(properties), additionalProperties: false };
}

function idTuple(length: number): JsonSchema {
  return { type: "array", items: ELEMENT_ID, minItems: length, maxItems: length };
}

function idList(min: number, max: number): JsonSchema {
  return { type: "array", items: ELEMENT_ID, minItems: min, maxItems: max };
}

const EXPR_REF: JsonSchema = { $ref: "#/$defs/expr" };
const FIGURE_REF: JsonSchema = { $ref: "#/$defs/figure" };

/** `ExprNode` — `$defs.expr`에서 자기 자신을 재귀 참조한다. */
const EXPR_SCHEMA: JsonSchema = {
  anyOf: [
    strictObject({ type: literal("num"), value: COORDINATE }),
    strictObject({ type: literal("var"), name: literal("x") }),
    strictObject({ type: literal("const"), name: literal("pi", "e") }),
    strictObject({
      type: literal("add", "sub", "mul", "div", "pow"),
      args: { type: "array", items: EXPR_REF, minItems: 2, maxItems: 2 },
    }),
    strictObject({ type: literal("neg"), arg: EXPR_REF }),
    strictObject({
      type: literal("fn"),
      name: literal("sin", "cos", "tan", "sqrt", "abs", "ln", "log10", "exp"),
      arg: EXPR_REF,
    }),
  ],
};

const ELEMENT_BASE: Record<string, JsonSchema> = {
  id: ELEMENT_ID,
  label: LABEL,
  role: literal("given", "auxiliary", "result"),
  appearAt: nullable(STEP_ID),
};

function element(type: JsonSchema, fields: Record<string, JsonSchema>): JsonSchema {
  return strictObject({ ...ELEMENT_BASE, type, ...fields });
}

/** `FigureElement` 변형 — 순서는 `figureElementSchema`와 같다. */
export const FIGURE_ELEMENT_VARIANTS: readonly JsonSchema[] = [
  element(literal("point"), { x: COORDINATE, y: COORDINATE }),
  element(literal("midpoint"), { of: idTuple(2) }),
  element(literal("foot"), { from: ELEMENT_ID, to: ELEMENT_ID }),
  element(literal("intersection"), { of: idTuple(2), pick: literal(0, 1) }),
  element(literal("tangentPoint"), { circle: ELEMENT_ID, from: ELEMENT_ID, select: literal("ccw", "cw") }),
  element(literal("pointOnGraph"), { graph: ELEMENT_ID, x: COORDINATE }),
  element(literal("segment", "line", "ray"), { through: idTuple(2), showLength: BOOLEAN }),
  element(literal("lineEquation"), { a: COORDINATE, b: COORDINATE, c: COORDINATE }),
  element(literal("circle"), { center: ELEMENT_ID, radius: nullable(POSITIVE_MEASURE), through: nullable(ELEMENT_ID) }),
  element(literal("polygon"), { vertices: idList(3, 12) }),
  element(literal("angle"), { points: idTuple(3), showMeasure: BOOLEAN, rightAngleMark: BOOLEAN }),
  element(literal("functionGraph"), {
    expr: EXPR_REF,
    domain: nullable({ type: "array", items: COORDINATE, minItems: 2, maxItems: 2 }),
  }),
];

const SOURCE: JsonSchema = literal("given", "derived");

/** `FigureConstraint` 변형 — 순서는 `figureConstraintSchema`와 같다. */
export const FIGURE_CONSTRAINT_VARIANTS: readonly JsonSchema[] = [
  strictObject({ source: SOURCE, type: literal("perpendicular", "parallel", "equalLength"), a: ELEMENT_ID, b: ELEMENT_ID }),
  strictObject({ source: SOURCE, type: literal("length"), segment: ELEMENT_ID, value: POSITIVE_MEASURE }),
  strictObject({
    source: SOURCE,
    type: literal("angleMeasure"),
    angle: ELEMENT_ID,
    degrees: { type: "number", exclusiveMinimum: 0, exclusiveMaximum: 360 },
  }),
  strictObject({ source: SOURCE, type: literal("pointOnCircle"), point: ELEMENT_ID, circle: ELEMENT_ID }),
  strictObject({ source: SOURCE, type: literal("pointOnLine"), point: ELEMENT_ID, line: ELEMENT_ID }),
  strictObject({ source: SOURCE, type: literal("tangent"), line: ELEMENT_ID, circle: ELEMENT_ID }),
  strictObject({ source: SOURCE, type: literal("collinear"), points: idList(3, 60) }),
];

export const FIGURE_INTERACTION_VARIANTS: readonly JsonSchema[] = [
  strictObject({ mode: literal("fixed") }),
  strictObject({ mode: literal("explore"), draggable: idList(1, 60) }),
];

export const FIGURE_STEP_STATE_SCHEMA: JsonSchema = strictObject({
  stepId: STEP_ID,
  highlight: idList(0, 60),
  hide: idList(0, 60),
});

export const STEP_FIGURE_REF_SCHEMA: JsonSchema = strictObject({ stepId: STEP_ID, figureId: FIGURE_ID });

/** `FigureSpec` — `$defs.figure`. */
export const FIGURE_SPEC_SCHEMA: JsonSchema = strictObject({
  schemaVersion: literal(1),
  figureId: FIGURE_ID,
  kind: literal("geometry", "function"),
  description: { type: "string" },
  boundingBox: { type: "array", items: COORDINATE, minItems: 4, maxItems: 4 },
  axes: strictObject({ visible: BOOLEAN, xLabel: LABEL, yLabel: LABEL }),
  grid: strictObject({ visible: BOOLEAN }),
  keepAspectRatio: BOOLEAN,
  interaction: { anyOf: [...FIGURE_INTERACTION_VARIANTS] },
  elements: { type: "array", items: { anyOf: [...FIGURE_ELEMENT_VARIANTS] }, minItems: 1, maxItems: 60 },
  constraints: { type: "array", items: { anyOf: [...FIGURE_CONSTRAINT_VARIANTS] }, maxItems: 40 },
  steps: { type: "array", items: FIGURE_STEP_STATE_SCHEMA, maxItems: 20 },
});

/** AI가 도형을 만들지 않은 이유(평가용, 클라이언트에 보내지 않는다). */
export const FIGURE_OMIT_REASONS = ["not_helpful", "unsupported", "insufficient_info"] as const;
export type FigureOmitReason = (typeof FIGURE_OMIT_REASONS)[number];

const DEFS: JsonSchema = { figure: FIGURE_SPEC_SCHEMA, expr: EXPR_SCHEMA };

/** 생성 호출 봉투 `{ figures, stepFigureRefs, omitReason }`. */
export const FIGURES_ENVELOPE_JSON_SCHEMA: JsonSchema = {
  ...strictObject({
    figures: { type: "array", items: FIGURE_REF, maxItems: 3 },
    stepFigureRefs: { type: "array", items: STEP_FIGURE_REF_SCHEMA, maxItems: 60 },
    omitReason: nullable({ type: "string", enum: [...FIGURE_OMIT_REASONS] }),
  }),
  $defs: DEFS,
};

/** 보정 호출 출력 `{ figure: FigureSpec | null }`. */
export const FIGURE_REPAIR_JSON_SCHEMA: JsonSchema = {
  ...strictObject({ figure: nullable(FIGURE_REF) }),
  $defs: DEFS,
};
