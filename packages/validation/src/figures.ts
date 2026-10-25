/**
 * 도형 시각화 명세(FigureSpec) 런타임 검증 스키마 — PRD §4.12 FIG, `docs/FIGURE_SPEC.md`.
 *
 * Stage 1 범위(구조 검증):
 * - 형식(ID 패턴, 라벨 문자, 수치 범위, 유한수), 상한(요소·제약·단계·AST 크기), 모르는 키 거부.
 * - 파생 요소(중점·수선의 발·교점·접점·그래프 위 점)는 좌표 필드를 가질 수 없다(strictObject).
 * - 함수는 제한된 수식 AST만 허용한다(문자열 수식·임의 코드 금지).
 *
 * 의미 검증(Stage 2)은 `./figures/semantics`의 `validateFigureSemantics`가 맡는다: 존재하지 않는
 * ID 참조, 뒤쪽 요소 참조(의존 순서), 요소 타입 호환성(예: foot.to가 선인지), 좌표와 제약의 모순,
 * 퇴화 도형. 이 스키마만 통과했다고 해서 렌더링 가능한 도형이라는 뜻은 아니다 — 관대 파서
 * `parseSolutionFigures`는 두 검증을 모두 통과한 도형만 받아들인다.
 *
 * shared-types의 도메인 타입과 `z.infer` 결과가 서로 할당 가능한지 파일 하단에서 컴파일 단계로
 * 단언한다(`FigureSchemaTypeContract`).
 */
import { z } from "zod";
import type {
  ExprNode,
  FigureConstraint,
  FigureElement,
  FigureSpec,
  FigureStepState,
  StepFigureRef,
} from "shared-types";
import { validateFigureSemantics, type FigureSemanticIssue } from "./figures/semantics";

export * from "./figures/tolerance";
export * from "./figures/geometry";
export * from "./figures/expr";
export * from "./figures/sampleFunction";
export * from "./figures/format";
export * from "./figures/semantics";
export * from "./figures/steps";
export * from "./figures/candidate";
export * from "./figures/chatSummary";

/* ---------------------------------------------------------------------------------------------
 * 상한 상수
 * ------------------------------------------------------------------------------------------- */

export const FIGURE_SCHEMA_VERSION = 1;
/** 풀이 1건당 도형 수 상한. */
export const MAX_FIGURES = 3;
/** 도형 1개당 요소 수 상한. */
export const MAX_FIGURE_ELEMENTS = 60;
/** 도형 1개당 제약 수 상한. */
export const MAX_FIGURE_CONSTRAINTS = 40;
/** 도형 1개당 단계 상태 수 상한. */
export const MAX_FIGURE_STEPS = 20;
/** 풀이 1건당 단계↔도형 연결 수 상한(단계 상한 × 도형 상한). */
export const MAX_STEP_FIGURE_REFS = MAX_FIGURE_STEPS * MAX_FIGURES;
/** 함수 수식 AST 노드 수 상한. */
export const MAX_EXPR_NODES = 64;
/** 함수 수식 AST 깊이 상한(루트 = 1). */
export const MAX_EXPR_DEPTH = 10;
/** 라벨 최대 길이. */
export const MAX_LABEL_LENGTH = 16;
/** 도형 설명 최대 길이. */
export const MAX_DESCRIPTION_LENGTH = 500;
/** 좌표·수치 절댓값 상한. */
export const MAX_ABS_COORDINATE = 1e6;
/** boundingBox 가로·세로 상한. */
export const MAX_BOUNDING_BOX_SPAN = 1e4;
/** 관대 파서 1회당 rejected 항목 상한(쓰레기 입력이 로그를 부풀리지 않게). */
export const MAX_FIGURE_REJECTIONS = 20;
/** 관대 파서 1회당 의미 검증 실행 상한(도형마다 계산 예산이 있으므로 전체 계산량을 묶는다). */
export const MAX_SEMANTIC_CHECKS_PER_PARSE = MAX_FIGURES * 3;

/* ---------------------------------------------------------------------------------------------
 * 원시 스키마
 * ------------------------------------------------------------------------------------------- */

const ELEMENT_ID_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,15}$/;
const FIGURE_ID_PATTERN = /^fig-[a-z0-9]{1,16}$/;
const STEP_ID_PATTERN = /^s[1-9][0-9]?$/;

/** 유한한 수치(zod 4 `z.number()`는 NaN·±Infinity를 거부한다) + 절댓값 상한. */
const coordinateSchema = z.number().min(-MAX_ABS_COORDINATE).max(MAX_ABS_COORDINATE);
const positiveMeasureSchema = z.number().gt(0).max(MAX_ABS_COORDINATE);

export const figureElementIdSchema = z.string().regex(ELEMENT_ID_PATTERN);
export const figureIdSchema = z.string().regex(FIGURE_ID_PATTERN);
export const figureStepIdSchema = z.string().regex(STEP_ID_PATTERN);

/**
 * 라벨 금지 문자(Stage 2 강화, Stage 1 QA LOW 2 + Stage 2 QA LOW-2). 렌더러도 같은 함수로 2차 제거한다.
 * - 양방향 제어문자: U+061C, U+200E, U+200F, U+202A–U+202E, U+2066–U+2069(라벨 순서 뒤집기 스푸핑)
 * - 제로폭·BOM: U+200B–U+200D, U+FEFF
 * - 줄·문단 구분자: U+2028, U+2029
 * - 보이지 않는 결합·서식 문자: U+2060–U+2064(word joiner, 보이지 않는 수학 연산자), U+00AD(soft hyphen),
 *   U+FE00–U+FE0F(변형 선택자, 이모지 U+FE0F 포함), U+E0000–U+E007F(태그 문자), U+180E(몽골 모음 구분자)
 * - 빈 칸처럼 보이는 채움 문자: U+3164(한글 채움), U+FFA0(반각 한글 채움), U+115F·U+1160(한글 초성·중성 채움)
 */
export function isForbiddenLabelCodePoint(code: number): boolean {
  return (
    code === 0x00ad ||
    code === 0x061c ||
    code === 0x115f ||
    code === 0x1160 ||
    code === 0x180e ||
    (code >= 0x200b && code <= 0x200f) ||
    (code >= 0x2028 && code <= 0x202e) ||
    (code >= 0x2060 && code <= 0x2064) ||
    (code >= 0x2066 && code <= 0x2069) ||
    code === 0x3164 ||
    (code >= 0xfe00 && code <= 0xfe0f) ||
    code === 0xfeff ||
    code === 0xffa0 ||
    (code >= 0xe0000 && code <= 0xe007f)
  );
}

/**
 * 제어문자(C0·DEL·C1), HTML 특수문자 `<`·`>`·`&`, `isForbiddenLabelCodePoint` 문자가 없으면 true.
 */
export function isSafeLabelText(value: string): boolean {
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 0x20 || (code >= 0x7f && code <= 0x9f)) return false;
    if (char === "<" || char === ">" || char === "&") return false;
    if (isForbiddenLabelCodePoint(code)) return false;
  }
  return true;
}

export const figureLabelSchema = z
  .string()
  .min(1)
  .max(MAX_LABEL_LENGTH)
  .refine(isSafeLabelText, { message: "라벨에 제어문자, <, >, &, 양방향 제어문자, 제로폭 문자를 쓸 수 없습니다." });

const idListSchema = (min: number, max: number) => z.array(figureElementIdSchema).min(min).max(max);

/* ---------------------------------------------------------------------------------------------
 * 수식 AST
 * ------------------------------------------------------------------------------------------- */

/**
 * 재귀 수식 트리 스키마. 직접 노출하지 않는다 — 깊이·노드 수를 먼저 확인하는
 * `exprNodeSchema`를 통해서만 사용해 깊은 입력이 재귀 파싱에 들어가지 않게 한다.
 */
const exprTreeSchema: z.ZodType<ExprNode> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.strictObject({ type: z.literal("num"), value: coordinateSchema }),
    z.strictObject({ type: z.literal("var"), name: z.literal("x") }),
    z.strictObject({ type: z.literal("const"), name: z.enum(["pi", "e"]) }),
    z.strictObject({
      type: z.enum(["add", "sub", "mul", "div", "pow"]),
      args: z.tuple([exprTreeSchema, exprTreeSchema]),
    }),
    z.strictObject({ type: z.literal("neg"), arg: exprTreeSchema }),
    z.strictObject({
      type: z.literal("fn"),
      name: z.enum(["sin", "cos", "tan", "sqrt", "abs", "ln", "log10", "exp"]),
      arg: exprTreeSchema,
    }),
  ]),
);

/** 원시 입력의 AST 크기를 반복(비재귀)으로 측정한다. 상한을 넘으면 즉시 멈춘다. */
function measureExprSize(raw: unknown): { nodes: number; depth: number } {
  let nodes = 0;
  let depth = 0;
  const stack: { value: unknown; level: number }[] = [{ value: raw, level: 1 }];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined) break;
    nodes += 1;
    depth = Math.max(depth, current.level);
    if (nodes > MAX_EXPR_NODES || depth > MAX_EXPR_DEPTH) break;
    const { value, level } = current;
    if (typeof value !== "object" || value === null || Array.isArray(value)) continue;
    const record = value as Record<string, unknown>;
    const args = record["args"];
    if (Array.isArray(args)) {
      for (const child of args.slice(0, 2)) stack.push({ value: child, level: level + 1 });
    }
    if ("arg" in record) stack.push({ value: record["arg"], level: level + 1 });
  }
  return { nodes, depth };
}

/** 함수 수식 AST 스키마(노드 ≤ 64, 깊이 ≤ 10). */
export const exprNodeSchema = z
  .unknown()
  .superRefine((raw, ctx) => {
    const { nodes, depth } = measureExprSize(raw);
    if (depth > MAX_EXPR_DEPTH) {
      ctx.addIssue({ code: "custom", message: `수식 AST 깊이는 ${MAX_EXPR_DEPTH} 이하여야 합니다.` });
    } else if (nodes > MAX_EXPR_NODES) {
      ctx.addIssue({ code: "custom", message: `수식 AST 노드는 ${MAX_EXPR_NODES}개 이하여야 합니다.` });
    }
  })
  .pipe(exprTreeSchema);

/* ---------------------------------------------------------------------------------------------
 * 요소
 * ------------------------------------------------------------------------------------------- */

const elementBaseShape = {
  id: figureElementIdSchema,
  label: figureLabelSchema.nullable(),
  role: z.enum(["given", "auxiliary", "result"]),
  appearAt: figureStepIdSchema.nullable(),
};

const pointElementSchema = z.strictObject({
  ...elementBaseShape,
  type: z.literal("point"),
  x: coordinateSchema,
  y: coordinateSchema,
});

const midpointElementSchema = z.strictObject({
  ...elementBaseShape,
  type: z.literal("midpoint"),
  of: z.tuple([figureElementIdSchema, figureElementIdSchema]),
});

const footElementSchema = z.strictObject({
  ...elementBaseShape,
  type: z.literal("foot"),
  from: figureElementIdSchema,
  to: figureElementIdSchema,
});

const intersectionElementSchema = z.strictObject({
  ...elementBaseShape,
  type: z.literal("intersection"),
  of: z.tuple([figureElementIdSchema, figureElementIdSchema]),
  pick: z.union([z.literal(0), z.literal(1)]),
});

const tangentPointElementSchema = z.strictObject({
  ...elementBaseShape,
  type: z.literal("tangentPoint"),
  circle: figureElementIdSchema,
  from: figureElementIdSchema,
  select: z.enum(["ccw", "cw"]),
});

const pointOnGraphElementSchema = z.strictObject({
  ...elementBaseShape,
  type: z.literal("pointOnGraph"),
  graph: figureElementIdSchema,
  x: coordinateSchema,
});

const lineLikeElementSchema = z.strictObject({
  ...elementBaseShape,
  type: z.enum(["segment", "line", "ray"]),
  through: z.tuple([figureElementIdSchema, figureElementIdSchema]),
  showLength: z.boolean(),
});

const lineEquationElementSchema = z.strictObject({
  ...elementBaseShape,
  type: z.literal("lineEquation"),
  a: coordinateSchema,
  b: coordinateSchema,
  c: coordinateSchema,
});

const circleElementSchema = z.strictObject({
  ...elementBaseShape,
  type: z.literal("circle"),
  center: figureElementIdSchema,
  radius: positiveMeasureSchema.nullable(),
  through: figureElementIdSchema.nullable(),
});

const polygonElementSchema = z.strictObject({
  ...elementBaseShape,
  type: z.literal("polygon"),
  vertices: idListSchema(3, 12),
});

const angleElementSchema = z.strictObject({
  ...elementBaseShape,
  type: z.literal("angle"),
  points: z.tuple([figureElementIdSchema, figureElementIdSchema, figureElementIdSchema]),
  showMeasure: z.boolean(),
  rightAngleMark: z.boolean(),
});

const functionDomainSchema = z
  .tuple([coordinateSchema, coordinateSchema])
  .refine(([start, end]) => start < end, { message: "domain은 [시작, 끝]이며 시작 < 끝이어야 합니다." });

const functionGraphElementSchema = z.strictObject({
  ...elementBaseShape,
  type: z.literal("functionGraph"),
  expr: exprNodeSchema,
  domain: functionDomainSchema.nullable(),
});

export const figureElementSchema = z.discriminatedUnion("type", [
  pointElementSchema,
  midpointElementSchema,
  footElementSchema,
  intersectionElementSchema,
  tangentPointElementSchema,
  pointOnGraphElementSchema,
  lineLikeElementSchema,
  lineEquationElementSchema,
  circleElementSchema,
  polygonElementSchema,
  angleElementSchema,
  functionGraphElementSchema,
]);

/* ---------------------------------------------------------------------------------------------
 * 제약
 * ------------------------------------------------------------------------------------------- */

const constraintSourceShape = { source: z.enum(["given", "derived"]) };

export const figureConstraintSchema = z.discriminatedUnion("type", [
  z.strictObject({
    ...constraintSourceShape,
    type: z.enum(["perpendicular", "parallel", "equalLength"]),
    a: figureElementIdSchema,
    b: figureElementIdSchema,
  }),
  z.strictObject({
    ...constraintSourceShape,
    type: z.literal("length"),
    segment: figureElementIdSchema,
    value: positiveMeasureSchema,
  }),
  z.strictObject({
    ...constraintSourceShape,
    type: z.literal("angleMeasure"),
    angle: figureElementIdSchema,
    degrees: z.number().gt(0).lt(360),
  }),
  z.strictObject({
    ...constraintSourceShape,
    type: z.literal("pointOnCircle"),
    point: figureElementIdSchema,
    circle: figureElementIdSchema,
  }),
  z.strictObject({
    ...constraintSourceShape,
    type: z.literal("pointOnLine"),
    point: figureElementIdSchema,
    line: figureElementIdSchema,
  }),
  z.strictObject({
    ...constraintSourceShape,
    type: z.literal("tangent"),
    line: figureElementIdSchema,
    circle: figureElementIdSchema,
  }),
  z.strictObject({
    ...constraintSourceShape,
    type: z.literal("collinear"),
    points: idListSchema(3, MAX_FIGURE_ELEMENTS),
  }),
]);

/* ---------------------------------------------------------------------------------------------
 * 도형 명세
 * ------------------------------------------------------------------------------------------- */

export const figureStepStateSchema = z.strictObject({
  stepId: figureStepIdSchema,
  highlight: idListSchema(0, MAX_FIGURE_ELEMENTS),
  hide: idListSchema(0, MAX_FIGURE_ELEMENTS),
});

const boundingBoxSchema = z
  .tuple([coordinateSchema, coordinateSchema, coordinateSchema, coordinateSchema])
  .superRefine(([left, top, right, bottom], ctx) => {
    if (!(left < right)) {
      ctx.addIssue({ code: "custom", message: "boundingBox는 left < right여야 합니다." });
    } else if (right - left > MAX_BOUNDING_BOX_SPAN) {
      ctx.addIssue({ code: "custom", message: `boundingBox 가로는 ${MAX_BOUNDING_BOX_SPAN} 이하여야 합니다.` });
    }
    if (!(top > bottom)) {
      ctx.addIssue({ code: "custom", message: "boundingBox는 top > bottom이어야 합니다." });
    } else if (top - bottom > MAX_BOUNDING_BOX_SPAN) {
      ctx.addIssue({ code: "custom", message: `boundingBox 세로는 ${MAX_BOUNDING_BOX_SPAN} 이하여야 합니다.` });
    }
  });

const interactionSchema = z.discriminatedUnion("mode", [
  z.strictObject({ mode: z.literal("fixed") }),
  z.strictObject({ mode: z.literal("explore"), draggable: idListSchema(1, MAX_FIGURE_ELEMENTS) }),
]);

export const figureSpecSchema = z
  .strictObject({
    schemaVersion: z.literal(FIGURE_SCHEMA_VERSION),
    figureId: figureIdSchema,
    kind: z.enum(["geometry", "function"]),
    description: z.string().min(1).max(MAX_DESCRIPTION_LENGTH),
    boundingBox: boundingBoxSchema,
    axes: z.strictObject({
      visible: z.boolean(),
      xLabel: figureLabelSchema.nullable(),
      yLabel: figureLabelSchema.nullable(),
    }),
    grid: z.strictObject({ visible: z.boolean() }),
    keepAspectRatio: z.boolean(),
    interaction: interactionSchema,
    elements: z.array(figureElementSchema).min(1).max(MAX_FIGURE_ELEMENTS),
    constraints: z.array(figureConstraintSchema).max(MAX_FIGURE_CONSTRAINTS),
    steps: z.array(figureStepStateSchema).max(MAX_FIGURE_STEPS),
  })
  .superRefine((spec, ctx) => {
    if (spec.kind === "geometry" && !spec.keepAspectRatio) {
      ctx.addIssue({
        code: "custom",
        path: ["keepAspectRatio"],
        message: "geometry 도형은 keepAspectRatio가 true여야 합니다.",
      });
    }

    const seenElementIds = new Set<string>();
    spec.elements.forEach((element, index) => {
      if (seenElementIds.has(element.id)) {
        ctx.addIssue({ code: "custom", path: ["elements", index, "id"], message: "요소 ID가 중복됩니다." });
      }
      seenElementIds.add(element.id);

      if (element.type === "circle" && (element.radius === null) === (element.through === null)) {
        ctx.addIssue({
          code: "custom",
          path: ["elements", index],
          message: "circle은 radius와 through 중 정확히 하나만 값을 가져야 합니다.",
        });
      }
    });

    const seenStepIds = new Set<string>();
    spec.steps.forEach((step, index) => {
      if (seenStepIds.has(step.stepId)) {
        ctx.addIssue({ code: "custom", path: ["steps", index, "stepId"], message: "stepId가 중복됩니다." });
      }
      seenStepIds.add(step.stepId);
    });
  });

export const stepFigureRefSchema = z.strictObject({
  stepId: figureStepIdSchema,
  figureId: figureIdSchema,
});

/* ---------------------------------------------------------------------------------------------
 * 관대 파서
 * ------------------------------------------------------------------------------------------- */

export interface FigureRejection {
  /** 형식이 올바른 figureId를 읽을 수 있었을 때만 채운다(악성 문자열을 그대로 싣지 않는다). */
  figureId?: string;
  reason: string;
}

export interface ParsedSolutionFigures {
  figures: FigureSpec[];
  stepFigureRefs: StepFigureRef[];
  rejected: FigureRejection[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readSafeFigureId(candidate: unknown): string | undefined {
  if (!isRecord(candidate)) return undefined;
  const figureId = candidate["figureId"];
  return typeof figureId === "string" && FIGURE_ID_PATTERN.test(figureId) ? figureId : undefined;
}

function summarizeIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 3)
    .map((issue) => `${issue.path.map(String).join(".") || "(root)"}: ${issue.message}`)
    .join("; ");
}

function summarizeSemanticIssues(issues: readonly FigureSemanticIssue[]): string {
  return issues
    .slice(0, 3)
    .map((issue) => `${issue.code} at ${issue.path.map(String).join(".") || "(root)"}`)
    .join("; ");
}

function rejection(figureId: string | undefined, reason: string): FigureRejection {
  return figureId === undefined ? { reason } : { figureId, reason };
}

/**
 * 풀이 응답(또는 저장 데이터)의 `figures`/`stepFigureRefs`를 관대하게 파싱한다.
 *
 * - 절대 throw하지 않는다. 도형 하나가 잘못돼도 그 도형만 버리고 나머지와 텍스트 풀이는 유지된다.
 *   후보의 `figureId` getter가 throw해도 그 후보만 `unexpected_error`로 버린다.
 * - 입력이 객체가 아니거나 `figures`가 배열이 아니면 빈 결과를 돌려준다.
 * - 모르는 `schemaVersion`은 거부한다. 구조 스키마를 통과한 도형은 의미 검증
 *   (`validateFigureSemantics`)도 통과해야 한다(`invalid_semantics: <code> at <path>`, 최대 3건).
 * - 같은 figureId가 다시 나오면 뒤의 것을 거부한다. 도형은 앞에서부터 최대 `MAX_FIGURES`개까지만 받는다.
 * - `rejected`는 최대 `MAX_FIGURE_REJECTIONS`건, 의미 검증은 호출당 최대 `MAX_SEMANTIC_CHECKS_PER_PARSE`회.
 * - `stepFigureRefs`는 받아들여진 도형을 가리키는 항목만 남긴다(중복 제거). 이 필드의 getter가
 *   throw해도 받아들인 도형은 유지한다.
 */
export function parseSolutionFigures(raw: unknown): ParsedSolutionFigures {
  const figures: FigureSpec[] = [];
  const stepFigureRefs: StepFigureRef[] = [];
  const rejected: FigureRejection[] = [];
  const reject = (figureId: string | undefined, reason: string): void => {
    if (rejected.length < MAX_FIGURE_REJECTIONS) rejected.push(rejection(figureId, reason));
  };

  try {
    if (!isRecord(raw)) return { figures, stepFigureRefs, rejected };

    const rawFigures = raw["figures"];
    if (Array.isArray(rawFigures)) {
      const acceptedIds = new Set<string>();
      let semanticChecks = 0;
      for (const candidate of rawFigures) {
        let figureId: string | undefined;
        try {
          figureId = readSafeFigureId(candidate);
          if (figures.length >= MAX_FIGURES) {
            reject(figureId, `figure_limit_exceeded: 도형은 최대 ${MAX_FIGURES}개입니다.`);
            continue;
          }
          if (isRecord(candidate) && candidate["schemaVersion"] !== FIGURE_SCHEMA_VERSION) {
            reject(figureId, "unsupported_schema_version");
            continue;
          }
          const parsed = figureSpecSchema.safeParse(candidate);
          if (!parsed.success) {
            reject(figureId, `invalid_figure: ${summarizeIssues(parsed.error)}`);
            continue;
          }
          if (semanticChecks >= MAX_SEMANTIC_CHECKS_PER_PARSE) {
            reject(figureId, "semantic_check_limit_exceeded");
            continue;
          }
          semanticChecks += 1;
          const semantics = validateFigureSemantics(parsed.data);
          if (!semantics.ok) {
            reject(figureId, `invalid_semantics: ${summarizeSemanticIssues(semantics.issues)}`);
            continue;
          }
          if (acceptedIds.has(parsed.data.figureId)) {
            reject(figureId, "duplicate_figure_id");
            continue;
          }
          acceptedIds.add(parsed.data.figureId);
          figures.push(parsed.data);
        } catch {
          reject(figureId, "unexpected_error");
        }
      }

      try {
        const rawRefs = raw["stepFigureRefs"];
        if (Array.isArray(rawRefs)) {
          const seenRefs = new Set<string>();
          for (const candidate of rawRefs) {
            if (stepFigureRefs.length >= MAX_STEP_FIGURE_REFS) break;
            try {
              const parsed = stepFigureRefSchema.safeParse(candidate);
              if (!parsed.success || !acceptedIds.has(parsed.data.figureId)) continue;
              const key = `${parsed.data.stepId}|${parsed.data.figureId}`;
              if (seenRefs.has(key)) continue;
              seenRefs.add(key);
              stepFigureRefs.push(parsed.data);
            } catch {
              // 잘못된 연결 항목은 조용히 버린다 — 도형 자체는 단계 연결 없이도 표시할 수 있다.
            }
          }
        }
      } catch {
        // stepFigureRefs 자체를 읽을 수 없으면 단계 연결 없이 도형만 돌려준다.
      }
    }
  } catch {
    return { figures: [], stepFigureRefs: [], rejected: [{ reason: "unexpected_error" }] };
  }

  return { figures, stepFigureRefs, rejected };
}

/* ---------------------------------------------------------------------------------------------
 * 컴파일 단계 단언 — z.infer와 shared-types 도메인 타입이 서로 할당 가능해야 한다.
 * 어느 한쪽만 바뀌면 이 타입이 `true` 제약을 어겨 typecheck가 실패한다.
 * ------------------------------------------------------------------------------------------- */

type MutuallyAssignable<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type ExpectTrue<T extends true> = T;

export type FigureSchemaTypeContract = [
  ExpectTrue<MutuallyAssignable<z.infer<typeof figureSpecSchema>, FigureSpec>>,
  ExpectTrue<MutuallyAssignable<z.infer<typeof figureElementSchema>, FigureElement>>,
  ExpectTrue<MutuallyAssignable<z.infer<typeof figureConstraintSchema>, FigureConstraint>>,
  ExpectTrue<MutuallyAssignable<z.infer<typeof figureStepStateSchema>, FigureStepState>>,
  ExpectTrue<MutuallyAssignable<z.infer<typeof stepFigureRefSchema>, StepFigureRef>>,
  ExpectTrue<MutuallyAssignable<z.infer<typeof exprNodeSchema>, ExprNode>>,
];
