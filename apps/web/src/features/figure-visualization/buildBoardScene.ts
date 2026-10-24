/**
 * 의미 검증 결과(`ResolvedFigure`)를 보드에 그릴 장면(순수 데이터)으로 바꾼다.
 *
 * - 좌표는 모두 검증 커널이 계산한 값을 쓴다. JSXGraph 내장 작도(중점·수선의 발·교점·접선)와
 *   JSXGraph 함수 그래프는 쓰지 않는다. 함수 그래프는 샘플러 조각마다 curve 하나.
 * - 장면 항목 순서 = 장식(격자·축) → 명세 elements 순서. 같은 요소의 부속(언더레이·라벨·연장선)은
 *   그 요소 바로 뒤에 온다.
 * - 화면 px에 의존하는 위치(라벨 거리, 각 반지름)는 `offsetPx`로 남겨 두고, 보드에 붙일 때
 *   현재 단위(px/단위)로 환산한다(리사이즈 시 다시 계산).
 * - 라벨 문자열은 렌더러 2차 방어(`sanitizeLabelText`)를 거친다.
 */
import type { FigureElement, FigureElementRole, FigureLineLikeElement, FigureSpec } from "shared-types";
import { formatFigureNumber, type ResolvedFigure, type ResolvedFigureElement, type Vec2 } from "validation";
import { FIGURE_PX, LABEL_FONT_PX } from "./figureStyle";
import { chooseLabelDirection, type PlacementScene } from "./labelPlacement";
import { sanitizeLabelText } from "./sanitizeLabel";

export type TextKind = "element" | "measure" | "tick" | "axisName";
export type AnchorX = "left" | "middle" | "right";
export type AnchorY = "top" | "middle" | "bottom";

/** 사용자 좌표 기준점 + 화면 px 오프셋(+x 오른쪽, +y 위쪽). */
export interface ScenePosition {
  base: Vec2;
  offsetPx: Vec2;
}

/** boundingBox 가장자리 기준 위치(축 이름). `edge`가 x면 오른쪽 끝, y면 위쪽 끝. */
export interface SceneEdgePosition {
  edge: "x" | "y";
  offsetPx: Vec2;
}

interface ItemBase {
  /** 장면 안에서 고유. JSXGraph 요소 id 접미사로도 쓴다(영숫자·밑줄). */
  key: string;
  /** 명세 요소 ID. 장식(격자·축·눈금)은 null(항상 보임, 기본 상태). */
  elementId: string | null;
  role: FigureElementRole;
}

export type SceneItem =
  | (ItemBase & { kind: "point"; xy: Vec2; label: string | null; labelOffsetPx: Vec2; labelAnchor: [AnchorX, AnchorY] })
  | (ItemBase & { kind: "segment" | "line" | "ray"; p1: Vec2; p2: Vec2; variant: "normal" | "extension" })
  | (ItemBase & { kind: "circle"; center: Vec2; radius: number })
  | (ItemBase & { kind: "polygon"; vertices: Vec2[] })
  | (ItemBase & {
      kind: "angle";
      /** 정규화 순서 [첫째, 꼭짓점, 셋째] — 첫째 팔에서 셋째 팔로 반시계, 180° 이하. */
      xy: [Vec2, Vec2, Vec2];
      rightAngle: boolean;
      radiusPx: number;
    })
  | (ItemBase & { kind: "curve"; points: Vec2[] })
  | (ItemBase & {
      kind: "text";
      text: string;
      textKind: TextKind;
      position: ScenePosition | SceneEdgePosition;
      anchor: [AnchorX, AnchorY];
    })
  | (ItemBase & {
      kind: "grid";
      xs: number[];
      ys: number[];
      /** 격자선을 그을 범위 [left, top, right, bottom] — 보드 전체(리사이즈 시 장식과 함께 다시 만듦). */
      range: [number, number, number, number];
    })
  | (ItemBase & { kind: "axis"; axis: "x" | "y" });

export interface FigureScene {
  /** 장식 + 요소(생성 순서). */
  items: SceneItem[];
  /** 명세 요소에서 나온 항목(리사이즈 때 다시 만들지 않음). */
  elements: SceneItem[];
  /** 격자·축·눈금·축 이름(리사이즈로 px/단위·범위가 바뀌면 다시 만듦). */
  decorations: SceneItem[];
}

/** 선 계열(언더레이를 까는 항목). */
export function hasUnderlay(item: SceneItem): boolean {
  return (
    item.elementId !== null &&
    (item.kind === "point" ||
      item.kind === "segment" ||
      item.kind === "line" ||
      item.kind === "ray" ||
      item.kind === "circle" ||
      item.kind === "polygon" ||
      item.kind === "curve")
  );
}

/* ---------------------------------------------------------------------------------------------
 * 보조 계산
 * ------------------------------------------------------------------------------------------- */

function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

function unit(v: Vec2): Vec2 {
  const length = Math.hypot(v.x, v.y);
  return length > 0 ? { x: v.x / length, y: v.y / length } : { x: 0, y: 1 };
}

function centroid(points: readonly Vec2[]): Vec2 {
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / Math.max(points.length, 1), y: sum.y / Math.max(points.length, 1) };
}

/** 방향 벡터에 맞는 텍스트 기준점(라벨이 방향 쪽으로 붙도록). */
function anchorFor(direction: Vec2): [AnchorX, AnchorY] {
  const ax: AnchorX = direction.x > 0.38 ? "left" : direction.x < -0.38 ? "right" : "middle";
  const ay: AnchorY = direction.y > 0.38 ? "bottom" : direction.y < -0.38 ? "top" : "middle";
  return [ax, ay];
}

/** 눈금 간격: 1·2·5 × 10^k 중 화면 간격이 `minPx` 이상인 가장 작은 값. */
export function niceTickStep(pxPerUnit: number, minPx: number = FIGURE_PX.tickMinSpacing): number {
  if (!(pxPerUnit > 0)) return 1;
  const raw = minPx / pxPerUnit;
  const exponent = Math.floor(Math.log10(raw));
  for (const multiplier of [1, 2, 5, 10]) {
    const step = multiplier * 10 ** exponent;
    if (step >= raw * (1 - 1e-9)) return step;
  }
  return 10 ** (exponent + 1);
}

/** 눈금 숫자 표기: 음수는 수학 마이너스(U+2212). */
export function formatTickLabel(value: number): string {
  const text = formatFigureNumber(value, { tolerance: 1e-9 });
  return text.startsWith("-") ? `−${text.slice(1)}` : text;
}

function ticksIn(min: number, max: number, step: number): number[] {
  const values: number[] = [];
  const start = Math.ceil(min / step);
  const end = Math.floor(max / step);
  for (let k = start; k <= end && values.length < 200; k += 1) {
    const value = k * step;
    values.push(Math.abs(value) < step * 1e-9 ? 0 : value);
  }
  return values;
}

/* ---------------------------------------------------------------------------------------------
 * 장면 생성
 * ------------------------------------------------------------------------------------------- */

export interface BuildSceneOptions {
  /** 눈금 간격 계산용 px/단위(가로, 세로). 축이 없으면 쓰지 않는다. */
  pxPerUnit: { x: number; y: number };
  /** 눈금·격자를 둘 범위(보드 boundingBox). */
  boundingBox: readonly [number, number, number, number];
}

/** 라벨 배치용 장면: 그려지는 선·원·곡선·각(축이 보이면 두 축도 선으로). */
function placementSceneOf(spec: FigureSpec, resolved: ResolvedFigure): PlacementScene {
  const scene: PlacementScene = { lines: [], circles: [], curves: [], angles: [], center: { x: 0, y: 0 } };
  const points: Vec2[] = [];
  for (const element of resolved.elements.values()) {
    switch (element.kind) {
      case "point":
        points.push(element.xy);
        break;
      case "line":
        scene.lines.push({ p1: element.p1, p2: element.p2, kind: element.type === "lineEquation" ? "line" : element.type });
        break;
      case "circle":
        scene.circles.push({ center: element.center, radius: element.radius });
        break;
      case "polygon":
        element.vertices.forEach((vertex, index) => {
          const next = element.vertices[(index + 1) % element.vertices.length] ?? vertex;
          scene.lines.push({ p1: vertex, p2: next, kind: "segment" });
        });
        break;
      case "angle":
        scene.angles.push(element.xy);
        break;
      case "graph":
        scene.curves.push(...element.pieces);
        break;
      default: {
        const unreachable: never = element;
        void unreachable;
      }
    }
  }
  if (spec.axes.visible) {
    scene.lines.push({ p1: { x: 0, y: 0 }, p2: { x: 1, y: 0 }, kind: "line" }, { p1: { x: 0, y: 0 }, p2: { x: 0, y: 1 }, kind: "line" });
  }
  scene.center = points.length > 0 ? centroid(points) : { x: 0, y: 0 };
  return scene;
}

export function buildBoardScene(spec: FigureSpec, resolved: ResolvedFigure, options: BuildSceneOptions): FigureScene {
  const items: SceneItem[] = [];
  let counter = 0;
  const key = (prefix: string, id: string | null): string => `${prefix}${counter++}${id === null ? "" : `_${id}`}`;
  const placement = placementSceneOf(spec, resolved);

  // 다각형 꼭짓점 → 무게중심(라벨을 바깥으로 밀기 위함). 같은 점이 여러 다각형에 있으면 첫 다각형.
  const vertexCentroid = new Map<string, Vec2>();
  // 다각형 변(무방향) → 무게중심(길이 라벨을 바깥으로).
  const edgeCentroid = new Map<string, Vec2>();
  for (const element of spec.elements) {
    if (element.type !== "polygon") continue;
    const resolvedPolygon = resolved.elements.get(element.id);
    if (resolvedPolygon?.kind !== "polygon") continue;
    const center = centroid(resolvedPolygon.vertices);
    element.vertices.forEach((vertexId, index) => {
      if (!vertexCentroid.has(vertexId)) vertexCentroid.set(vertexId, center);
      const next = element.vertices[(index + 1) % element.vertices.length] ?? vertexId;
      edgeCentroid.set([vertexId, next].sort().join("|"), center);
    });
  }

  // 같은 꼭짓점의 각 개수(반지름 증분).
  const anglesAtVertex = new Map<string, number>();

  for (const element of spec.elements) {
    const resolvedElement = resolved.elements.get(element.id);
    if (resolvedElement === undefined) continue;
    const role = element.role;
    const label = element.label === null ? null : sanitizeLabelText(element.label);

    switch (resolvedElement.kind) {
      case "point": {
        const direction = chooseLabelDirection(
          resolvedElement.xy,
          placement,
          options.pxPerUnit,
          vertexCentroid.get(element.id) ?? null,
        );
        items.push({
          key: key("pt", element.id),
          elementId: element.id,
          role,
          kind: "point",
          xy: resolvedElement.xy,
          label: label === "" ? null : label,
          labelOffsetPx: { x: direction.x * FIGURE_PX.pointLabelOffset, y: direction.y * FIGURE_PX.pointLabelOffset },
          labelAnchor: anchorFor(direction),
        });
        if (element.type === "foot") appendFootExtension(items, element, resolvedElement.xy, resolved, role, key);
        break;
      }
      case "line": {
        const kind = resolvedElement.type === "lineEquation" ? "line" : resolvedElement.type;
        items.push({
          key: key("ln", element.id),
          elementId: element.id,
          role,
          kind,
          p1: resolvedElement.p1,
          p2: resolvedElement.p2,
          variant: "normal",
        });
        if (element.type === "segment" && element.showLength) {
          appendLengthLabel(items, spec, element, resolvedElement, edgeCentroid, role, key);
        }
        if (label) appendElementLabel(items, element.id, role, label, lineLabelPosition(resolvedElement), key);
        break;
      }
      case "circle": {
        items.push({
          key: key("ci", element.id),
          elementId: element.id,
          role,
          kind: "circle",
          center: resolvedElement.center,
          radius: resolvedElement.radius,
        });
        if (label) {
          const d = unit({ x: 1, y: 1 });
          appendElementLabel(
            items,
            element.id,
            role,
            label,
            {
              base: { x: resolvedElement.center.x + d.x * resolvedElement.radius, y: resolvedElement.center.y + d.y * resolvedElement.radius },
              offsetPx: { x: d.x * FIGURE_PX.pointLabelOffset, y: d.y * FIGURE_PX.pointLabelOffset },
            },
            key,
          );
        }
        break;
      }
      case "polygon": {
        items.push({ key: key("pg", element.id), elementId: element.id, role, kind: "polygon", vertices: resolvedElement.vertices });
        if (label) appendElementLabel(items, element.id, role, label, { base: centroid(resolvedElement.vertices), offsetPx: { x: 0, y: 0 } }, key);
        break;
      }
      case "angle": {
        if (element.type !== "angle") break;
        const vertexId = resolvedElement.points[1];
        const nth = anglesAtVertex.get(vertexId) ?? 0;
        anglesAtVertex.set(vertexId, nth + 1);
        const radiusPx = element.rightAngleMark
          ? FIGURE_PX.rightAngleSide
          : FIGURE_PX.angleRadius + nth * FIGURE_PX.angleRadiusStep;
        items.push({
          key: key("an", element.id),
          elementId: element.id,
          role,
          kind: "angle",
          xy: resolvedElement.xy,
          rightAngle: element.rightAngleMark,
          radiusPx,
        });
        if (element.showMeasure) {
          const [a, vertex, c] = resolvedElement.xy;
          const bisector = unit({ x: unit(sub(a, vertex)).x + unit(sub(c, vertex)).x, y: unit(sub(a, vertex)).y + unit(sub(c, vertex)).y });
          const distance = Math.max(radiusPx, FIGURE_PX.angleRadius) + FIGURE_PX.angleLabelGap;
          items.push({
            key: key("tx", element.id),
            elementId: element.id,
            role,
            kind: "text",
            text: formatFigureNumber(resolvedElement.degrees, { unit: "angle" }),
            textKind: "measure",
            position: { base: vertex, offsetPx: { x: bisector.x * distance, y: bisector.y * distance } },
            anchor: anchorFor(bisector),
          });
        }
        if (label) appendElementLabel(items, element.id, role, label, { base: resolvedElement.xy[1], offsetPx: { x: -FIGURE_PX.pointLabelOffset, y: -FIGURE_PX.pointLabelOffset } }, key);
        break;
      }
      case "graph": {
        resolvedElement.pieces.forEach((piece) => {
          items.push({ key: key("cv", element.id), elementId: element.id, role, kind: "curve", points: piece });
        });
        if (label) {
          const longest = [...resolvedElement.pieces].sort((p, q) => q.length - p.length)[0];
          const last = longest?.[longest.length - 1];
          if (last !== undefined) {
            appendElementLabel(items, element.id, role, label, { base: last, offsetPx: { x: -FIGURE_PX.pointLabelOffset, y: FIGURE_PX.pointLabelOffset } }, key);
          }
        }
        break;
      }
      default: {
        const unreachable: never = resolvedElement;
        void unreachable;
      }
    }
  }

  const decorations = buildDecorations(spec, items, options, 0);
  return { items: [...decorations, ...items], elements: items, decorations };
}

function appendElementLabel(
  items: SceneItem[],
  elementId: string,
  role: FigureElementRole,
  text: string,
  position: ScenePosition,
  key: (prefix: string, id: string | null) => string,
): void {
  const direction = unit(position.offsetPx);
  items.push({
    key: key("tx", elementId),
    elementId,
    role,
    kind: "text",
    text,
    textKind: "element",
    position,
    anchor: position.offsetPx.x === 0 && position.offsetPx.y === 0 ? ["middle", "middle"] : anchorFor(direction),
  });
}

function lineLabelPosition(line: Extract<ResolvedFigureElement, { kind: "line" }>): ScenePosition {
  const mid = { x: (line.p1.x + line.p2.x) / 2, y: (line.p1.y + line.p2.y) / 2 };
  const along = unit(sub(line.p2, line.p1));
  let normal = { x: -along.y, y: along.x };
  if (normal.y < 0 || (normal.y === 0 && normal.x > 0)) normal = { x: -normal.x, y: -normal.y };
  return { base: mid, offsetPx: { x: normal.x * FIGURE_PX.pointLabelOffset, y: normal.y * FIGURE_PX.pointLabelOffset } };
}

/**
 * 길이 라벨(§6.3, 오너 승인): 해당 선분에 `length` 제약이 있으면 그 값, 없으면 계산값 앞에 `≈`.
 * 위치: 중점에서 선분에 수직으로 8px. 다각형 변이면 무게중심 반대쪽, 아니면 위쪽(수평에 가까우면)
 * 또는 왼쪽(수직에 가까우면).
 */
function appendLengthLabel(
  items: SceneItem[],
  spec: FigureSpec,
  element: FigureLineLikeElement,
  line: Extract<ResolvedFigureElement, { kind: "line" }>,
  edgeCentroid: ReadonlyMap<string, Vec2>,
  role: FigureElementRole,
  key: (prefix: string, id: string | null) => string,
): void {
  const constraint = spec.constraints.find(
    (item): item is Extract<FigureSpec["constraints"][number], { type: "length" }> =>
      item.type === "length" && item.segment === element.id,
  );
  const length = Math.hypot(line.p2.x - line.p1.x, line.p2.y - line.p1.y);
  const text = constraint === undefined ? `≈${formatFigureNumber(length)}` : formatFigureNumber(constraint.value);

  const mid = { x: (line.p1.x + line.p2.x) / 2, y: (line.p1.y + line.p2.y) / 2 };
  const along = unit(sub(line.p2, line.p1));
  let normal = { x: -along.y, y: along.x };
  const center = edgeCentroid.get([...element.through].sort().join("|"));
  if (center !== undefined) {
    const toCenter = sub(center, mid);
    if (normal.x * toCenter.x + normal.y * toCenter.y > 0) normal = { x: -normal.x, y: -normal.y };
  } else if (Math.abs(along.x) >= Math.abs(along.y)) {
    if (normal.y < 0) normal = { x: -normal.x, y: -normal.y };
  } else if (normal.x > 0) {
    normal = { x: -normal.x, y: -normal.y };
  }
  items.push({
    key: key("tx", element.id),
    elementId: element.id,
    role,
    kind: "text",
    text,
    textKind: "measure",
    position: { base: mid, offsetPx: { x: normal.x * FIGURE_PX.lengthLabelOffset, y: normal.y * FIGURE_PX.lengthLabelOffset } },
    anchor: anchorFor(normal),
  });
}

/** §4.4: foot.to가 선분이고 발이 선분 밖이면 가까운 끝점에서 발까지 연장선. */
function appendFootExtension(
  items: SceneItem[],
  element: Extract<FigureElement, { type: "foot" }>,
  foot: Vec2,
  resolved: ResolvedFigure,
  role: FigureElementRole,
  key: (prefix: string, id: string | null) => string,
): void {
  const target = resolved.elements.get(element.to);
  if (target?.kind !== "line" || target.type !== "segment") return;
  const direction = sub(target.p2, target.p1);
  const lengthSquared = direction.x * direction.x + direction.y * direction.y;
  if (!(lengthSquared > 0)) return;
  const t = ((foot.x - target.p1.x) * direction.x + (foot.y - target.p1.y) * direction.y) / lengthSquared;
  const epsilon = 1e-9;
  if (t >= -epsilon && t <= 1 + epsilon) return;
  const nearest = t < 0 ? target.p1 : target.p2;
  items.push({ key: key("ex", element.id), elementId: element.id, role, kind: "segment", p1: nearest, p2: foot, variant: "extension" });
}

/* ---------------------------------------------------------------------------------------------
 * 장식(격자·축·눈금·축 이름) — Stage 2 재작업 1(P2-1, P2-2, P3-1)
 * ------------------------------------------------------------------------------------------- */

/** 화면 px 상자(x 오른쪽, y 아래쪽 +). */
export interface PxBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** 축·눈금 거리(px) — 오너 승인 시안(Function.dc.html) 측정값, FIGURE_DESIGN §15 P19. */
export const AXIS_PX = {
  arrowSize: 8,
  xTickGap: 5,
  yTickGap: 4.5,
  xNameOffset: { x: -5, y: 8 },
  yNameOffset: { x: 7.5, y: -6 },
} as const;

/** 텍스트 상자 크기 근사(px): 글자 폭 ≈ 글꼴 크기 × 0.62, 높이 ≈ 줄 높이. */
function textBoxSize(text: string, kind: TextKind): { width: number; height: number } {
  const font = textFontPx(kind);
  const lineHeight = kind === "element" ? 20 : kind === "measure" ? 16 : kind === "tick" ? 13 : 18;
  return { width: [...text].length * font * 0.62 + 2, height: lineHeight };
}

function boxAt(anchorX: number, anchorY: number, size: { width: number; height: number }, anchor: [AnchorX, AnchorY]): PxBox {
  const left = anchor[0] === "left" ? anchorX : anchor[0] === "right" ? anchorX - size.width : anchorX - size.width / 2;
  // JSXGraph anchorY "bottom" = 글자 아래가 기준점(글자는 위쪽), "top" = 글자 위가 기준점.
  const top = anchor[1] === "bottom" ? anchorY - size.height : anchor[1] === "top" ? anchorY : anchorY - size.height / 2;
  return { left, top, right: left + size.width, bottom: top + size.height };
}

function overlaps(a: PxBox, b: PxBox): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

interface PxFrame {
  width: number;
  height: number;
  toPx(p: Vec2): { x: number; y: number };
}

function frameOf(options: BuildSceneOptions): PxFrame {
  const [left, top, right, bottom] = options.boundingBox;
  const width = (right - left) * options.pxPerUnit.x;
  const height = (top - bottom) * options.pxPerUnit.y;
  return {
    width,
    height,
    toPx: (p) => ({ x: (p.x - left) * options.pxPerUnit.x, y: (top - p.y) * options.pxPerUnit.y }),
  };
}

/** 점 마커와 점 라벨이 차지하는 화면 상자 — 눈금 숫자가 이 위에 그려지지 않게 한다. */
export function elementObstacles(elements: readonly SceneItem[], options: BuildSceneOptions): PxBox[] {
  const frame = frameOf(options);
  const boxes: PxBox[] = [];
  for (const item of elements) {
    if (item.kind !== "point") continue;
    const p = frame.toPx(item.xy);
    const marker = 7;
    boxes.push({ left: p.x - marker, top: p.y - marker, right: p.x + marker, bottom: p.y + marker });
    if (item.label !== null) {
      const anchorX = p.x + item.labelOffsetPx.x;
      const anchorY = p.y - item.labelOffsetPx.y;
      boxes.push(boxAt(anchorX, anchorY, textBoxSize(item.label, "element"), item.labelAnchor));
    }
  }
  return boxes;
}

/**
 * 격자·축·눈금·축 이름(명세 `axes.visible`/`grid.visible`일 때만).
 * - 눈금 간격: 1·2·5 계열에서 화면 32px 이상. px/단위가 바뀌면(리사이즈) 다시 만든다.
 * - 눈금 숫자는 보드 가장자리 여백(12px) 안으로 들어가거나, 점·점 라벨·축 이름과 겹치면 그리지 않는다.
 * - 0 눈금과 원점 "O"는 표시하지 않는다(오너 결정).
 * @param generation 다시 만들 때마다 바꿔 JSXGraph 요소 id가 겹치지 않게 한다.
 */
export function buildDecorations(
  spec: FigureSpec,
  elements: readonly SceneItem[],
  options: BuildSceneOptions,
  generation: number,
): SceneItem[] {
  const items: SceneItem[] = [];
  let counter = 0;
  const key = (prefix: string): string => `d${generation}${prefix}${counter++}`;
  const [left, top, right, bottom] = options.boundingBox;
  const stepX = niceTickStep(options.pxPerUnit.x);
  const stepY = niceTickStep(options.pxPerUnit.y);
  const xs = ticksIn(left, right, stepX);
  const ys = ticksIn(bottom, top, stepY);

  if (spec.grid.visible) {
    items.push({ key: key("grid"), elementId: null, role: "given", kind: "grid", xs, ys, range: [left, top, right, bottom] });
  }
  if (!spec.axes.visible) return items;

  items.push({ key: key("axx"), elementId: null, role: "given", kind: "axis", axis: "x" });
  items.push({ key: key("axy"), elementId: null, role: "given", kind: "axis", axis: "y" });

  const frame = frameOf(options);
  const inset = VIEWPORT_TICK_EDGE_PX;
  const insideBoard = (box: PxBox): boolean =>
    box.left >= inset && box.top >= inset && box.right <= frame.width - inset && box.bottom <= frame.height - inset;
  const obstacles = elementObstacles(elements, options);
  const origin = frame.toPx({ x: 0, y: 0 });

  // 축 이름(이탤릭 아님, 오너 결정): 화살표 끝 바로 바깥. 축 이름 상자도 눈금 숫자의 장애물이다.
  if (spec.axes.xLabel !== null) {
    const text = sanitizeLabelText(spec.axes.xLabel);
    const anchor: [AnchorX, AnchorY] = ["right", "bottom"];
    obstacles.push(boxAt(frame.width + AXIS_PX.xNameOffset.x, origin.y - AXIS_PX.xNameOffset.y, textBoxSize(text, "axisName"), anchor));
    items.push({
      key: key("axn"),
      elementId: null,
      role: "given",
      kind: "text",
      text,
      textKind: "axisName",
      position: { edge: "x", offsetPx: AXIS_PX.xNameOffset },
      anchor,
    });
  }
  if (spec.axes.yLabel !== null) {
    const text = sanitizeLabelText(spec.axes.yLabel);
    const anchor: [AnchorX, AnchorY] = ["left", "top"];
    obstacles.push(boxAt(origin.x + AXIS_PX.yNameOffset.x, -AXIS_PX.yNameOffset.y, textBoxSize(text, "axisName"), anchor));
    items.push({
      key: key("axn"),
      elementId: null,
      role: "given",
      kind: "text",
      text,
      textKind: "axisName",
      position: { edge: "y", offsetPx: AXIS_PX.yNameOffset },
      anchor,
    });
  }

  const pushTick = (value: number, axis: "x" | "y"): void => {
    if (value === 0) return;
    const text = formatTickLabel(value);
    const base = axis === "x" ? { x: value, y: 0 } : { x: 0, y: value };
    const p = frame.toPx(base);
    const anchor: [AnchorX, AnchorY] = axis === "x" ? ["middle", "top"] : ["right", "middle"];
    const anchorX = axis === "x" ? p.x : p.x - AXIS_PX.yTickGap;
    const anchorY = axis === "x" ? p.y + AXIS_PX.xTickGap : p.y;
    const box = boxAt(anchorX, anchorY, textBoxSize(text, "tick"), anchor);
    if (!insideBoard(box) || obstacles.some((obstacle) => overlaps(box, obstacle))) return;
    items.push({
      key: key("tk"),
      elementId: null,
      role: "given",
      kind: "text",
      text,
      textKind: "tick",
      position: {
        base,
        offsetPx: axis === "x" ? { x: 0, y: -AXIS_PX.xTickGap } : { x: -AXIS_PX.yTickGap, y: 0 },
      },
      anchor,
    });
  };
  xs.forEach((x) => pushTick(x, "x"));
  ys.forEach((y) => pushTick(y, "y"));
  return items;
}

/** 눈금 숫자를 그리지 않는 가장자리 띠(px) — P15와 같은 12px. */
const VIEWPORT_TICK_EDGE_PX = 12;

/** 텍스트 종류별 글꼴 크기(px). */
export function textFontPx(kind: TextKind): number {
  switch (kind) {
    case "element":
      return LABEL_FONT_PX.element;
    case "measure":
      return LABEL_FONT_PX.measure;
    case "tick":
      return LABEL_FONT_PX.tick;
    case "axisName":
      return LABEL_FONT_PX.axisName;
    default: {
      const unreachable: never = kind;
      void unreachable;
      return LABEL_FONT_PX.element;
    }
  }
}
