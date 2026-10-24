/**
 * 정상 도형 명세 fixture F01~F09 (PRD §4.12 FIG, `docs/FIGURE_SPEC.md`).
 * Stage 1·Stage 2 모두 accept가 기대값이다. `expected`의 좌표·각도·불연속 위치는 검증 커널을
 * 호출하지 않고 손으로 계산한 리터럴이다(계산 근거는 각 fixture 주석).
 */
import type { FigureFixture } from "./types";

const hiddenAxes = { visible: false, xLabel: null, yLabel: null };
const coordinateAxes = { visible: true, xLabel: "x", yLabel: "y" };

/** F01 삼각형과 각 — A(0,0), B(4,0), C(2,2), ∠BAC = 45°. */
export const F01_TRIANGLE_ANGLE: FigureFixture = {
  id: "F01",
  title: "삼각형과 각",
  expect: { stage1: "accept", stage2: "accept" },
  expected: {
    // AB = (4,0), AC = (2,2): cos∠BAC = 8 / (4·2√2) = 1/√2 → 45°.
    angles: [{ id: "angA", degrees: 45 }],
  },
  raw: {
    schemaVersion: 1,
    figureId: "fig-f01",
    kind: "geometry",
    description: "삼각형 ABC와 꼭짓점 A의 각 BAC",
    boundingBox: [-1, 3, 5, -1],
    axes: hiddenAxes,
    grid: { visible: false },
    keepAspectRatio: true,
    interaction: { mode: "fixed" },
    elements: [
      { id: "A", type: "point", label: "A", role: "given", appearAt: null, x: 0, y: 0 },
      { id: "B", type: "point", label: "B", role: "given", appearAt: null, x: 4, y: 0 },
      { id: "C", type: "point", label: "C", role: "given", appearAt: null, x: 2, y: 2 },
      { id: "tri", type: "polygon", label: null, role: "given", appearAt: null, vertices: ["A", "B", "C"] },
      {
        id: "angA",
        type: "angle",
        label: null,
        role: "given",
        appearAt: null,
        points: ["B", "A", "C"],
        showMeasure: true,
        rightAngleMark: false,
      },
    ],
    constraints: [{ type: "angleMeasure", source: "given", angle: "angA", degrees: 45 }],
    steps: [
      { stepId: "s1", highlight: ["tri"], hide: [] },
      { stepId: "s2", highlight: ["angA"], hide: [] },
    ],
  },
};

/** F02 수선의 발과 높이 — C에서 AB에 내린 수선의 발 H(s2에 등장). */
export const F02_FOOT_OF_PERPENDICULAR: FigureFixture = {
  id: "F02",
  title: "수선의 발과 높이",
  expect: { stage1: "accept", stage2: "accept" },
  expected: {
    // AB는 y = 0 위의 선분이므로 C(2,4)에서 내린 수선의 발은 (2, 0). HC = (0,4), HB = (4,0) → 90°.
    points: [{ id: "H", x: 2, y: 0 }],
    angles: [{ id: "angCHB", degrees: 90 }],
  },
  raw: {
    schemaVersion: 1,
    figureId: "fig-f02",
    kind: "geometry",
    description: "삼각형 ABC에서 꼭짓점 C에서 변 AB에 내린 수선의 발 H와 높이 CH",
    boundingBox: [-1, 5, 7, -1],
    axes: hiddenAxes,
    grid: { visible: false },
    keepAspectRatio: true,
    interaction: { mode: "fixed" },
    elements: [
      { id: "A", type: "point", label: "A", role: "given", appearAt: null, x: 0, y: 0 },
      { id: "B", type: "point", label: "B", role: "given", appearAt: null, x: 6, y: 0 },
      { id: "C", type: "point", label: "C", role: "given", appearAt: null, x: 2, y: 4 },
      { id: "segAB", type: "segment", label: null, role: "given", appearAt: null, through: ["A", "B"], showLength: false },
      { id: "segBC", type: "segment", label: null, role: "given", appearAt: null, through: ["B", "C"], showLength: false },
      { id: "segCA", type: "segment", label: null, role: "given", appearAt: null, through: ["C", "A"], showLength: false },
      { id: "H", type: "foot", label: "H", role: "auxiliary", appearAt: "s2", from: "C", to: "segAB" },
      { id: "segCH", type: "segment", label: null, role: "auxiliary", appearAt: "s2", through: ["C", "H"], showLength: false },
      {
        id: "angCHB",
        type: "angle",
        label: null,
        role: "auxiliary",
        appearAt: "s2",
        points: ["C", "H", "B"],
        showMeasure: false,
        rightAngleMark: true,
      },
    ],
    constraints: [{ type: "perpendicular", source: "derived", a: "segCH", b: "segAB" }],
    steps: [
      { stepId: "s1", highlight: ["segAB", "segBC", "segCA"], hide: [] },
      { stepId: "s2", highlight: ["H", "segCH", "angCHB"], hide: [] },
    ],
  },
};

/** F03 중점과 중선 — BC의 중점 M과 중선 AM. */
export const F03_MIDPOINT_MEDIAN: FigureFixture = {
  id: "F03",
  title: "중점과 중선",
  expect: { stage1: "accept", stage2: "accept" },
  expected: {
    // M = ((−2 + 4)/2, (0 + 0)/2) = (1, 0).
    points: [{ id: "M", x: 1, y: 0 }],
  },
  raw: {
    schemaVersion: 1,
    figureId: "fig-f03",
    kind: "geometry",
    description: "삼각형 ABC에서 변 BC의 중점 M과 중선 AM",
    boundingBox: [-3, 5, 5, -1],
    axes: hiddenAxes,
    grid: { visible: false },
    keepAspectRatio: true,
    interaction: { mode: "fixed" },
    elements: [
      { id: "A", type: "point", label: "A", role: "given", appearAt: null, x: 1, y: 4 },
      { id: "B", type: "point", label: "B", role: "given", appearAt: null, x: -2, y: 0 },
      { id: "C", type: "point", label: "C", role: "given", appearAt: null, x: 4, y: 0 },
      { id: "tri", type: "polygon", label: null, role: "given", appearAt: null, vertices: ["A", "B", "C"] },
      { id: "M", type: "midpoint", label: "M", role: "auxiliary", appearAt: "s2", of: ["B", "C"] },
      { id: "segBM", type: "segment", label: null, role: "auxiliary", appearAt: "s2", through: ["B", "M"], showLength: false },
      { id: "segMC", type: "segment", label: null, role: "auxiliary", appearAt: "s2", through: ["M", "C"], showLength: false },
      { id: "segAM", type: "segment", label: null, role: "auxiliary", appearAt: "s2", through: ["A", "M"], showLength: false },
    ],
    constraints: [{ type: "equalLength", source: "derived", a: "segBM", b: "segMC" }],
    steps: [
      { stepId: "s1", highlight: ["tri"], hide: [] },
      { stepId: "s2", highlight: ["M", "segAM"], hide: [] },
    ],
  },
};

/** F04 원과 현 — 중심 O, 반지름 3, 현 AB와 중심에서 현에 내린 선분 OM(M은 AB의 중점). */
export const F04_CIRCLE_CHORD: FigureFixture = {
  id: "F04",
  title: "원과 현",
  expect: { stage1: "accept", stage2: "accept" },
  expected: {
    // M = ((3 + 0)/2, (0 + 3)/2) = (1.5, 1.5). OM = (1.5,1.5), AB = (−3,3) → 내적 0(수직).
    points: [{ id: "M", x: 1.5, y: 1.5 }],
  },
  raw: {
    schemaVersion: 1,
    figureId: "fig-f04",
    kind: "geometry",
    description: "중심이 O이고 반지름이 3인 원의 현 AB와, 현의 중점 M을 잇는 선분 OM",
    boundingBox: [-4.5, 4.5, 4.5, -4.5],
    axes: hiddenAxes,
    grid: { visible: false },
    keepAspectRatio: true,
    interaction: { mode: "fixed" },
    elements: [
      { id: "O", type: "point", label: "O", role: "given", appearAt: null, x: 0, y: 0 },
      { id: "c", type: "circle", label: null, role: "given", appearAt: null, center: "O", radius: 3, through: null },
      { id: "A", type: "point", label: "A", role: "given", appearAt: null, x: 3, y: 0 },
      { id: "B", type: "point", label: "B", role: "given", appearAt: null, x: 0, y: 3 },
      { id: "chordAB", type: "segment", label: null, role: "given", appearAt: null, through: ["A", "B"], showLength: false },
      { id: "M", type: "midpoint", label: "M", role: "auxiliary", appearAt: "s2", of: ["A", "B"] },
      { id: "segOM", type: "segment", label: null, role: "auxiliary", appearAt: "s2", through: ["O", "M"], showLength: false },
    ],
    constraints: [
      { type: "pointOnCircle", source: "given", point: "A", circle: "c" },
      { type: "pointOnCircle", source: "given", point: "B", circle: "c" },
      { type: "perpendicular", source: "derived", a: "segOM", b: "chordAB" },
    ],
    steps: [
      { stepId: "s1", highlight: ["c", "chordAB"], hide: [] },
      { stepId: "s2", highlight: ["M", "segOM"], hide: [] },
    ],
  },
};

/** F05 원의 접선 — 원 밖의 점 P에서 그은 두 접선(ccw/cw 접점). */
export const F05_CIRCLE_TANGENT: FigureFixture = {
  id: "F05",
  title: "원의 접선",
  expect: { stage1: "accept", stage2: "accept" },
  expected: {
    // |OP| = 4, r = 2 → θ = acos(1/2) = 60°. ccw 접점 = 2·(cos60°, sin60°) = (1, √3), cw = (1, −√3).
    // OT1 = (1,√3), T1P = (3,−√3) → 내적 0이므로 ∠OT1P = 90°.
    points: [
      { id: "T1", x: 1, y: Math.sqrt(3) },
      { id: "T2", x: 1, y: -Math.sqrt(3) },
    ],
    angles: [{ id: "angOT1P", degrees: 90 }],
  },
  raw: {
    schemaVersion: 1,
    figureId: "fig-f05",
    kind: "geometry",
    description: "중심 O, 반지름 2인 원과 원 밖의 점 P에서 그은 두 접선 PT1, PT2",
    boundingBox: [-3, 3, 5, -3],
    axes: hiddenAxes,
    grid: { visible: false },
    keepAspectRatio: true,
    interaction: { mode: "fixed" },
    elements: [
      { id: "O", type: "point", label: "O", role: "given", appearAt: null, x: 0, y: 0 },
      { id: "c", type: "circle", label: null, role: "given", appearAt: null, center: "O", radius: 2, through: null },
      { id: "P", type: "point", label: "P", role: "given", appearAt: null, x: 4, y: 0 },
      { id: "T1", type: "tangentPoint", label: "T1", role: "result", appearAt: null, circle: "c", from: "P", select: "ccw" },
      { id: "T2", type: "tangentPoint", label: "T2", role: "result", appearAt: null, circle: "c", from: "P", select: "cw" },
      { id: "tanPT1", type: "segment", label: null, role: "result", appearAt: null, through: ["P", "T1"], showLength: false },
      { id: "tanPT2", type: "segment", label: null, role: "result", appearAt: null, through: ["P", "T2"], showLength: false },
      { id: "segOT1", type: "segment", label: null, role: "auxiliary", appearAt: "s2", through: ["O", "T1"], showLength: false },
      {
        id: "angOT1P",
        type: "angle",
        label: null,
        role: "auxiliary",
        appearAt: "s2",
        points: ["O", "T1", "P"],
        showMeasure: false,
        rightAngleMark: true,
      },
    ],
    constraints: [
      { type: "tangent", source: "derived", line: "tanPT1", circle: "c" },
      { type: "tangent", source: "derived", line: "tanPT2", circle: "c" },
      { type: "perpendicular", source: "derived", a: "segOT1", b: "tanPT1" },
    ],
    steps: [
      { stepId: "s1", highlight: ["tanPT1", "tanPT2"], hide: [] },
      { stepId: "s2", highlight: ["segOT1", "angOT1P"], hide: [] },
    ],
  },
};

/** F06 좌표평면의 직선 — x + y = 4, x − y = 0과 교점 P. */
export const F06_COORDINATE_LINES: FigureFixture = {
  id: "F06",
  title: "좌표평면의 직선",
  expect: { stage1: "accept", stage2: "accept" },
  expected: {
    // x + y = 4, x − y = 0 → 2x = 4 → (2, 2).
    points: [{ id: "P", x: 2, y: 2 }],
  },
  raw: {
    schemaVersion: 1,
    figureId: "fig-f06",
    kind: "geometry",
    description: "좌표평면에서 두 직선 x + y = 4, x - y = 0과 그 교점 P",
    boundingBox: [-1, 5, 5, -1],
    axes: coordinateAxes,
    grid: { visible: true },
    keepAspectRatio: true,
    interaction: { mode: "fixed" },
    elements: [
      { id: "l1", type: "lineEquation", label: null, role: "given", appearAt: null, a: 1, b: 1, c: 4 },
      { id: "l2", type: "lineEquation", label: null, role: "given", appearAt: null, a: 1, b: -1, c: 0 },
      { id: "P", type: "intersection", label: "P", role: "result", appearAt: "s2", of: ["l1", "l2"], pick: 0 },
    ],
    constraints: [{ type: "pointOnLine", source: "derived", point: "P", line: "l1" }],
    steps: [
      { stepId: "s1", highlight: ["l1", "l2"], hide: [] },
      { stepId: "s2", highlight: ["P"], hide: [] },
    ],
  },
};

/** F07 이차함수 y = x² − 4x + 3의 꼭짓점과 x절편. */
export const F07_QUADRATIC: FigureFixture = {
  id: "F07",
  title: "이차함수의 꼭짓점과 교점",
  expect: { stage1: "accept", stage2: "accept" },
  expected: {
    // y = (x − 2)² − 1 → 꼭짓점 (2, −1). 근 x = 1, 3 → (1, 0), (3, 0).
    points: [
      { id: "V", x: 2, y: -1 },
      { id: "R1", x: 1, y: 0 },
      { id: "R2", x: 3, y: 0 },
    ],
  },
  raw: {
    schemaVersion: 1,
    figureId: "fig-f07",
    kind: "function",
    description: "이차함수 y = x^2 - 4x + 3의 그래프와 꼭짓점 V, x축과의 교점 R1, R2",
    boundingBox: [-1.5, 4.5, 5.5, -2],
    axes: coordinateAxes,
    grid: { visible: true },
    keepAspectRatio: false,
    interaction: { mode: "fixed" },
    elements: [
      {
        id: "f",
        type: "functionGraph",
        label: null,
        role: "given",
        appearAt: null,
        expr: {
          type: "add",
          args: [
            {
              type: "sub",
              args: [
                { type: "pow", args: [{ type: "var", name: "x" }, { type: "num", value: 2 }] },
                { type: "mul", args: [{ type: "num", value: 4 }, { type: "var", name: "x" }] },
              ],
            },
            { type: "num", value: 3 },
          ],
        },
        domain: [-1, 5],
      },
      { id: "V", type: "pointOnGraph", label: "V", role: "result", appearAt: "s2", graph: "f", x: 2 },
      { id: "R1", type: "pointOnGraph", label: "R1", role: "result", appearAt: "s3", graph: "f", x: 1 },
      { id: "R2", type: "pointOnGraph", label: "R2", role: "result", appearAt: "s3", graph: "f", x: 3 },
    ],
    constraints: [],
    steps: [
      { stepId: "s1", highlight: ["f"], hide: [] },
      { stepId: "s2", highlight: ["V"], hide: [] },
      { stepId: "s3", highlight: ["R1", "R2"], hide: [] },
    ],
  },
};

/** F08 유리함수 y = 1/(x − 1) + 2와 점근선 x = 1, y = 2(불연속 구간). */
export const F08_RATIONAL: FigureFixture = {
  id: "F08",
  title: "유리함수의 불연속 구간",
  expect: { stage1: "accept", stage2: "accept" },
  expected: {
    // 분모 x − 1 = 0 → x = 1에서 불연속(수직 점근선).
    discontinuities: [{ graph: "g", x: 1 }],
  },
  raw: {
    schemaVersion: 1,
    figureId: "fig-f08",
    kind: "function",
    description: "유리함수 y = 1/(x - 1) + 2의 그래프와 점근선 x = 1, y = 2",
    boundingBox: [-3, 7, 5, -3],
    axes: coordinateAxes,
    grid: { visible: true },
    keepAspectRatio: false,
    interaction: { mode: "fixed" },
    elements: [
      {
        id: "g",
        type: "functionGraph",
        label: null,
        role: "given",
        appearAt: null,
        expr: {
          type: "add",
          args: [
            {
              type: "div",
              args: [
                { type: "num", value: 1 },
                { type: "sub", args: [{ type: "var", name: "x" }, { type: "num", value: 1 }] },
              ],
            },
            { type: "num", value: 2 },
          ],
        },
        domain: null,
      },
      { id: "asymV", type: "lineEquation", label: null, role: "auxiliary", appearAt: "s2", a: 1, b: 0, c: 1 },
      { id: "asymH", type: "lineEquation", label: null, role: "auxiliary", appearAt: "s2", a: 0, b: 1, c: 2 },
    ],
    constraints: [],
    steps: [
      { stepId: "s1", highlight: ["g"], hide: [] },
      { stepId: "s2", highlight: ["asymV", "asymH"], hide: [] },
    ],
  },
};

/** F09 단계별 보조선과 강조 — s1 삼각형, s2 수선의 발(높이), s3 중점(중선) + 직각 표시 숨김. */
export const F09_STEPWISE_AUXILIARY: FigureFixture = {
  id: "F09",
  title: "단계별 보조선과 강조",
  expect: { stage1: "accept", stage2: "accept" },
  expected: {
    // BC는 y = 0 위의 선분 → A(0,3)에서 내린 수선의 발 H = (0, 0). M = ((−2 + 4)/2, 0) = (1, 0).
    points: [
      { id: "H", x: 0, y: 0 },
      { id: "M", x: 1, y: 0 },
    ],
    angles: [{ id: "angAHC", degrees: 90 }],
  },
  raw: {
    schemaVersion: 1,
    figureId: "fig-f09",
    kind: "geometry",
    description: "삼각형 ABC에 단계마다 높이 AH와 중선 AM을 차례로 그리는 그림",
    boundingBox: [-3, 4, 5, -1],
    axes: hiddenAxes,
    grid: { visible: false },
    keepAspectRatio: true,
    interaction: { mode: "explore", draggable: ["A"] },
    elements: [
      { id: "A", type: "point", label: "A", role: "given", appearAt: null, x: 0, y: 3 },
      { id: "B", type: "point", label: "B", role: "given", appearAt: null, x: -2, y: 0 },
      { id: "C", type: "point", label: "C", role: "given", appearAt: null, x: 4, y: 0 },
      { id: "segBC", type: "segment", label: null, role: "given", appearAt: null, through: ["B", "C"], showLength: false },
      { id: "segAB", type: "segment", label: null, role: "given", appearAt: null, through: ["A", "B"], showLength: false },
      { id: "segAC", type: "segment", label: null, role: "given", appearAt: null, through: ["A", "C"], showLength: false },
      { id: "H", type: "foot", label: "H", role: "auxiliary", appearAt: "s2", from: "A", to: "segBC" },
      { id: "segAH", type: "segment", label: null, role: "auxiliary", appearAt: "s2", through: ["A", "H"], showLength: false },
      {
        id: "angAHC",
        type: "angle",
        label: null,
        role: "auxiliary",
        appearAt: "s2",
        points: ["A", "H", "C"],
        showMeasure: false,
        rightAngleMark: true,
      },
      { id: "M", type: "midpoint", label: "M", role: "auxiliary", appearAt: "s3", of: ["B", "C"] },
      { id: "segAM", type: "segment", label: null, role: "auxiliary", appearAt: "s3", through: ["A", "M"], showLength: false },
    ],
    constraints: [
      { type: "perpendicular", source: "derived", a: "segAH", b: "segBC" },
      { type: "collinear", source: "derived", points: ["B", "H", "C"] },
    ],
    steps: [
      { stepId: "s1", highlight: ["segAB", "segBC", "segAC"], hide: [] },
      { stepId: "s2", highlight: ["H", "segAH", "angAHC"], hide: [] },
      { stepId: "s3", highlight: ["M", "segAM"], hide: ["angAHC"] },
    ],
  },
};

export const VALID_FIGURE_FIXTURES: FigureFixture[] = [
  F01_TRIANGLE_ANGLE,
  F02_FOOT_OF_PERPENDICULAR,
  F03_MIDPOINT_MEDIAN,
  F04_CIRCLE_CHORD,
  F05_CIRCLE_TANGENT,
  F06_COORDINATE_LINES,
  F07_QUADRATIC,
  F08_RATIONAL,
  F09_STEPWISE_AUXILIARY,
];
