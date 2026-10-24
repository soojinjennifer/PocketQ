/**
 * 도형 시각화 데이터 계약(Stage 1) 테스트 — PRD §4.12 FIG, `docs/FIGURE_SPEC.md`.
 * 실행 동작은 바꾸지 않고, `validation` 패키지의 스키마·관대 파서·하위 호환만 검증한다.
 */
import { describe, expect, it } from "vitest";
import {
  MAX_EXPR_DEPTH,
  MAX_EXPR_NODES,
  MAX_FIGURE_CONSTRAINTS,
  MAX_FIGURE_ELEMENTS,
  MAX_FIGURE_STEPS,
  MAX_FIGURES,
  figureSpecSchema,
  parseSolutionFigures,
  problemHistoryDetailSchema,
  resumeSolutionSchema,
  solutionSchema,
} from "validation";
import {
  F01_TRIANGLE_ANGLE,
  F07_QUADRATIC,
  L01_SOLUTION_WITHOUT_FIGURES,
  L02_HISTORY_DETAIL_WITHOUT_FIGURES,
  L03_RESUME_SOLUTION_WITHOUT_FIGURES,
  STAGE1_REJECT_FIGURE_FIXTURES,
  STAGE2_REJECT_FIGURE_FIXTURES,
  VALID_FIGURE_FIXTURES,
  buildFunctionFigure,
  buildGeometryFigure,
  buildNestedNegExpr,
} from "validation/src/figures/fixtures";

type Issue = { path: PropertyKey[]; code: string; keys?: string[] };

function issuesOf(raw: unknown): Issue[] {
  const result = figureSpecSchema.safeParse(raw);
  return result.success ? [] : result.error.issues;
}

function expectRejectedAt(raw: unknown, path: PropertyKey[], code?: string): void {
  const issues = issuesOf(raw);
  expect(issues.length).toBeGreaterThan(0);
  expect(issues).toContainEqual(expect.objectContaining(code === undefined ? { path } : { path, code }));
}

function point(id: string, x: number, y: number) {
  return { id, type: "point", label: id, role: "given", appearAt: null, x, y };
}

/** 깊은 복사 후 경로의 값을 바꾼 F01 사본. */
function withF01(mutate: (figure: Record<string, unknown>) => void): Record<string, unknown> {
  const figure = structuredClone(F01_TRIANGLE_ANGLE.raw) as Record<string, unknown>;
  mutate(figure);
  return figure;
}

describe("AC-2 정상 fixture(F01~F09)와 의미 오류 fixture(F10a~c)는 Stage 1 스키마를 통과한다", () => {
  it.each(VALID_FIGURE_FIXTURES.map((fixture) => [fixture.id, fixture] as const))("%s", (_id, fixture) => {
    expect(fixture.expect).toEqual({ stage1: "accept", stage2: "accept" });
    const result = figureSpecSchema.safeParse(fixture.raw);
    expect(result.success).toBe(true);
    // 파싱 결과가 입력과 같다(값 변형·키 제거 없음).
    expect(result.data).toEqual(fixture.raw);
  });

  it.each(STAGE2_REJECT_FIGURE_FIXTURES.map((fixture) => [fixture.id, fixture] as const))(
    "%s (Stage 2에서 거부 예정)",
    (_id, fixture) => {
      expect(fixture.expect).toEqual({ stage1: "accept", stage2: "reject" });
      expect(figureSpecSchema.safeParse(fixture.raw).success).toBe(true);
    },
  );
});

describe("AC-3 구조 오류 fixture(F10d~j)는 정확한 경로로 거부된다", () => {
  it.each(STAGE1_REJECT_FIGURE_FIXTURES.map((fixture) => [fixture.id, fixture] as const))("%s", (_id, fixture) => {
    expect(fixture.expect.stage1).toBe("reject");
    expect(fixture.stage1Issue).toBeDefined();
    if (fixture.stage1Issue === undefined) return;
    expectRejectedAt(fixture.raw, fixture.stage1Issue.path, fixture.stage1Issue.code);
  });

  it("F10h는 좌표 키 x, y를 unrecognized_keys로 보고한다", () => {
    const fixture = STAGE1_REJECT_FIGURE_FIXTURES.find((item) => item.id === "F10h");
    const issue = issuesOf(fixture?.raw).find((item) => item.code === "unrecognized_keys");
    expect(issue?.keys).toEqual(["x", "y"]);
  });
});

describe("AC-4 파생 요소는 좌표를 가질 수 없다", () => {
  const base = [point("A", 0, 0), point("B", 4, 0)];
  const derived: [string, Record<string, unknown>][] = [
    ["midpoint", { id: "M", type: "midpoint", label: null, role: "auxiliary", appearAt: null, of: ["A", "B"] }],
    ["foot", { id: "H", type: "foot", label: null, role: "auxiliary", appearAt: null, from: "A", to: "B" }],
    ["intersection", { id: "P", type: "intersection", label: null, role: "result", appearAt: null, of: ["A", "B"], pick: 0 }],
    [
      "tangentPoint",
      { id: "T", type: "tangentPoint", label: null, role: "result", appearAt: null, circle: "A", from: "B", select: "ccw" },
    ],
  ];

  it.each(derived)("%s: 좌표 없이는 통과", (_type, element) => {
    expect(figureSpecSchema.safeParse(buildGeometryFigure("fig-ac4", [...base, element])).success).toBe(true);
  });

  it.each(derived)("%s: x/y를 넣으면 unrecognized_keys로 거부", (_type, element) => {
    expectRejectedAt(buildGeometryFigure("fig-ac4", [...base, { ...element, x: 1, y: 1 }]), ["elements", 2], "unrecognized_keys");
  });

  it("pointOnGraph는 x만 갖고 y는 가질 수 없다", () => {
    const figure = structuredClone(F07_QUADRATIC.raw) as { elements: Record<string, unknown>[] };
    const vertex = figure.elements[1];
    if (vertex === undefined) throw new Error("F07 fixture 구조가 바뀌었다");
    vertex["y"] = -1;
    expectRejectedAt(figure, ["elements", 1], "unrecognized_keys");
  });

  it("circle은 radius와 through 중 정확히 하나만 허용한다", () => {
    const both = { id: "c", type: "circle", label: null, role: "given", appearAt: null, center: "A", radius: 2, through: "B" };
    const neither = { ...both, radius: null, through: null };
    expectRejectedAt(buildGeometryFigure("fig-ac4", [...base, both]), ["elements", 2], "custom");
    expectRejectedAt(buildGeometryFigure("fig-ac4", [...base, neither]), ["elements", 2], "custom");
    expect(figureSpecSchema.safeParse(buildGeometryFigure("fig-ac4", [...base, { ...both, through: null }])).success).toBe(true);
  });
});

describe("AC-5 함수는 허용 목록 AST만 받는다", () => {
  it.each([
    ["문자열 수식", "x^2"],
    ["숫자 하나", 3],
    ["latex 객체", { latex: "x^2" }],
    ["JS 코드 문자열", "(() => 1)()"],
    ["미지원 노드 타입", { type: "call", name: "alert", args: [] }],
    ["모르는 키가 붙은 노드", { type: "var", name: "x", code: "alert(1)" }],
    ["x 이외 변수", { type: "var", name: "y" }],
    ["미지원 상수", { type: "const", name: "tau" }],
    ["인자 하나뿐인 이항 연산", { type: "add", args: [{ type: "num", value: 1 }] }],
  ])("%s는 거부된다", (_name, expr) => {
    const issues = issuesOf(buildFunctionFigure("fig-ac5", expr));
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.every((issue) => issue.path.slice(0, 3).join(".") === "elements.0.expr")).toBe(true);
  });

  it("허용된 모든 함수·상수를 쓴 AST는 통과한다", () => {
    const x = { type: "var", name: "x" };
    // 깊이 상한(10) 안에 들도록 두 묶음으로 나눈다: mul → add×4 → fn → var = 깊이 7.
    const chain = (start: unknown, names: string[]): unknown =>
      names.reduce<unknown>((acc, name) => ({ type: "add", args: [acc, { type: "fn", name, arg: x }] }), start);
    const left = chain({ type: "const", name: "pi" }, ["sin", "cos", "tan", "sqrt"]);
    const right = chain({ type: "neg", arg: { type: "const", name: "e" } }, ["abs", "ln", "log10", "exp"]);
    const expr = { type: "mul", args: [left, right] };
    expect(figureSpecSchema.safeParse(buildFunctionFigure("fig-ac5", expr)).success).toBe(true);
  });
});

describe("AC-6 상한과 유한수 제약", () => {
  it(`AST 깊이 ${MAX_EXPR_DEPTH}는 통과, ${MAX_EXPR_DEPTH + 1}은 거부`, () => {
    expect(figureSpecSchema.safeParse(buildFunctionFigure("fig-ac6", buildNestedNegExpr(MAX_EXPR_DEPTH))).success).toBe(true);
    expectRejectedAt(buildFunctionFigure("fig-ac6", buildNestedNegExpr(MAX_EXPR_DEPTH + 1)), ["elements", 0, "expr"], "custom");
  });

  it("매우 깊은 AST(10,000단계)도 스택 오버플로 없이 거부된다", () => {
    expectRejectedAt(buildFunctionFigure("fig-ac6", buildNestedNegExpr(10_000)), ["elements", 0, "expr"], "custom");
  });

  it(`AST 노드 ${MAX_EXPR_NODES}개 초과(깊이는 상한 이내)는 거부`, () => {
    const leaf = { type: "num", value: 1 };
    // 깊이 7의 완전 이진 트리 = 노드 127개.
    const build = (depth: number): unknown => (depth === 1 ? leaf : { type: "add", args: [build(depth - 1), build(depth - 1)] });
    expectRejectedAt(buildFunctionFigure("fig-ac6", build(7)), ["elements", 0, "expr"], "custom");
    // 깊이 6 = 노드 63개는 통과.
    expect(figureSpecSchema.safeParse(buildFunctionFigure("fig-ac6", build(6))).success).toBe(true);
  });

  it(`요소 ${MAX_FIGURE_ELEMENTS}개는 통과`, () => {
    const elements = Array.from({ length: MAX_FIGURE_ELEMENTS }, (_, index) => point(`P${index}`, index % 6, 0));
    expect(figureSpecSchema.safeParse(buildGeometryFigure("fig-ac6", elements)).success).toBe(true);
  });

  it(`제약 ${MAX_FIGURE_CONSTRAINTS + 1}개, 단계 ${MAX_FIGURE_STEPS + 1}개는 거부`, () => {
    const constraint = { type: "pointOnLine", source: "given", point: "A", line: "B" };
    expectRejectedAt(
      withF01((figure) => {
        figure["constraints"] = Array.from({ length: MAX_FIGURE_CONSTRAINTS + 1 }, () => constraint);
      }),
      ["constraints"],
      "too_big",
    );
    expectRejectedAt(
      withF01((figure) => {
        figure["steps"] = Array.from({ length: MAX_FIGURE_STEPS + 1 }, (_, index) => ({
          stepId: `s${index + 1}`,
          highlight: [],
          hide: [],
        }));
      }),
      ["steps"],
      "too_big",
    );
  });

  it("라벨 16자는 통과, 17자는 거부", () => {
    const at = (label: string) => buildGeometryFigure("fig-ac6", [{ ...point("A", 0, 0), label }]);
    expect(figureSpecSchema.safeParse(at("가".repeat(16))).success).toBe(true);
    expectRejectedAt(at("가".repeat(17)), ["elements", 0, "label"], "too_big");
  });

  it.each([["&amp;"], ["a>b"], ["줄\n바꿈"], ["\u0000"], ["\u0085"]])("라벨 %j는 거부", (label) => {
    expectRejectedAt(buildGeometryFigure("fig-ac6", [{ ...point("A", 0, 0), label }]), ["elements", 0, "label"]);
  });

  it.each([
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["-Infinity", Number.NEGATIVE_INFINITY],
    ["1e6 초과", 1e6 + 1],
  ])("좌표 %s는 거부", (_name, value) => {
    expectRejectedAt(buildGeometryFigure("fig-ac6", [point("A", value, 0)]), ["elements", 0, "x"]);
  });

  it("좌표 ±1e6은 통과", () => {
    expect(figureSpecSchema.safeParse(buildGeometryFigure("fig-ac6", [point("A", 1e6, -1e6)], { boundingBox: [-1, 1, 1, -1] })).success).toBe(true);
  });

  it.each([
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
  ])("수식 숫자 %s는 거부", (_name, value) => {
    expectRejectedAt(buildFunctionFigure("fig-ac6", { type: "num", value }), ["elements", 0, "expr", "value"]);
  });

  it.each([
    ["가로 1e4 초과", [0, 1, 10_001, 0]],
    ["세로 1e4 초과", [0, 10_001, 1, 0]],
    ["가로 0", [1, 1, 1, 0]],
    ["Infinity 포함", [0, Number.POSITIVE_INFINITY, 1, 0]],
  ])("boundingBox %s는 거부", (_name, boundingBox) => {
    const issues = issuesOf(withF01((figure) => (figure["boundingBox"] = boundingBox)));
    expect(issues.some((issue) => issue.path[0] === "boundingBox")).toBe(true);
  });

  it("geometry는 keepAspectRatio=false를 거부한다", () => {
    expectRejectedAt(withF01((figure) => (figure["keepAspectRatio"] = false)), ["keepAspectRatio"], "custom");
  });

  it("요소 ID·stepId 중복을 거부한다", () => {
    expectRejectedAt(buildGeometryFigure("fig-ac6", [point("A", 0, 0), point("A", 1, 1)]), ["elements", 1, "id"], "custom");
    expectRejectedAt(
      withF01((figure) => {
        figure["steps"] = [
          { stepId: "s1", highlight: [], hide: [] },
          { stepId: "s1", highlight: [], hide: [] },
        ];
      }),
      ["steps", 1, "stepId"],
      "custom",
    );
  });

  it.each([
    ["figureId", "FIG-1", ["figureId"]],
    ["stepId", "s0", ["steps", 0, "stepId"]],
    ["요소 ID", "1A", ["elements", 0, "id"]],
  ])("%s 형식 위반을 거부한다", (_name, value, path) => {
    const figure = withF01((spec) => {
      if (path[0] === "figureId") spec["figureId"] = value;
      if (path[0] === "steps") (spec["steps"] as Record<string, unknown>[])[0]!["stepId"] = value;
      if (path[0] === "elements") (spec["elements"] as Record<string, unknown>[])[0]!["id"] = value;
    });
    expectRejectedAt(figure, path);
  });

  it("최상위 모르는 키(스타일 필드 등)를 거부한다", () => {
    expectRejectedAt(withF01((figure) => (figure["style"] = { color: "red" })), [], "unrecognized_keys");
  });
});

describe("AC-7 관대 파서 parseSolutionFigures는 throw하지 않는다", () => {
  it("유효 도형과 무효 도형이 섞이면 무효 도형만 버린다", () => {
    const invalid = STAGE1_REJECT_FIGURE_FIXTURES[0]?.raw;
    const result = parseSolutionFigures({
      figures: [F01_TRIANGLE_ANGLE.raw, invalid, F07_QUADRATIC.raw],
      stepFigureRefs: [
        { stepId: "s1", figureId: "fig-f01" },
        { stepId: "s1", figureId: "fig-f10d" },
        { stepId: "s2", figureId: "fig-f07" },
        { stepId: "s2", figureId: "fig-f07" },
        { stepId: "bad", figureId: "fig-f01" },
      ],
    });
    expect(result.figures.map((figure) => figure.figureId)).toEqual(["fig-f01", "fig-f07"]);
    expect(result.stepFigureRefs).toEqual([
      { stepId: "s1", figureId: "fig-f01" },
      { stepId: "s2", figureId: "fig-f07" },
    ]);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0]?.figureId).toBe("fig-f10d");
    expect(result.rejected[0]?.reason).toContain("elements.0.label");
  });

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["문자열", "figures"],
    ["숫자", 42],
    ["배열", [F01_TRIANGLE_ANGLE.raw]],
    ["figures가 객체", { figures: { 0: F01_TRIANGLE_ANGLE.raw } }],
    ["figures가 문자열", { figures: "[]" }],
    ["figures 키 없음", { stepFigureRefs: [{ stepId: "s1", figureId: "fig-f01" }] }],
  ])("비배열/비객체 입력(%s)은 빈 결과", (_name, raw) => {
    expect(() => parseSolutionFigures(raw)).not.toThrow();
    expect(parseSolutionFigures(raw)).toEqual({ figures: [], stepFigureRefs: [], rejected: [] });
  });

  it("모르는 schemaVersion은 거부한다", () => {
    const v2 = withF01((figure) => (figure["schemaVersion"] = 2));
    const result = parseSolutionFigures({ figures: [v2] });
    expect(result.figures).toEqual([]);
    expect(result.rejected).toEqual([{ figureId: "fig-f01", reason: "unsupported_schema_version" }]);
  });

  it(`도형은 최대 ${MAX_FIGURES}개까지만 받고, 중복 figureId는 거부한다`, () => {
    const withId = (figureId: string) => withF01((figure) => (figure["figureId"] = figureId));
    const result = parseSolutionFigures({
      figures: [withId("fig-a"), withId("fig-a"), withId("fig-b"), withId("fig-c"), withId("fig-d")],
    });
    expect(result.figures.map((figure) => figure.figureId)).toEqual(["fig-a", "fig-b", "fig-c"]);
    expect(result.rejected.map((item) => item.reason.split(":")[0])).toEqual([
      "duplicate_figure_id",
      "figure_limit_exceeded",
    ]);
  });

  it("NaN·Infinity·깊은 AST·getter 예외가 섞여도 throw하지 않는다", () => {
    const throwingFigure = Object.defineProperty({}, "schemaVersion", {
      enumerable: true,
      get() {
        throw new Error("boom");
      },
    });
    const raw = {
      figures: [
        buildGeometryFigure("fig-nan", [point("A", Number.NaN, 0)]),
        buildFunctionFigure("fig-deep", buildNestedNegExpr(100_000)),
        throwingFigure,
        F01_TRIANGLE_ANGLE.raw,
      ],
      stepFigureRefs: "not-an-array",
    };
    expect(() => parseSolutionFigures(raw)).not.toThrow();
    const result = parseSolutionFigures(raw);
    expect(result.figures.map((figure) => figure.figureId)).toEqual(["fig-f01"]);
    expect(result.stepFigureRefs).toEqual([]);
    expect(result.rejected).toHaveLength(3);
  });

  it("악성 figureId는 rejected에 그대로 싣지 않는다", () => {
    const result = parseSolutionFigures({ figures: [withF01((figure) => (figure["figureId"] = "<script>"))] });
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0]).not.toHaveProperty("figureId");
  });
});

describe("AC-8 하위 호환 — figures 없는 기존 데이터는 그대로 파싱된다", () => {
  it("L01 figures 없는 Solution", () => {
    expect(solutionSchema.parse(L01_SOLUTION_WITHOUT_FIGURES.raw)).toEqual(L01_SOLUTION_WITHOUT_FIGURES.raw);
    expect(parseSolutionFigures(L01_SOLUTION_WITHOUT_FIGURES.raw)).toEqual({ figures: [], stepFigureRefs: [], rejected: [] });
  });

  it("L02 figures 없는 ProblemHistoryDetail", () => {
    const parsed = problemHistoryDetailSchema.parse(L02_HISTORY_DETAIL_WITHOUT_FIGURES.raw);
    expect(parsed).toEqual(L02_HISTORY_DETAIL_WITHOUT_FIGURES.raw);
    // 선택 필드가 undefined 값으로라도 새로 생기지 않는다(JSON 직렬화 결과까지 동일).
    expect(JSON.stringify(parsed)).toBe(JSON.stringify(L02_HISTORY_DETAIL_WITHOUT_FIGURES.raw));
    expect(parsed.solution).not.toHaveProperty("figures");
  });

  it("L03 figures 없는 ResumeSolution", () => {
    expect(resumeSolutionSchema.parse(L03_RESUME_SOLUTION_WITHOUT_FIGURES.raw)).toEqual(L03_RESUME_SOLUTION_WITHOUT_FIGURES.raw);
  });

  it("figures가 있으면 외곽 스키마가 제거하지 않고 보존한다(원소는 검사하지 않음)", () => {
    const figures = [F01_TRIANGLE_ANGLE.raw, { broken: true }];
    const stepFigureRefs = [{ stepId: "s1", figureId: "fig-f01" }];
    const solution = { ...(L01_SOLUTION_WITHOUT_FIGURES.raw as Record<string, unknown>), figures, stepFigureRefs };
    expect(solutionSchema.parse(solution)).toEqual(solution);

    const resume = { ...(L03_RESUME_SOLUTION_WITHOUT_FIGURES.raw as Record<string, unknown>), figures, stepFigureRefs };
    expect(resumeSolutionSchema.parse(resume)).toEqual(resume);

    const legacyDetail = L02_HISTORY_DETAIL_WITHOUT_FIGURES.raw as { solution: Record<string, unknown> };
    const detail = { ...legacyDetail, solution: { ...legacyDetail.solution, figures, stepFigureRefs } };
    expect(problemHistoryDetailSchema.parse(detail)).toEqual(detail);
  });
});
