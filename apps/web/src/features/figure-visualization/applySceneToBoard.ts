/**
 * 장면(`FigureScene`)을 JSXGraph 보드 요소로 만들고, 단계 상태를 속성으로 적용한다.
 *
 * 안전 규칙(`docs/FIGURE_SPEC.md` §14.2, `docs/FIGURE_DESIGN.md` §11):
 * - 모든 텍스트·라벨: `display: "internal"`(SVG 텍스트 노드), `parse: false`(JessieCode 파싱 금지),
 *   `useMathJax`·`useKatex`·`useASCIIMathML: false`. 점 라벨 하위 속성에도 같은 값을 준다.
 * - 모든 요소 `fixed: true`, `highlight: false`(hover 강조 없음). 라벨 없는 점은 `name: ""`, `withLabel: false`.
 * - 각은 `withLabel: false`. `rightAngleMark`가 false인 각은 `orthoType: "sector"`로 자동 직각 사각형을 막는다.
 * - 끝점·중심·꼭짓점은 보이지 않는 보조 점으로 만든다(JSXGraph 기본 점이 그려지지 않게).
 *
 * 단계 전환은 요소를 다시 만들지 않고 `setAttribute`로만 바꾼다(`applyStepState`).
 */
import type { FigureElementRole } from "shared-types";
import type { Vec2 } from "validation";
import { AXIS_PX, hasUnderlay, textFontPx, type FigureScene, type SceneItem } from "./buildBoardScene";
import {
  UNDERLAY_LINE_WIDTH,
  UNDERLAY_OPACITY,
  angleArcStyle,
  extensionLineStyle,
  fillStyle,
  labelOpacity,
  lineStyle,
  pointStyle,
  type FigurePalette,
} from "./figureStyle";
import type { JxgBoard, JxgElement } from "./jsxgraphAdapter";
import type { FigureElementDisplay, FigureStepState } from "./resolveStepState";

/** CSS Module 클래스 이름(halo·글꼴). */
export interface FigureTextClasses {
  element: string;
  measure: string;
  tick: string;
  axisName: string;
}

/** 모든 텍스트·라벨에 강제하는 안전 속성. */
export const SAFE_TEXT_ATTRIBUTES = {
  display: "internal",
  parse: false,
  useMathJax: false,
  useKatex: false,
  useASCIIMathML: false,
} as const;

/**
 * JSXGraph 텍스트 기본 인라인 스타일(`font-family: Arial…`)을 비워 앱 글꼴을 상속하게 한다
 * (`docs/FIGURE_DESIGN.md` §6.1). 글꼴·halo는 CSS Module 클래스가 맡는다.
 */
const TEXT_STYLE_RESET = {
  cssDefaultStyle: "",
  highlightCssDefaultStyle: "",
  cssStyle: "",
  highlightCssStyle: "",
} as const;

/**
 * JSXGraph 요소 id = 장면 key(`<접두>번호_<요소ID>`) + 부속 접미사(`-u` 언더레이, `-f` 채움, `-eN` 변).
 * 명세 요소 ID에는 `-`가 없으므로 접미사와 섞이지 않는다.
 */

/** 모든 요소 공통 속성. */
const COMMON = { fixed: true, highlight: false, showInfobox: false } as const;

/**
 * 레이어(아래 → 위). 재작업 1(P1-1): 점 언더레이를 선 언더레이와 같은 층(3)으로 내려, 각 표시(직각
 * 사각형·호, 4)가 강조 언더레이 원에 가려지지 않게 한다.
 */
export const LAYER = {
  grid: 0,
  axis: 1,
  fill: 2,
  underlay: 3,
  pointUnderlay: 3,
  angle: 4,
  line: 5,
  point: 7,
  text: 9,
} as const;

type PartRole = "stroke" | "underlayStroke" | "fill" | "point" | "underlayPoint" | "angle" | "text" | "static";

interface Part {
  role: PartRole;
  element: JxgElement;
}

interface LiveItem {
  item: SceneItem;
  parts: Part[];
}

export interface LiveScene {
  applyStepState(state: FigureStepState): void;
  /** 장식(격자·축·눈금)만 지우고 새로 만든다. 요소는 그대로 둔다. */
  replaceDecorations(decorations: readonly SceneItem[]): void;
}

/** 만든 요소(보조 점 포함)를 모두 기록하는 보드 래퍼 — 장식을 통째로 지우기 위해서다. */
class RecordingBoard implements JxgBoard {
  readonly created: JxgElement[] = [];
  constructor(private readonly board: JxgBoard) {}
  create(elementType: string, parents: unknown[], attributes: Record<string, unknown>): JxgElement {
    const element = this.board.create(elementType, parents, attributes);
    this.created.push(element);
    return element;
  }
  removeObject(element: JxgElement): void {
    this.board.removeObject(element);
  }
  update(): void {
    this.board.update();
  }
  suspendUpdate(): void {
    this.board.suspendUpdate();
  }
  unsuspendUpdate(): void {
    this.board.unsuspendUpdate();
  }
  setBoundingBox(boundingBox: [number, number, number, number], keepAspectRatio: boolean): void {
    this.board.setBoundingBox(boundingBox, keepAspectRatio);
  }
  resizeContainer(width: number, height: number, dontSetCss: boolean, dontSetBoundingBox: boolean): void {
    this.board.resizeContainer(width, height, dontSetCss, dontSetBoundingBox);
  }
  getBoundingBox(): [number, number, number, number] {
    return this.board.getBoundingBox();
  }
  get unitX(): number {
    return this.board.unitX;
  }
  get unitY(): number {
    return this.board.unitY;
  }
}

const VISIBLE_DEFAULT: FigureElementDisplay = { visible: true, emphasis: "default" };
const HIDDEN: FigureElementDisplay = { visible: false };

function hiddenPoint(board: JxgBoard, p: Vec2): JxgElement {
  return board.create("point", [p.x, p.y], { ...COMMON, visible: false, withLabel: false, name: "" });
}

function lineFlags(kind: "segment" | "line" | "ray"): { straightFirst: boolean; straightLast: boolean } {
  return { straightFirst: kind === "line", straightLast: kind !== "segment" };
}

function textClass(classes: FigureTextClasses, kind: keyof FigureTextClasses): Record<string, string> {
  return { cssClass: classes[kind], highlightCssClass: classes[kind] };
}

function createLine(
  board: JxgBoard,
  p1: Vec2,
  p2: Vec2,
  kind: "segment" | "line" | "ray",
  layer: number,
  id: string,
): JxgElement {
  return board.create("line", [hiddenPoint(board, p1), hiddenPoint(board, p2)], {
    ...COMMON,
    ...lineFlags(kind),
    id,
    name: "",
    withLabel: false,
    layer,
    firstArrow: false,
    lastArrow: false,
  });
}

function createPart(board: JxgBoard, item: SceneItem, palette: FigurePalette, classes: FigureTextClasses): Part[] {
  const id = item.key;
  const parts: Part[] = [];
  switch (item.kind) {
    case "grid": {
      const xs: number[] = [];
      const ys: number[] = [];
      const [xMin, yMax, xMax, yMin] = item.range;
      // 격자선 전체를 NaN으로 끊은 curve 하나로 그린다(요소 수 절약).
      for (const x of item.xs) {
        xs.push(x, x, Number.NaN);
        ys.push(yMin, yMax, Number.NaN);
      }
      for (const y of item.ys) {
        xs.push(xMin, xMax, Number.NaN);
        ys.push(y, y, Number.NaN);
      }
      parts.push({
        role: "static",
        element: board.create("curve", [xs, ys], {
          ...COMMON,
          id,
          name: "",
          withLabel: false,
          layer: LAYER.grid,
          strokeColor: palette.grid,
          strokeWidth: 1,
          strokeOpacity: 1,
        }),
      });
      return parts;
    }
    case "axis": {
      const p2 = item.axis === "x" ? { x: 1, y: 0 } : { x: 0, y: 1 };
      const element = board.create("line", [hiddenPoint(board, { x: 0, y: 0 }), hiddenPoint(board, p2)], {
        ...COMMON,
        id,
        name: "",
        withLabel: false,
        layer: LAYER.axis,
        straightFirst: true,
        straightLast: true,
        firstArrow: false,
        // 오너 승인 시안(Function.dc.html): 화살표 길이 8 · 폭 8px. type 1 = 10×10 단위 삼각형을
        // strokeWidth × size px로 확대 → strokeWidth 1 × size 8 = 8×8px(FIGURE_DESIGN §15 P19).
        lastArrow: { type: 1, size: AXIS_PX.arrowSize },
        strokeColor: palette.axis,
        strokeWidth: 1,
      });
      parts.push({ role: "static", element });
      return parts;
    }
    case "point": {
      parts.push({
        role: "underlayPoint",
        element: board.create("point", [item.xy.x, item.xy.y], {
          ...COMMON,
          id: `${id}-u`,
          name: "",
          withLabel: false,
          face: "o",
          layer: LAYER.pointUnderlay,
          strokeWidth: 0,
          visible: false,
        }),
      });
      parts.push({
        role: "point",
        element: board.create("point", [item.xy.x, item.xy.y], {
          ...COMMON,
          id,
          face: "o",
          layer: LAYER.point,
          name: item.label ?? "",
          withLabel: item.label !== null,
          label: {
            ...SAFE_TEXT_ATTRIBUTES,
            ...TEXT_STYLE_RESET,
            ...textClass(classes, "element"),
            fixed: true,
            highlight: false,
            autoPosition: false,
            fontSize: textFontPx("element"),
            offset: [item.labelOffsetPx.x, item.labelOffsetPx.y],
            anchorX: item.labelAnchor[0],
            anchorY: item.labelAnchor[1],
            strokeColor: palette.ink,
            layer: LAYER.text,
          },
        }),
      });
      return parts;
    }
    case "segment":
    case "line":
    case "ray": {
      parts.push({ role: "underlayStroke", element: createLine(board, item.p1, item.p2, item.kind, LAYER.underlay, `${id}-u`) });
      parts.push({ role: "stroke", element: createLine(board, item.p1, item.p2, item.kind, LAYER.line, id) });
      return parts;
    }
    case "circle": {
      const create = (layer: number, suffix: string): JxgElement =>
        board.create("circle", [hiddenPoint(board, item.center), item.radius], {
          ...COMMON,
          id: `${id}${suffix}`,
          name: "",
          withLabel: false,
          layer,
          fillOpacity: 0,
          hasInnerPoints: false,
        });
      parts.push({ role: "underlayStroke", element: create(LAYER.underlay, "-u") });
      parts.push({ role: "stroke", element: create(LAYER.line, "") });
      return parts;
    }
    case "polygon": {
      const vertices = item.vertices.map((vertex) => hiddenPoint(board, vertex));
      parts.push({
        role: "fill",
        element: board.create("polygon", vertices, {
          ...COMMON,
          id: `${id}-f`,
          name: "",
          withLabel: false,
          withLines: false,
          hasInnerPoints: false,
          layer: LAYER.fill,
          vertices: { visible: false, fixed: true, withLabel: false, name: "" },
          strokeWidth: 0,
        }),
      });
      item.vertices.forEach((vertex, index) => {
        const next = item.vertices[(index + 1) % item.vertices.length] ?? vertex;
        parts.push({ role: "underlayStroke", element: createLine(board, vertex, next, "segment", LAYER.underlay, `${id}-u${index}`) });
        parts.push({ role: "stroke", element: createLine(board, vertex, next, "segment", LAYER.line, `${id}-e${index}`) });
      });
      return parts;
    }
    case "angle": {
      const points = item.xy.map((p) => hiddenPoint(board, p));
      const radiusPx = item.radiusPx;
      const type = item.rightAngle ? "square" : "sector";
      parts.push({
        role: "angle",
        element: board.create("angle", points, {
          ...COMMON,
          id,
          name: "",
          withLabel: false,
          layer: LAYER.angle,
          type,
          orthoType: type,
          radius: () => radiusPx / board.unitX,
          selection: "auto",
          orientation: "counterclockwise",
          dot: { visible: false },
          label: { ...SAFE_TEXT_ATTRIBUTES, visible: false },
        }),
      });
      return parts;
    }
    case "curve": {
      const xs = item.points.map((p) => p.x);
      const ys = item.points.map((p) => p.y);
      const create = (layer: number, suffix: string): JxgElement =>
        board.create("curve", [xs, ys], { ...COMMON, id: `${id}${suffix}`, name: "", withLabel: false, layer });
      parts.push({ role: "underlayStroke", element: create(LAYER.underlay, "-u") });
      parts.push({ role: "stroke", element: create(LAYER.line, "") });
      return parts;
    }
    case "text": {
      const { position } = item;
      const x =
        "edge" in position
          ? () => (position.edge === "x" ? board.getBoundingBox()[2] : 0) + position.offsetPx.x / board.unitX
          : () => position.base.x + position.offsetPx.x / board.unitX;
      const y =
        "edge" in position
          ? () => (position.edge === "y" ? board.getBoundingBox()[1] : 0) + position.offsetPx.y / board.unitY
          : () => position.base.y + position.offsetPx.y / board.unitY;
      parts.push({
        role: item.elementId === null ? "static" : "text",
        element: board.create("text", [x, y, item.text], {
          ...COMMON,
          ...SAFE_TEXT_ATTRIBUTES,
          ...TEXT_STYLE_RESET,
          ...textClass(classes, item.textKind),
          id,
          layer: LAYER.text,
          fontSize: textFontPx(item.textKind),
          anchorX: item.anchor[0],
          anchorY: item.anchor[1],
          strokeColor: palette.ink,
          strokeOpacity: 1,
        }),
      });
      return parts;
    }
    default: {
      const unreachable: never = item;
      void unreachable;
      return parts;
    }
  }
}

function applyPart(part: Part, item: SceneItem, display: FigureElementDisplay, palette: FigurePalette): void {
  if (part.role === "static") return;
  if (!display.visible) {
    // Stage 4(S4-3): 숨길 때도 기본 상태 스타일을 먼저 적용해, 이전 단계의 강조 스타일이 숨은 요소에 남지 않게 한다
    // (어떤 순서로 이동해도 같은 단계 = 같은 SVG 속성).
    applyPart(part, item, VISIBLE_DEFAULT, palette);
    part.element.setAttribute({ visible: false });
    return;
  }
  const emphasis = display.emphasis;
  const role: FigureElementRole = item.role;
  const highlighted = emphasis === "highlight";

  switch (part.role) {
    case "stroke": {
      const style =
        item.kind === "segment" && item.variant === "extension"
          ? extensionLineStyle(emphasis, palette)
          : lineStyle(role, emphasis, palette);
      part.element.setAttribute({ visible: true, ...style });
      return;
    }
    case "underlayStroke":
      part.element.setAttribute({
        visible: highlighted && hasUnderlay(item),
        strokeColor: palette.underlay,
        strokeOpacity: UNDERLAY_OPACITY,
        strokeWidth: UNDERLAY_LINE_WIDTH,
        dash: 0,
      });
      return;
    case "fill":
      part.element.setAttribute({ visible: true, ...fillStyle(role, emphasis, "polygon", palette) });
      return;
    case "point": {
      const style = pointStyle(role, emphasis, palette);
      part.element.setAttribute({
        visible: true,
        size: style.size,
        fillColor: style.fillColor,
        fillOpacity: style.fillOpacity,
        strokeColor: style.strokeColor,
        strokeOpacity: style.strokeOpacity,
        strokeWidth: style.strokeWidth,
        label: { strokeOpacity: labelOpacity(emphasis) },
      });
      return;
    }
    case "underlayPoint": {
      const style = pointStyle(role, emphasis, palette);
      part.element.setAttribute({
        visible: style.underlaySize !== null,
        size: style.underlaySize ?? 0,
        fillColor: palette.underlay,
        fillOpacity: UNDERLAY_OPACITY,
        strokeWidth: 0,
      });
      return;
    }
    case "angle":
      part.element.setAttribute({
        visible: true,
        ...angleArcStyle(role, emphasis, palette),
        // 직각 표시(square)는 role과 관계없이 항상 실선(오너 승인 시안, design P2-A). 색·굵기는 role을 따른다.
        ...(item.kind === "angle" && item.rightAngle ? { dash: 0 } : {}),
        ...fillStyle(role, emphasis, "angle", palette),
      });
      return;
    case "text":
      part.element.setAttribute({ visible: true, strokeColor: palette.ink, strokeOpacity: labelOpacity(emphasis) });
      return;
    default: {
      const unreachable: never = part.role;
      void unreachable;
    }
  }
}

/**
 * 장면의 모든 항목을 순서대로 보드에 만든다. 호출 측이 `suspendUpdate`/`unsuspendUpdate`로 감싼다.
 */
export function applySceneToBoard(
  board: JxgBoard,
  scene: FigureScene,
  palette: FigurePalette,
  classes: FigureTextClasses,
): LiveScene {
  const createDecorations = (items: readonly SceneItem[]): { live: LiveItem[]; created: JxgElement[] } => {
    const recorder = new RecordingBoard(board);
    const created = items.map((item) => ({ item, parts: createPart(recorder, item, palette, classes) }));
    return { live: created, created: recorder.created };
  };

  let decorations = createDecorations(scene.decorations);
  const elements: LiveItem[] = scene.elements.map((item) => ({ item, parts: createPart(board, item, palette, classes) }));

  return {
    applyStepState(state: FigureStepState) {
      for (const { item, parts } of elements) {
        const display = item.elementId === null ? VISIBLE_DEFAULT : (state.get(item.elementId) ?? HIDDEN);
        for (const part of parts) applyPart(part, item, display, palette);
      }
    },
    replaceDecorations(next: readonly SceneItem[]) {
      // 의존 관계 역순(선 → 보조 점)으로 지운다.
      for (const element of [...decorations.created].reverse()) board.removeObject(element);
      decorations = createDecorations(next);
    },
  };
}
