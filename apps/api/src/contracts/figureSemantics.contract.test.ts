/**
 * 도형 의미 검증기·계산 커널(Stage 2 WU1~WU2) 계약 테스트 — PRD §4.12 FIG, `docs/FIGURE_SPEC.md` §12~§13.
 *
 * 기대 좌표·각도·불연속 위치는 fixture의 `expected`(손 계산 리터럴)와 비교한다. 커널 출력으로
 * 기대값을 만들지 않는다.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExprNode, FigureSpec } from "shared-types";
import { describe, expect, it } from "vitest";
import {
  FIGURE_EVAL_BUDGET,
  GRAPH_SAMPLE_COUNT,
  MAX_FIGURE_REJECTIONS,
  MAX_SEMANTIC_ISSUES,
  createEvalBudget,
  evaluateExpr,
  figureSpecSchema,
  formatFigureNumber,
  isSafeLabelText,
  measureAngle,
  parseSolutionFigures,
  piecesVisible,
  resolveFigure,
  sampleFunctionGraph,
  tangentOrientation,
  tangentPoint,
  validateFigureSemantics,
  type ResolvedFigure,
  type Vec2,
} from "validation";
import {
  F01_TRIANGLE_ANGLE,
  F05_CIRCLE_TANGENT,
  F06_COORDINATE_LINES,
  F07_QUADRATIC,
  F08_RATIONAL,
  STAGE2_REJECT_FIGURE_FIXTURES,
  STAGE2_SEMANTIC_FIGURE_FIXTURES,
  VALID_FIGURE_FIXTURES,
  buildGeometryFigure,
  type FigureFixture,
} from "validation/fixtures";

const COORDINATE_EPSILON = 1e-9;

function parseSpec(raw: unknown): FigureSpec {
  return figureSpecSchema.parse(raw);
}

function resolveOk(fixture: FigureFixture): ResolvedFigure {
  const result = validateFigureSemantics(parseSpec(fixture.raw));
  if (!result.ok) throw new Error(`${fixture.id} 의미 검증 실패: ${JSON.stringify(result.issues)}`);
  return result.resolved;
}

function point(id: string, x: number, y: number) {
  return { id, type: "point", label: id, role: "given", appearAt: null, x, y };
}

const X: ExprNode = { type: "var", name: "x" };
const num = (value: number): ExprNode => ({ type: "num", value });

function allPieceValuesFinite(pieces: readonly (readonly Vec2[])[]): boolean {
  return pieces.every((piece) => piece.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)));
}

/** 어떤 조각도 x를 가로지르지 않는다(조각의 모든 점이 x의 한쪽에만 있다). */
function noPieceSpans(pieces: readonly (readonly Vec2[])[], x: number): boolean {
  return pieces.every((piece) => piece.every((p) => p.x < x) || piece.every((p) => p.x > x));
}

describe("S2-1 계산 결과가 독립 계산 기대값과 1e-9 이내로 일치한다", () => {
  const withPoints = VALID_FIGURE_FIXTURES.filter((fixture) => (fixture.expected?.points?.length ?? 0) > 0);
  const withAngles = VALID_FIGURE_FIXTURES.filter((fixture) => (fixture.expected?.angles?.length ?? 0) > 0);

  it("기대 좌표가 있는 fixture가 F02~F07, F09를 모두 포함한다", () => {
    expect(withPoints.map((fixture) => fixture.id)).toEqual(["F02", "F03", "F04", "F05", "F06", "F07", "F09"]);
    expect(withAngles.map((fixture) => fixture.id)).toEqual(["F01", "F02", "F05", "F09"]);
  });

  it.each(withPoints.map((fixture) => [fixture.id, fixture] as const))("%s 점 좌표", (_id, fixture) => {
    const resolved = resolveOk(fixture);
    for (const expected of fixture.expected?.points ?? []) {
      const element = resolved.elements.get(expected.id);
      expect(element?.kind).toBe("point");
      if (element?.kind !== "point") continue;
      expect(Math.abs(element.xy.x - expected.x)).toBeLessThanOrEqual(COORDINATE_EPSILON);
      expect(Math.abs(element.xy.y - expected.y)).toBeLessThanOrEqual(COORDINATE_EPSILON);
    }
  });

  it.each(withAngles.map((fixture) => [fixture.id, fixture] as const))("%s 각도", (_id, fixture) => {
    const resolved = resolveOk(fixture);
    for (const expected of fixture.expected?.angles ?? []) {
      const element = resolved.elements.get(expected.id);
      expect(element?.kind).toBe("angle");
      if (element?.kind !== "angle") continue;
      expect(Math.abs(element.degrees - expected.degrees)).toBeLessThanOrEqual(COORDINATE_EPSILON);
    }
  });

  it("F05 접점 방향: ccw 접점은 외적 OP × OT > 0, cw 접점은 < 0 (§3.6)", () => {
    const resolved = resolveOk(F05_CIRCLE_TANGENT);
    const O = resolved.elements.get("O");
    const P = resolved.elements.get("P");
    const T1 = resolved.elements.get("T1");
    const T2 = resolved.elements.get("T2");
    if (O?.kind !== "point" || P?.kind !== "point" || T1?.kind !== "point" || T2?.kind !== "point") {
      throw new Error("F05 구조가 바뀌었다");
    }
    // 손 계산: OP = (4,0), OT1 = (1,√3) → 4·√3 − 0·1 > 0.
    expect(tangentOrientation(O.xy, P.xy, T1.xy)).toBeGreaterThan(0);
    expect(tangentOrientation(O.xy, P.xy, T2.xy)).toBeLessThan(0);
  });

  it("각은 180° 이하로 정규화하고 외적이 음수면 첫째·셋째 점을 바꾼다", () => {
    const resolved = resolveOk(VALID_FIGURE_FIXTURES[1]!); // F02 ∠CHB: HC = (0,4), HB = (4,0) → 외적 −16 < 0
    const angle = resolved.elements.get("angCHB");
    expect(angle?.kind === "angle" ? angle.points : null).toEqual(["B", "H", "C"]);
    const f01 = resolveOk(F01_TRIANGLE_ANGLE).elements.get("angA"); // AB=(4,0), AC=(2,2) → 외적 8 > 0
    expect(f01?.kind === "angle" ? f01.points : null).toEqual(["B", "A", "C"]);
    expect(measureAngle({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: -1, y: 0 })?.degrees).toBe(180);
  });

  it("F08 x = 1에서 그래프 조각이 끊기고, 양쪽에 조각이 있으며, 조각 안에 비유한수가 없다", () => {
    const resolved = resolveOk(F08_RATIONAL);
    for (const expected of F08_RATIONAL.expected?.discontinuities ?? []) {
      const graph = resolved.elements.get(expected.graph);
      expect(graph?.kind).toBe("graph");
      if (graph?.kind !== "graph") continue;
      expect(noPieceSpans(graph.pieces, expected.x)).toBe(true);
      expect(graph.pieces.some((piece) => piece.every((p) => p.x < expected.x))).toBe(true);
      expect(graph.pieces.some((piece) => piece.every((p) => p.x > expected.x))).toBe(true);
      expect(allPieceValuesFinite(graph.pieces)).toBe(true);
    }
  });

  it("F07 그래프는 하나의 연속 조각이며 domain 끝(−1, 5)까지 이어진다", () => {
    const graph = resolveOk(F07_QUADRATIC).elements.get("f");
    if (graph?.kind !== "graph") throw new Error("F07 구조가 바뀌었다");
    expect(graph.pieces).toHaveLength(1);
    expect(graph.pieces[0]?.[0]?.x).toBe(-1);
    expect(graph.pieces[0]?.at(-1)?.x).toBe(5);
  });
});

describe("S2-2 정상 fixture(F01~F09)는 의미 검증을 통과한다", () => {
  it.each(VALID_FIGURE_FIXTURES.map((fixture) => [fixture.id, fixture] as const))("%s", (_id, fixture) => {
    expect(fixture.expect.stage2).toBe("accept");
    const result = validateFigureSemantics(parseSpec(fixture.raw));
    expect(result.ok ? [] : result.issues).toEqual([]);
    expect(resolveFigure(parseSpec(fixture.raw))).not.toBeNull();
  });

  it("resolved는 Map이고 요소 정의 순서를 유지한다", () => {
    const spec = parseSpec(F01_TRIANGLE_ANGLE.raw);
    const resolved = resolveOk(F01_TRIANGLE_ANGLE);
    expect(resolved.elements).toBeInstanceOf(Map);
    expect([...resolved.elements.keys()]).toEqual(spec.elements.map((element) => element.id));
    expect(resolved.figureId).toBe("fig-f01");
    expect(resolved.scale).toBe(6);
  });
});

describe("S2-3 의미 오류 fixture(F10a~c, F11 계열)는 정확한 code·path로 거부된다", () => {
  const fixtures = [...STAGE2_REJECT_FIGURE_FIXTURES, ...STAGE2_SEMANTIC_FIGURE_FIXTURES];

  it.each(fixtures.map((fixture) => [fixture.id, fixture] as const))("%s", (_id, fixture) => {
    expect(fixture.expect).toEqual({ stage1: "accept", stage2: "reject" });
    expect(fixture.expected?.stage2Issue).toBeDefined();
    // 구조 스키마는 통과한다(의미 오류만 있는 입력).
    const spec = parseSpec(fixture.raw);
    const result = validateFigureSemantics(spec);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toContainEqual(expect.objectContaining(fixture.expected?.stage2Issue ?? {}));
    expect(resolveFigure(spec)).toBeNull();
  });
});

describe("S2-4 검증기는 throw하지 않고 오류는 최대 10건이다", () => {
  it("스키마를 거치지 않은 비정상 객체도 throw 없이 거부한다", () => {
    const throwingElements = Object.defineProperty(parseSpec(F01_TRIANGLE_ANGLE.raw), "elements", {
      get() {
        throw new Error("boom");
      },
    });
    const inputs: unknown[] = [
      throwingElements,
      { ...parseSpec(F01_TRIANGLE_ANGLE.raw), elements: null },
      { ...parseSpec(F01_TRIANGLE_ANGLE.raw), boundingBox: [Number.NaN, 1, 1, 0] },
      {
        ...parseSpec(F01_TRIANGLE_ANGLE.raw),
        elements: [{ ...point("A", Number.NaN, 0) }],
        constraints: [],
        steps: [],
      },
      new Proxy(
        {},
        {
          get() {
            throw new Error("proxy");
          },
        },
      ),
    ];
    for (const input of inputs) {
      expect(() => validateFigureSemantics(input as FigureSpec)).not.toThrow();
      expect(validateFigureSemantics(input as FigureSpec).ok).toBe(false);
    }
  });

  it(`오류가 많아도 ${MAX_SEMANTIC_ISSUES}건까지만 보고한다`, () => {
    const elements = [
      point("A", 0, 0),
      ...Array.from({ length: 30 }, (_, index) => ({
        id: `s${index}`,
        type: "segment",
        label: null,
        role: "given",
        appearAt: null,
        through: ["A", `Z${index}`],
        showLength: false,
      })),
    ];
    const result = validateFigureSemantics(parseSpec(buildGeometryFigure("fig-many", elements)));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues).toHaveLength(MAX_SEMANTIC_ISSUES);
  });
});

describe("S2-5 Map 기반 ID 조회 — Object.prototype 이름도 일반 ID처럼 동작한다", () => {
  it("constructor·toString·hasOwnProperty·valueOf ID로 만든 도형이 통과하고 좌표가 맞다", () => {
    const raw = buildGeometryFigure("fig-proto", [
      point("constructor", 0, 0),
      point("toString", 4, 0),
      point("hasOwnProperty", 2, 2),
      { id: "valueOf", type: "midpoint", label: null, role: "auxiliary", appearAt: null, of: ["constructor", "toString"] },
      {
        id: "isPrototypeOf",
        type: "segment",
        label: null,
        role: "given",
        appearAt: null,
        through: ["hasOwnProperty", "valueOf"],
        showLength: false,
      },
      // 재작업 1: 의존 가시성 규칙(dependency_not_visible) 도입으로, toString을 숨기면 그 점에 의존하는
      // valueOf(중점)·isPrototypeOf(선분)도 함께 숨긴다. 이 테스트의 목적(Map 기반 ID 조회)은 그대로다.
    ], { steps: [{ stepId: "s1", highlight: ["constructor", "hasOwnProperty"], hide: ["toString", "valueOf", "isPrototypeOf"] }] });
    const result = validateFigureSemantics(parseSpec(raw));
    expect(result.ok ? [] : result.issues).toEqual([]);
    if (!result.ok) return;
    const mid = result.resolved.elements.get("valueOf");
    expect(mid?.kind === "point" ? mid.xy : null).toEqual({ x: 2, y: 0 });
  });

  it("정의되지 않은 toString 참조는 unknown_reference", () => {
    const raw = buildGeometryFigure("fig-proto2", [
      point("A", 0, 0),
      { id: "M", type: "midpoint", label: null, role: "auxiliary", appearAt: null, of: ["A", "toString"] },
    ]);
    const result = validateFigureSemantics(parseSpec(raw));
    expect(result.ok ? [] : result.issues).toContainEqual(
      expect.objectContaining({ code: "unknown_reference", path: ["elements", 1, "of", 1] }),
    );
  });
});

describe("S2-6 수식 평가기는 허용 목록 switch만 쓴다", () => {
  it("노드·함수·상수별 값", () => {
    const fn = (name: Extract<ExprNode, { type: "fn" }>["name"], arg: ExprNode): ExprNode => ({ type: "fn", name, arg });
    expect(evaluateExpr({ type: "add", args: [num(2), num(3)] }, 0)).toBe(5);
    expect(evaluateExpr({ type: "sub", args: [num(2), num(3)] }, 0)).toBe(-1);
    expect(evaluateExpr({ type: "mul", args: [X, num(3)] }, 2)).toBe(6);
    expect(evaluateExpr({ type: "div", args: [num(1), X] }, 4)).toBe(0.25);
    expect(evaluateExpr({ type: "neg", arg: X }, 7)).toBe(-7);
    expect(evaluateExpr({ type: "const", name: "pi" }, 0)).toBe(Math.PI);
    expect(evaluateExpr({ type: "const", name: "e" }, 0)).toBe(Math.E);
    expect(evaluateExpr(fn("sqrt", num(9)), 0)).toBe(3);
    expect(evaluateExpr(fn("abs", num(-2)), 0)).toBe(2);
    expect(evaluateExpr(fn("log10", num(1000)), 0)).toBeCloseTo(3, 12);
    expect(evaluateExpr(fn("ln", { type: "const", name: "e" }), 0)).toBeCloseTo(1, 12);
    expect(evaluateExpr(fn("exp", num(0)), 0)).toBe(1);
    expect(evaluateExpr(fn("sin", num(0)), 0)).toBe(0);
    expect(evaluateExpr(fn("cos", num(0)), 0)).toBe(1);
    expect(evaluateExpr(fn("tan", num(0)), 0)).toBe(0);
  });

  it("음수 밑에 정수가 아닌 지수는 NaN(D5), 정수 지수는 계산, 0의 음수 제곱은 Infinity", () => {
    expect(evaluateExpr({ type: "pow", args: [num(-8), num(1 / 3)] }, 0)).toBeNaN();
    expect(evaluateExpr({ type: "pow", args: [num(-2), num(3)] }, 0)).toBe(-8);
    expect(evaluateExpr({ type: "pow", args: [num(0), num(-1)] }, 0)).toBe(Number.POSITIVE_INFINITY);
  });

  it("알 수 없는 노드·함수·상수는 throw 없이 NaN", () => {
    expect(evaluateExpr({ type: "call", name: "alert" } as unknown as ExprNode, 0)).toBeNaN();
    expect(evaluateExpr({ type: "fn", name: "constructor", arg: X } as unknown as ExprNode, 0)).toBeNaN();
    expect(evaluateExpr({ type: "const", name: "tau" } as unknown as ExprNode, 0)).toBeNaN();
    expect(evaluateExpr(null as unknown as ExprNode, 0)).toBeNaN();
    // 순환 참조(스키마 밖 입력)도 깊이 상한으로 멈춘다.
    const cyclic = { type: "neg" } as { type: "neg"; arg?: unknown };
    cyclic.arg = cyclic;
    expect(evaluateExpr(cyclic as unknown as ExprNode, 0)).toBeNaN();
  });

  it("validation 패키지 소스에 동적 코드 실행·동적 Math 조회가 없다", () => {
    const root = fileURLToPath(new URL("../../../../packages/validation/src", import.meta.url));
    const files: string[] = [];
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (full.endsWith(".ts")) files.push(full);
      }
    };
    walk(root);
    expect(files.length).toBeGreaterThan(5);
    const forbidden = /eval\(|new Function|Function\(|Math\[/;
    const offenders = files.filter((file) => forbidden.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });
});

describe("S2-7 parseSolutionFigures는 의미 검증을 통과한 도형만 받는다(D9)", () => {
  it("의미 오류 도형은 invalid_semantics: <code> at <path>로 거부하고 나머지는 유지한다", () => {
    const result = parseSolutionFigures({
      figures: [STAGE2_REJECT_FIGURE_FIXTURES[0]?.raw, F01_TRIANGLE_ANGLE.raw],
      stepFigureRefs: [
        { stepId: "s1", figureId: "fig-f10a" },
        { stepId: "s1", figureId: "fig-f01" },
      ],
    });
    expect(result.figures.map((figure) => figure.figureId)).toEqual(["fig-f01"]);
    expect(result.stepFigureRefs).toEqual([{ stepId: "s1", figureId: "fig-f01" }]);
    expect(result.rejected).toEqual([
      { figureId: "fig-f10a", reason: "invalid_semantics: unknown_reference at elements.2.through.1" },
    ]);
  });

  it("의미 오류는 최대 3건까지만 reason에 싣는다", () => {
    const elements = [
      point("A", 0, 0),
      ...Array.from({ length: 5 }, (_, index) => ({
        id: `s${index}`,
        type: "segment",
        label: null,
        role: "given",
        appearAt: null,
        through: ["A", `Z${index}`],
        showLength: false,
      })),
    ];
    const result = parseSolutionFigures({ figures: [buildGeometryFigure("fig-many", elements)] });
    expect(result.rejected[0]?.reason.split("; ")).toHaveLength(3);
    expect(result.rejected[0]?.reason.startsWith("invalid_semantics: unknown_reference at elements.1.through.1")).toBe(true);
  });

  it("figureId getter가 throw해도 그 후보만 버리고 다른 도형은 유지한다(LOW 5)", () => {
    const throwingId = Object.defineProperty({ ...(F07_QUADRATIC.raw as Record<string, unknown>) }, "figureId", {
      enumerable: true,
      get() {
        throw new Error("boom");
      },
    });
    const result = parseSolutionFigures({ figures: [throwingId, F01_TRIANGLE_ANGLE.raw] });
    expect(result.figures.map((figure) => figure.figureId)).toEqual(["fig-f01"]);
    expect(result.rejected).toEqual([{ reason: "unexpected_error" }]);
  });

  it("stepFigureRefs getter가 throw해도 받아들인 도형은 유지한다(LOW 5)", () => {
    const raw = Object.defineProperty({ figures: [F01_TRIANGLE_ANGLE.raw] }, "stepFigureRefs", {
      enumerable: true,
      get() {
        throw new Error("boom");
      },
    });
    const result = parseSolutionFigures(raw);
    expect(result.figures.map((figure) => figure.figureId)).toEqual(["fig-f01"]);
    expect(result.stepFigureRefs).toEqual([]);
    expect(result.rejected).toEqual([]);
  });

  it(`rejected는 최대 ${MAX_FIGURE_REJECTIONS}건이다`, () => {
    const result = parseSolutionFigures({ figures: Array.from({ length: 100 }, () => ({ broken: true })) });
    expect(result.rejected).toHaveLength(MAX_FIGURE_REJECTIONS);
  });

  it("의미 검증은 호출당 상한까지만 실행한다(이후 후보는 semantic_check_limit_exceeded)", () => {
    const bad = STAGE2_SEMANTIC_FIGURE_FIXTURES.find((fixture) => fixture.id === "F11u")?.raw;
    const result = parseSolutionFigures({ figures: [...Array.from({ length: 12 }, () => bad), F01_TRIANGLE_ANGLE.raw] });
    expect(result.figures).toEqual([]);
    expect(result.rejected.filter((item) => item.reason === "semantic_check_limit_exceeded").length).toBeGreaterThan(0);
  });

  it("반환 모양은 그대로다(figures·stepFigureRefs·rejected)", () => {
    const result = parseSolutionFigures({ figures: VALID_FIGURE_FIXTURES.slice(0, 3).map((fixture) => fixture.raw) });
    expect(Object.keys(result).sort()).toEqual(["figures", "rejected", "stepFigureRefs"]);
    expect(result.figures).toHaveLength(3);
    expect(result.rejected).toEqual([]);
  });

  it.each(VALID_FIGURE_FIXTURES.map((fixture) => [fixture.id, fixture] as const))(
    "%s는 관대 파서를 그대로 통과한다(입력과 deep-equal)",
    (_id, fixture) => {
      const result = parseSolutionFigures({ figures: [fixture.raw] });
      expect(result.rejected).toEqual([]);
      expect(result.figures).toEqual([fixture.raw]);
    },
  );
});

describe("S2-8 라벨 문자 강화(LOW 2)와 수치 포맷", () => {
  it.each([
    ["U+061C", "؜"],
    ["U+200B", "​"],
    ["U+200C", "‌"],
    ["U+200D", "‍"],
    ["U+200E", "‎"],
    ["U+200F", "‏"],
    ["U+202A", "‪"],
    ["U+202B", "‫"],
    ["U+202C", "‬"],
    ["U+202D", "‭"],
    ["U+202E", "‮"],
    ["U+2066", "⁦"],
    ["U+2067", "⁧"],
    ["U+2068", "⁨"],
    ["U+2069", "⁩"],
    ["U+FEFF", "﻿"],
    ["U+2028", " "],
    ["U+2029", " "],
  ])("%s가 들어간 라벨은 거부", (_name, char) => {
    expect(isSafeLabelText(`A${char}B`)).toBe(false);
    const raw = buildGeometryFigure("fig-label", [{ ...point("A", 0, 0), label: `A${char}` }]);
    expect(figureSpecSchema.safeParse(raw).success).toBe(false);
  });

  it.each([["A"], ["T1"], ["∠ABC"], ["가나다"], ["x²"], ["α'"]])("일반 라벨 %j는 통과", (label) => {
    expect(isSafeLabelText(label)).toBe(true);
  });

  it.each([
    [45, "angle", "45°"],
    [44.97, "angle", "45°"],
    [89.99999999999999, "angle", "90°"],
    [33.333, "angle", "33.33°"],
    [2.5, "length", "2.5"],
    [2.5004, "length", "2.5"],
    [1.41421356, "length", "1.41"],
    [2.9995, "length", "3"],
    [3.0000001, "length", "3"],
    [-0.0001, "length", "0"],
    [10, "length", "10"],
    [0.1 + 0.2, "length", "0.3"],
  ] as const)("formatFigureNumber(%s, %s) = %s", (value, unit, expected) => {
    expect(formatFigureNumber(value, { unit })).toBe(expected);
  });

  it("비유한수는 빈 문자열", () => {
    expect(formatFigureNumber(Number.NaN)).toBe("");
    expect(formatFigureNumber(Number.POSITIVE_INFINITY, { unit: "angle" })).toBe("");
  });
});

describe("샘플러 — 불연속·값 없음에서 선을 끊는다", () => {
  const box = [-5, 5, 5, -5] as const;
  const sample = (expr: ExprNode, options: { domain?: [number, number] | null; sampleCount?: number } = {}) => {
    const result = sampleFunctionGraph(expr, {
      domain: options.domain ?? null,
      boundingBox: box,
      budget: createEvalBudget(),
      ...(options.sampleCount === undefined ? {} : { sampleCount: options.sampleCount }),
    });
    if (!result.ok) throw new Error("예산 초과");
    return result.pieces;
  };

  it("tan(x)는 x = ±π/2, ±3π/2에서 끊긴다", () => {
    const pieces = sample({ type: "fn", name: "tan", arg: X });
    for (const pole of [-1.5 * Math.PI, -0.5 * Math.PI, 0.5 * Math.PI, 1.5 * Math.PI]) {
      expect(noPieceSpans(pieces, pole)).toBe(true);
    }
    expect(pieces.length).toBeGreaterThanOrEqual(5);
    expect(allPieceValuesFinite(pieces)).toBe(true);
  });

  it("pow(x, −1)은 x = 0에서 끊긴다(샘플이 0에 걸리지 않는 경우)", () => {
    const pieces = sample({ type: "pow", args: [X, num(-1)] });
    expect(noPieceSpans(pieces, 0)).toBe(true);
    expect(pieces).toHaveLength(2);
    expect(allPieceValuesFinite(pieces)).toBe(true);
  });

  it("0의 음수 제곱: pow(x, −2)는 샘플이 정확히 x = 0에 걸려도 끊기고 Infinity를 싣지 않는다", () => {
    // 401개 샘플 → x = −5 + 10·200/400 = 0이 정확히 샘플된다.
    const pieces = sample({ type: "pow", args: [X, num(-2)] }, { sampleCount: 401 });
    expect(noPieceSpans(pieces, 0)).toBe(true);
    expect(allPieceValuesFinite(pieces)).toBe(true);
  });

  it("ln(x)는 x > 0에만 조각이 있다", () => {
    const pieces = sample({ type: "fn", name: "ln", arg: X });
    expect(pieces.length).toBeGreaterThan(0);
    expect(pieces.every((piece) => piece.every((p) => p.x > 0))).toBe(true);
    expect(allPieceValuesFinite(pieces)).toBe(true);
  });

  it("sqrt(x)는 음수 구간에서 값이 없고, 조각이 x = 0 가까이에서 시작한다", () => {
    const pieces = sample({ type: "fn", name: "sqrt", arg: X });
    expect(pieces).toHaveLength(1);
    const first = pieces[0]?.[0];
    expect(first?.x).toBeGreaterThanOrEqual(0);
    // 샘플 간격 10/399 ≈ 0.025보다 경계에 가깝다(경계 이분 탐색).
    expect(first?.x).toBeLessThan(0.001);
    expect(allPieceValuesFinite(pieces)).toBe(true);
  });

  it("domain과 boundingBox 가로 범위의 교집합만 샘플한다", () => {
    const pieces = sample(X, { domain: [-2, 20] });
    expect(pieces).toHaveLength(1);
    expect(pieces[0]?.[0]?.x).toBe(-2);
    expect(pieces[0]?.at(-1)?.x).toBe(5);
    expect(pieces[0]).toHaveLength(GRAPH_SAMPLE_COUNT);
  });

  it("교집합이 비면 조각이 없다", () => {
    expect(sample(X, { domain: [10, 20] })).toEqual([]);
  });

  it("예산을 넘으면 compute_budget_exceeded", () => {
    const result = sampleFunctionGraph(X, { domain: null, boundingBox: box, budget: createEvalBudget(10) });
    expect(result).toEqual({ ok: false, code: "compute_budget_exceeded" });
    expect(FIGURE_EVAL_BUDGET).toBe(20_000);
  });

  it("piecesVisible은 두 샘플 사이로 화면을 가로지르는 선도 보인다고 본다", () => {
    expect(piecesVisible([[{ x: 0, y: 8 }, { x: 1, y: -8 }]], 5, -5)).toBe(true);
    expect(piecesVisible([[{ x: 0, y: 8 }, { x: 1, y: 9 }]], 5, -5)).toBe(false);
  });
});

describe("기하 커널 경계", () => {
  it("tangentPoint: 원 안은 inside, 원 위는 on_circle", () => {
    const O = { x: 0, y: 0 };
    expect(tangentPoint(O, 2, { x: 1, y: 0 }, "ccw", 1e-6).kind).toBe("inside");
    expect(tangentPoint(O, 2, { x: 2, y: 0 }, "ccw", 1e-6).kind).toBe("on_circle");
  });
});

describe("Stage 2 재작업 1 — 선의 화면 검사, 의존 가시성, 라벨 문자 추가", () => {
  it.each([
    ["a = b = 1e-300, c = 1e6", 1e-300, 1e-300, 1e6, "degenerate"],
    ["a = b = 0", 0, 0, 3, "degenerate"],
    ["y = 100(화면 위)", 0, 1, 100, "line_out_of_view"],
    ["x = 1e6", 1e-6, 0, 1, "line_out_of_view"],
    ["x + y = 1e6", 1, 1, 1e6, "line_out_of_view"],
  ])("lineEquation %s → %s", (_name, a, b, c, code) => {
    const raw = buildGeometryFigure("fig-line", [{ id: "l", type: "lineEquation", label: null, role: "given", appearAt: null, a, b, c }]);
    const result = validateFigureSemantics(parseSpec(raw));
    expect(result.ok ? [] : result.issues).toContainEqual(expect.objectContaining({ code, path: ["elements", 0] }));
  });

  it.each([
    ["y = 0(화면 가운데)", 0, 1, 0],
    ["모서리를 지나는 x + y = 6(bbox [-1,5,7,-1]의 (7,−1))", 1, 1, 6],
    ["작지만 정상인 계수 1e-6·x + 1e-6·y = 2e-6", 1e-6, 1e-6, 2e-6],
  ])("lineEquation %s는 통과", (_name, a, b, c) => {
    const raw = buildGeometryFigure("fig-line", [{ id: "l", type: "lineEquation", label: null, role: "given", appearAt: null, a, b, c }]);
    const result = validateFigureSemantics(parseSpec(raw));
    expect(result.ok ? [] : result.issues).toEqual([]);
  });

  it("F01~F09는 의존 가시성 규칙(dependency_not_visible)에 걸리지 않는다", () => {
    for (const fixture of VALID_FIGURE_FIXTURES) {
      const result = validateFigureSemantics(parseSpec(fixture.raw));
      expect(result.ok ? [] : result.issues.map((issue) => issue.code)).not.toContain("dependency_not_visible");
    }
  });

  it("끝점과 선분을 같은 단계에서 함께 숨기면 통과한다", () => {
    const raw = buildGeometryFigure(
      "fig-hideboth",
      [
        point("A", 0, 0),
        point("B", 4, 0),
        { id: "s", type: "segment", label: null, role: "given", appearAt: null, through: ["A", "B"], showLength: false },
      ],
      { steps: [{ stepId: "s1", highlight: [], hide: [] }, { stepId: "s2", highlight: [], hide: ["B", "s"] }] },
    );
    const result = validateFigureSemantics(parseSpec(raw));
    expect(result.ok ? [] : result.issues).toEqual([]);
  });

  it.each([
    ["U+2060", "⁠"],
    ["U+00AD", "­"],
    ["U+FE0F", "️"],
    ["U+FE00", "︀"],
    ["U+E0041(태그)", "\u{E0041}"],
    ["U+E007F(태그 끝)", "\u{E007F}"],
    ["U+3164", "ㅤ"],
    ["U+180E", "᠎"],
    ["U+115F", "ᅟ"],
    ["U+1160", "ᅠ"],
  ])("%s가 들어간 라벨은 거부", (_name, char) => {
    expect(isSafeLabelText(`A${char}`)).toBe(false);
    expect(figureSpecSchema.safeParse(buildGeometryFigure("fig-label2", [{ ...point("A", 0, 0), label: `A${char}` }])).success).toBe(false);
  });
});

describe("후속 정리 — 의존 규칙(QA LOW 2·3)", () => {
  function withSteps(raw: unknown, steps: unknown[], mutate?: (figure: Record<string, unknown>) => void): FigureSpec {
    const figure = structuredClone(raw) as Record<string, unknown>;
    figure["steps"] = steps;
    mutate?.(figure);
    return parseSpec(figure);
  }

  it("F06: 두 직선 l1·l2를 숨기고 교점 P만 남겨도 통과(점류는 부모가 숨겨져도 보일 수 있음)", () => {
    const spec = withSteps(F06_COORDINATE_LINES.raw, [
      { stepId: "s1", highlight: ["l1", "l2"], hide: [] },
      { stepId: "s2", highlight: ["P"], hide: ["l1", "l2"] },
    ]);
    const result = validateFigureSemantics(spec);
    expect(result.ok ? [] : result.issues).toEqual([]);
  });

  it("F07: 그래프를 숨기고 그래프 위의 점은 남겨도 통과", () => {
    const spec = withSteps(F07_QUADRATIC.raw, [
      { stepId: "s1", highlight: ["f"], hide: [] },
      { stepId: "s2", highlight: ["V"], hide: [] },
      { stepId: "s3", highlight: ["R1", "R2"], hide: ["f"] },
    ]);
    const result = validateFigureSemantics(spec);
    expect(result.ok ? [] : result.issues).toEqual([]);
  });

  it("점류도 부모보다 먼저 등장할 수는 없다(F06 교점 P가 직선보다 먼저)", () => {
    const spec = withSteps(
      F06_COORDINATE_LINES.raw,
      [
        { stepId: "s1", highlight: [], hide: [] },
        { stepId: "s2", highlight: [], hide: [] },
      ],
      (figure) => {
        const elements = figure["elements"] as Record<string, unknown>[];
        const l1 = elements.find((element) => element["id"] === "l1");
        const p = elements.find((element) => element["id"] === "P");
        if (l1 === undefined || p === undefined) throw new Error("F06 구조가 바뀌었다");
        l1["appearAt"] = "s2";
        p["appearAt"] = "s1";
      },
    );
    const result = validateFigureSemantics(spec);
    expect(result.ok ? [] : result.issues).toContainEqual(
      expect.objectContaining({ code: "dependency_not_visible", path: ["elements", 2, "appearAt"] }),
    );
  });

  it("선분은 숨긴 끝점에 의존하면 뒤 단계에 등장할 수 없다(F11aq)", () => {
    const fixture = STAGE2_SEMANTIC_FIGURE_FIXTURES.find((item) => item.id === "F11aq");
    const result = validateFigureSemantics(parseSpec(fixture?.raw));
    expect(result.ok ? [] : result.issues).toContainEqual(
      expect.objectContaining({ code: "dependency_not_visible", path: ["elements", 2, "appearAt"] }),
    );
  });
});
