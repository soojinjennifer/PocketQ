/**
 * Stage 2 의미 오류 fixture F11 계열 (PRD §4.12 FIG, `docs/FIGURE_SPEC.md` §13).
 *
 * 모두 구조 스키마(Stage 1)는 통과하고 의미 검증기(Stage 2)가 `expected.stage2Issue`의 code·path로
 * 거부해야 한다. 판정 근거는 각 fixture 주석에 손으로 계산해 적었다.
 */
import type { FigureFixture } from "./types";
import { buildFunctionFigure, buildGeometryFigure } from "./invalid";

/** 기본 boundingBox [-1, 5, 7, -1] (S = 8). */
function point(id: string, x: number, y: number, appearAt: string | null = null) {
  return { id, type: "point", label: id, role: "given", appearAt, x, y };
}

function segment(id: string, from: string, to: string) {
  return { id, type: "segment", label: null, role: "given", appearAt: null, through: [from, to], showLength: false };
}

function circle(id: string, center: string, radius: number) {
  return { id, type: "circle", label: null, role: "given", appearAt: null, center, radius, through: null };
}

function lineEquation(id: string, a: number, b: number, c: number) {
  return { id, type: "lineEquation", label: null, role: "given", appearAt: null, a, b, c };
}

function tangent(id: string, circleId: string, from: string) {
  return { id, type: "tangentPoint", label: id, role: "result", appearAt: null, circle: circleId, from, select: "ccw" };
}

function intersection(id: string, a: string, b: string, pick: 0 | 1) {
  return { id, type: "intersection", label: id, role: "result", appearAt: null, of: [a, b], pick };
}

function graph(id: string, expr: unknown, domain: [number, number] | null = null) {
  return { id, type: "functionGraph", label: null, role: "given", appearAt: null, expr, domain };
}

function pointOnGraph(id: string, graphId: string, x: number) {
  return { id, type: "pointOnGraph", label: id, role: "result", appearAt: null, graph: graphId, x };
}

function step(stepId: string, highlight: string[] = [], hide: string[] = []) {
  return { stepId, highlight, hide };
}

const X = { type: "var", name: "x" };
const RATIONAL = {
  type: "add",
  args: [
    { type: "div", args: [{ type: "num", value: 1 }, { type: "sub", args: [X, { type: "num", value: 1 }] }] },
    { type: "num", value: 2 },
  ],
};

function fixture(
  id: string,
  title: string,
  raw: unknown,
  code: string,
  path: (string | number)[],
): FigureFixture {
  return { id, title, raw, expect: { stage1: "accept", stage2: "reject" }, expected: { stage2Issue: { code, path } } };
}

/** 함수 그래프 도형(boundingBox [-5, 5, 5, -5]) — 요소 목록만 바꾼다. */
function functionFigure(figureId: string, elements: unknown[]): Record<string, unknown> {
  return { ...buildFunctionFigure(figureId, X), elements };
}

export const STAGE2_SEMANTIC_FIGURE_FIXTURES: FigureFixture[] = [
  // 원 중심 O(2,2), r = 2. P(3,2): |OP| = 1 < 2 → 원 안.
  fixture(
    "F11a",
    "원 안의 점에서 접점",
    buildGeometryFigure("fig-f11a", [point("O", 2, 2), circle("c", "O", 2), point("P", 3, 2), tangent("T", "c", "P")]),
    "no_tangent",
    ["elements", 3],
  ),
  // P(4,2): |OP| = 2 = r → 원 위(접선 하나로 퇴화).
  fixture(
    "F11b",
    "원 위의 점에서 접점",
    buildGeometryFigure("fig-f11b", [point("O", 2, 2), circle("c", "O", 2), point("P", 4, 2), tangent("T", "c", "P")]),
    "degenerate_tangent",
    ["elements", 3],
  ),
  // x + y = 4와 x + y = 2는 평행.
  fixture(
    "F11c",
    "평행선의 교점",
    buildGeometryFigure("fig-f11c", [lineEquation("l1", 1, 1, 4), lineEquation("l2", 1, 1, 2), intersection("P", "l1", "l2", 0)]),
    "no_solution",
    ["elements", 2],
  ),
  // 두 직선의 교점은 하나뿐 → pick 1은 무효.
  fixture(
    "F11d",
    "직선×직선 pick 1",
    buildGeometryFigure("fig-f11d", [lineEquation("l1", 1, 1, 4), lineEquation("l2", 1, -1, 0), intersection("P", "l1", "l2", 1)]),
    "invalid_pick",
    ["elements", 2, "pick"],
  ),
  // 0x + 0y = 3은 직선이 아니다.
  fixture(
    "F11e",
    "lineEquation a = b = 0",
    buildGeometryFigure("fig-f11e", [lineEquation("l", 0, 0, 3)]),
    "degenerate",
    ["elements", 0],
  ),
  fixture(
    "F11f",
    "다각형 꼭짓점 중복",
    buildGeometryFigure("fig-f11f", [
      point("A", 0, 0),
      point("B", 4, 0),
      point("C", 2, 2),
      { id: "poly", type: "polygon", label: null, role: "given", appearAt: null, vertices: ["A", "B", "A"] },
    ]),
    "duplicate_reference",
    ["elements", 3, "vertices", 2],
  ),
  fixture(
    "F11g",
    "highlight 중복",
    buildGeometryFigure("fig-f11g", [point("A", 0, 0), point("B", 4, 0)], { steps: [step("s1", ["A", "A"])] }),
    "duplicate_reference",
    ["steps", 0, "highlight", 1],
  ),
  fixture(
    "F11h",
    "hide 중복",
    buildGeometryFigure("fig-f11h", [point("A", 0, 0), point("B", 4, 0)], { steps: [step("s1", [], ["A", "A"])] }),
    "duplicate_reference",
    ["steps", 0, "hide", 1],
  ),
  fixture(
    "F11i",
    "같은 단계에서 highlight와 hide에 동시 지정",
    buildGeometryFigure("fig-f11i", [point("A", 0, 0), point("B", 4, 0)], { steps: [step("s1", ["A"], ["A"])] }),
    "duplicate_reference",
    ["steps", 0, "hide", 0],
  ),
  fixture(
    "F11j",
    "draggable 중복",
    buildGeometryFigure("fig-f11j", [point("A", 0, 0), point("B", 4, 0)], {
      interaction: { mode: "explore", draggable: ["A", "A"] },
    }),
    "duplicate_reference",
    ["interaction", "draggable", 1],
  ),
  // 일반 객체로 ID를 조회하면 Object.prototype.constructor를 찾아 통과시키는 함정.
  fixture(
    "F11k",
    "없는 ID constructor 참조",
    buildGeometryFigure("fig-f11k", [point("A", 0, 0), point("B", 4, 0), segment("s", "A", "constructor")]),
    "unknown_reference",
    ["elements", 2, "through", 1],
  ),
  fixture(
    "F11l",
    "자유 점이 아닌 draggable(중점)",
    buildGeometryFigure(
      "fig-f11l",
      [point("A", 0, 0), point("B", 4, 0), { id: "M", type: "midpoint", label: "M", role: "auxiliary", appearAt: null, of: ["A", "B"] }],
      { interaction: { mode: "explore", draggable: ["M"] } },
    ),
    "type_mismatch",
    ["interaction", "draggable", 0],
  ),
  // y = x, domain [0, 2]에서 x = 3은 정의역 밖.
  fixture(
    "F11m",
    "domain 밖 pointOnGraph",
    functionFigure("fig-f11m", [graph("f", X, [0, 2]), pointOnGraph("P", "f", 3)]),
    "out_of_domain",
    ["elements", 1, "x"],
  ),
  // y = 1/(x − 1) + 2는 x = 1에서 1/0 → 정의되지 않음.
  fixture(
    "F11n",
    "x = 1에서 유리함수 pointOnGraph",
    functionFigure("fig-f11n", [graph("g", RATIONAL), pointOnGraph("P", "g", 1)]),
    "undefined_at_point",
    ["elements", 1, "x"],
  ),
  // 1e-300 < DEGENERATE_REL × S = 8e-6 → 퇴화.
  fixture(
    "F11o",
    "반지름 1e-300",
    buildGeometryFigure("fig-f11o", [point("O", 2, 2), circle("c", "O", 1e-300)]),
    "degenerate",
    ["elements", 1, "radius"],
  ),
  // x = 10 > right = 7.
  fixture(
    "F11p",
    "boundingBox 밖의 점",
    buildGeometryFigure("fig-f11p", [point("A", 10, 0)]),
    "point_out_of_view",
    ["elements", 0],
  ),
  // AB = (4,0), AC = (1,3): cos = 4 / (4·√10) → ∠BAC ≈ 71.57° ≠ 90°.
  fixture(
    "F11q",
    "90°가 아닌 rightAngleMark",
    buildGeometryFigure("fig-f11q", [
      point("A", 0, 0),
      point("B", 4, 0),
      point("C", 1, 3),
      { id: "ang", type: "angle", label: null, role: "given", appearAt: null, points: ["B", "A", "C"], showMeasure: false, rightAngleMark: true },
    ]),
    "constraint_violation",
    ["elements", 3, "rightAngleMark"],
  ),
  fixture(
    "F11r",
    "자기 참조",
    buildGeometryFigure("fig-f11r", [
      point("A", 0, 0),
      { id: "M", type: "midpoint", label: "M", role: "auxiliary", appearAt: null, of: ["A", "M"] },
    ]),
    "self_reference",
    ["elements", 1, "of", 1],
  ),
  fixture(
    "F11s",
    "foot.to가 점(타입 불일치)",
    buildGeometryFigure("fig-f11s", [
      point("A", 0, 3),
      point("B", 4, 0),
      { id: "H", type: "foot", label: "H", role: "auxiliary", appearAt: null, from: "A", to: "B" },
    ]),
    "type_mismatch",
    ["elements", 2, "to"],
  ),
  // y = x + 100은 x ∈ [−5, 5]에서 95~105 → boundingBox 세로 [−5, 5] 밖.
  fixture(
    "F11t",
    "보이는 점이 없는 그래프",
    functionFigure("fig-f11t", [graph("f", { type: "add", args: [X, { type: "num", value: 100 }] })]),
    "graph_not_visible",
    ["elements", 0],
  ),
  // y = x 그래프 1개 = 샘플 400회(불연속 탐색 없음). 50개 = 20,000회 = 예산 전부 → 51번째(인덱스 50)에서 초과.
  fixture(
    "F11u",
    "계산량 예산 초과",
    functionFigure(
      "fig-f11u",
      Array.from({ length: 51 }, (_, index) => graph(`f${index}`, X)),
    ),
    "compute_budget_exceeded",
    ["elements", 50],
  ),
  fixture(
    "F11v",
    "원이 포함된 교점(미지원)",
    buildGeometryFigure("fig-f11v", [point("O", 2, 2), circle("c", "O", 2), lineEquation("l", 1, 0, 2), intersection("P", "l", "c", 0)]),
    "unsupported",
    ["elements", 3, "of", 1],
  ),
  fixture(
    "F11w",
    "steps에 없는 appearAt",
    buildGeometryFigure("fig-f11w", [point("A", 0, 0, "s3")], { steps: [step("s1")] }),
    "unknown_step",
    ["elements", 0, "appearAt"],
  ),
  fixture(
    "F11x",
    "steps 순서 뒤집힘",
    buildGeometryFigure("fig-f11x", [point("A", 0, 0)], { steps: [step("s2"), step("s1")] }),
    "step_order",
    ["steps", 1, "stepId"],
  ),
  fixture(
    "F11y",
    "아직 등장하지 않은 요소 강조",
    buildGeometryFigure("fig-f11y", [point("A", 0, 0, "s2")], { steps: [step("s1", ["A"]), step("s2")] }),
    "not_yet_visible",
    ["steps", 0, "highlight", 0],
  ),
  // A(0,0)→B(4,4)와 C(4,0)→D(0,3)이 교차. 넓이 = |0 − 16 + 12 + 0| / 2 = 2(퇴화 아님).
  fixture(
    "F11z",
    "자기교차 다각형",
    buildGeometryFigure("fig-f11z", [
      point("A", 0, 0),
      point("B", 4, 4),
      point("C", 4, 0),
      point("D", 0, 3),
      { id: "poly", type: "polygon", label: null, role: "given", appearAt: null, vertices: ["A", "B", "C", "D"] },
    ]),
    "self_intersecting",
    ["elements", 4, "vertices"],
  ),
  fixture(
    "F11aa",
    "180° 초과 angleMeasure(미지원)",
    buildGeometryFigure(
      "fig-f11aa",
      [
        point("A", 0, 0),
        point("B", 4, 0),
        point("C", 2, 2),
        { id: "ang", type: "angle", label: null, role: "given", appearAt: null, points: ["B", "A", "C"], showMeasure: true, rightAngleMark: false },
      ],
      { constraints: [{ type: "angleMeasure", source: "given", angle: "ang", degrees: 200 }] },
    ),
    "unsupported",
    ["constraints", 0, "degrees"],
  ),
  // |AB| = 4인데 조건은 5(좌표와 1:1, D4).
  fixture(
    "F11ab",
    "길이 조건과 좌표 불일치",
    buildGeometryFigure("fig-f11ab", [point("A", 0, 0), point("B", 4, 0), segment("segAB", "A", "B")], {
      constraints: [{ type: "length", source: "given", segment: "segAB", value: 5 }],
    }),
    "constraint_violation",
    ["constraints", 0],
  ),
  // S = 8 → 반지름 상한 80. 1000 > 80.
  fixture(
    "F11ac",
    "반지름 상한 초과",
    buildGeometryFigure("fig-f11ac", [point("O", 2, 2), circle("c", "O", 1000)]),
    "radius_too_large",
    ["elements", 1, "radius"],
  ),
  // 중심 (3,2)에서 가장 먼 모서리까지 √(4² + 3²) = 5 < 6 → boundingBox 전체가 원 안(둘레가 안 보임).
  fixture(
    "F11ad",
    "둘레가 boundingBox와 만나지 않는 원",
    buildGeometryFigure("fig-f11ad", [point("O", 3, 2), circle("c", "O", 6)]),
    "circle_out_of_view",
    ["elements", 1],
  ),
  // 가로 30 : 세로 1 > 1:20.
  fixture(
    "F11ae",
    "keepAspectRatio boundingBox 가로세로비 초과",
    buildGeometryFigure("fig-f11ae", [point("A", 1, 0.5)], { boundingBox: [0, 1, 30, 0] }),
    "invalid_bounding_box",
    ["boundingBox"],
  ),
  // s1에서 숨긴 A는 이후 단계에서도 숨겨진 상태(누적, D6).
  fixture(
    "F11af",
    "앞 단계에서 숨긴 요소 강조",
    buildGeometryFigure("fig-f11af", [point("A", 0, 0), point("B", 4, 0)], { steps: [step("s1", [], ["A"]), step("s2", ["A"])] }),
    "not_yet_visible",
    ["steps", 1, "highlight", 0],
  ),
  fixture(
    "F11ag",
    "교점에서 같은 선 두 번 참조",
    buildGeometryFigure("fig-f11ag", [lineEquation("l1", 1, 1, 4), intersection("P", "l1", "l1", 0)]),
    "duplicate_reference",
    ["elements", 1, "of", 1],
  ),
  fixture(
    "F11ah",
    "선분 through에서 같은 점 두 번 참조",
    buildGeometryFigure("fig-f11ah", [point("A", 0, 0), segment("s", "A", "A")]),
    "duplicate_reference",
    ["elements", 1, "through", 1],
  ),
  fixture(
    "F11ai",
    "각에서 같은 점 두 번 참조",
    buildGeometryFigure("fig-f11ai", [
      point("A", 0, 0),
      point("B", 4, 0),
      { id: "ang", type: "angle", label: null, role: "given", appearAt: null, points: ["A", "B", "A"], showMeasure: false, rightAngleMark: false },
    ]),
    "duplicate_reference",
    ["elements", 2, "points", 2],
  ),
  fixture(
    "F11aj",
    "중점에서 같은 점 두 번 참조",
    buildGeometryFigure("fig-f11aj", [
      point("A", 0, 0),
      { id: "M", type: "midpoint", label: "M", role: "auxiliary", appearAt: null, of: ["A", "A"] },
    ]),
    "duplicate_reference",
    ["elements", 1, "of", 1],
  ),
  fixture(
    "F11ak",
    "collinear 점 중복",
    buildGeometryFigure("fig-f11ak", [point("A", 0, 0), point("B", 4, 0), point("C", 2, 0)], {
      constraints: [{ type: "collinear", source: "given", points: ["A", "B", "A"] }],
    }),
    "duplicate_reference",
    ["constraints", 0, "points", 2],
  ),
  // Stage 2 재작업 1(QA MEDIUM-1): y = 100은 boundingBox [-1, 5, 7, -1](세로 −1~5)와 만나지 않는다.
  fixture(
    "F11al",
    "boundingBox와 만나지 않는 lineEquation",
    buildGeometryFigure("fig-f11al", [lineEquation("l", 0, 1, 100)]),
    "line_out_of_view",
    ["elements", 0],
  ),
  // a = b = 1e-300, c = 1e6: 계수 스케일 max(1e-300, 1e-300, 1e6 / 8) 대비 √2·1e-300은 1e-6배보다 훨씬 작다 → 퇴화.
  fixture(
    "F11am",
    "계수가 거의 0인 lineEquation",
    buildGeometryFigure("fig-f11am", [lineEquation("l", 1e-300, 1e-300, 1e6)]),
    "degenerate",
    ["elements", 0],
  ),
  // 1e-6·x = 1 → x = 1e6: 계수 스케일 max(1e-6, 0, 1/8) = 0.125, 1e-6 > 1e-6 × 0.125라 퇴화는 아니지만 화면 밖.
  fixture(
    "F11an",
    "화면 밖 수직선 x = 1e6",
    buildGeometryFigure("fig-f11an", [lineEquation("l", 1e-6, 0, 1)]),
    "line_out_of_view",
    ["elements", 0],
  ),
  // Stage 2 재작업 1(QA LOW-1): 선분 s는 처음부터 보이는데 끝점 B는 s2에 등장.
  fixture(
    "F11ao",
    "끝점보다 먼저 등장하는 선분",
    buildGeometryFigure(
      "fig-f11ao",
      [point("A", 0, 0), point("B", 4, 0, "s2"), segment("s", "A", "B")],
      { steps: [step("s1"), step("s2")] },
    ),
    "dependency_not_visible",
    ["elements", 2, "appearAt"],
  ),
  // s2에서 끝점 B만 숨기고 선분 s는 남긴다.
  fixture(
    "F11ap",
    "끝점만 숨기고 선분은 남김",
    buildGeometryFigure("fig-f11ap", [point("A", 0, 0), point("B", 4, 0), segment("s", "A", "B")], {
      steps: [step("s1"), step("s2", [], ["B"])],
    }),
    "dependency_not_visible",
    ["steps", 1, "hide", 0],
  ),
  // 후속 정리(QA LOW 2): s1에서 B를 숨긴 뒤 s2에 B를 끝점으로 하는 선분 s가 등장.
  fixture(
    "F11aq",
    "숨긴 점에 의존하는 선분이 뒤에 등장",
    buildGeometryFigure(
      "fig-f11aq",
      [point("A", 0, 0), point("B", 4, 0), { ...segment("s", "A", "B"), appearAt: "s2" }],
      { steps: [step("s1", [], ["B"]), step("s2")] },
    ),
    "dependency_not_visible",
    ["elements", 2, "appearAt"],
  ),
];
