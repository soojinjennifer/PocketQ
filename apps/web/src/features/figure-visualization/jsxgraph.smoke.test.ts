/**
 * 실제 JSXGraph 1.14.1(mock 없음) 스모크 테스트 — jsdom에서 보드 하나를 만들고 정리한다.
 * jsdom에는 레이아웃이 없어 크기는 `resizeContainer`로 직접 준다. 시각 검사는 `/dev/figures`(실기기)에서 한다.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { figureSpecSchema, validateFigureSemantics } from "validation";
import { F01_TRIANGLE_ANGLE } from "validation/fixtures";
import { buildBoardScene } from "./buildBoardScene";
import { FIGURE_PALETTE_TOKENS, readFigurePalette } from "./figureStyle";
import { loadJsxGraph } from "./jsxgraphAdapter";
import { mountFigureBoard } from "./mountFigureBoard";
import { resolveStepState } from "./resolveStepState";
import { computeViewport } from "./viewport";

const TOKEN_VALUES: Record<string, string> = {
  [FIGURE_PALETTE_TOKENS.ink]: "#232b38",
  [FIGURE_PALETTE_TOKENS.brand]: "#5e6e82",
  [FIGURE_PALETTE_TOKENS.teal]: "#4f8285",
  [FIGURE_PALETTE_TOKENS.axis]: "#3c3c4399",
  [FIGURE_PALETTE_TOKENS.grid]: "#3c3c431f",
  [FIGURE_PALETTE_TOKENS.underlay]: "#dcc08a",
  [FIGURE_PALETTE_TOKENS.canvas]: "#fbfaf6",
};

beforeEach(() => {
  for (const [name, value] of Object.entries(TOKEN_VALUES)) document.documentElement.style.setProperty(name, value);
});
afterEach(() => {
  document.body.innerHTML = "";
});

describe("실제 JSXGraph 스모크", () => {
  it("F01 보드를 만들고 라벨을 SVG 텍스트 노드로 그린 뒤 freeBoard로 정리한다", async () => {
    const spec = figureSpecSchema.parse(F01_TRIANGLE_ANGLE.raw);
    const semantics = validateFigureSemantics(spec);
    if (!semantics.ok) throw new Error("F01 invalid");
    const viewport = computeViewport(spec, semantics.resolved, 348);
    if (viewport === null) throw new Error("viewport");
    const container = document.createElement("div");
    container.id = "figboardsmoke";
    // jsdom에는 레이아웃이 없다. JSXGraph는 컨테이너 실제 크기(clientWidth → 계산된 style)를 읽으므로
    // 브라우저에서 React가 잡아 주는 크기를 style로 흉내 낸다.
    container.style.width = `${viewport.width}px`;
    container.style.height = `${viewport.height}px`;
    document.body.append(container);
    const palette = readFigurePalette(container);
    if (palette === null) throw new Error("palette");

    const api = await loadJsxGraph();
    const [left, top, right, bottom] = viewport.boundingBox;
    const scene = buildBoardScene(spec, semantics.resolved, {
      pxPerUnit: { x: viewport.width / (right - left), y: viewport.height / (top - bottom) },
      boundingBox: viewport.boundingBox,
    });
    const live = mountFigureBoard(api, container, spec, scene, viewport, palette, { element: "e", measure: "m", tick: "t", axisName: "a" }, resolveStepState(spec, null));

    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    const texts = [...container.querySelectorAll("text")].map((node) => node.textContent);
    expect(texts).toEqual(expect.arrayContaining(["A", "B", "C", "45°"]));
    // 저작권·이동 버튼 없음, touch-action 미설정(registerEvents: false).
    expect(container.textContent).not.toMatch(/JSXGraph|Copyright/i);
    expect(container.style.touchAction).toBe("");
    // HTML 텍스트 노드(div.JXGtext) 없음 — 전부 SVG internal.
    expect(container.querySelector("div.JXGtext")).toBeNull();
    // Tab으로 갈 수 있는 요소 없음.
    expect(container.querySelector("[tabindex]:not([tabindex='-1'])")).toBeNull();

    // 점 좌표가 실제 화면 좌표로 그려졌다(크기 0 보드가 아님).
    const pointA = container.querySelector("#figboardsmoke_pt0_A");
    expect(Number(pointA?.getAttribute("cx"))).toBeGreaterThan(0);
    const labelA = container.querySelector("#figboardsmoke_pt0_ALabel");
    expect(labelA?.getAttribute("class")).toBe("e");
    // JSXGraph 기본 글꼴(Arial) 인라인 스타일을 쓰지 않는다 — 앱 글꼴 상속.
    expect((labelA as SVGElement | null)?.style.fontFamily ?? "").toBe("");
    expect(labelA?.getAttribute("fill")).toBe("#232b38");
    // 최종 상태(F01은 모든 요소가 처음부터 보임): 점 라벨 A·B·C가 모두 표시된다.
    const labels = [...container.querySelectorAll("text[id$='Label']")];
    expect(labels).toHaveLength(3);
    expect(labels.map((node) => node.getAttribute("display"))).toEqual(["inline", "inline", "inline"]);
    live.applyStepState(resolveStepState(spec, "s2"));
    live.resize({ ...viewport, width: 700, height: 360 });
    live.destroy();
    expect(container.childElementCount).toBe(0);
    // 실제 JSXGraph(약 1 MB) 첫 로딩이 전체 테스트 부하 때 기본 5초를 넘을 수 있어 명시 타임아웃(QA LOW 1).
  }, 15_000);
});
