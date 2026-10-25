/**
 * Stage 5 WU8 — 10개 사례의 웹 렌더 좌표(계획 §6.1 "jsdom FigureView 렌더 좌표"). **실제 JSXGraph**(mock 없음).
 *
 * 입력 경로: fixture → 서버와 같은 재파싱(`parseSolutionFigures`, 저장·재조회 값과 같음 — api `figuresStage5.integration.test.ts`가
 * 저장 = SSE = 재조회를 확인) → 상세 응답 모양으로 감싸 웹 스키마 parse(`problemHistoryDetailSchema`) → 렌더러 장면 → 보드.
 * 확인: 보드에 그려진 점(SVG ellipse 중심 px)을 보드 좌표로 되돌린 값이 손 계산값(`expected.points`, FIGURE_SPEC §11.1)과 같다.
 * 각도는 그려진 세 점으로 따로 계산(독립 공식), F08은 그래프 조각 수 = 2(불연속 x=1). F09는 k별 라벨 표시 여부.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FigureSpec } from "shared-types";
import { parseSolutionFigures, problemHistoryDetailSchema, validateFigureSemantics } from "validation";
import { F09_STEPWISE_AUXILIARY, VALID_FIGURE_FIXTURES, type FigureFixture } from "validation/fixtures";
import { buildBoardScene } from "./buildBoardScene";
import { FIGURE_PALETTE_TOKENS, readFigurePalette } from "./figureStyle";
import { loadJsxGraph } from "./jsxgraphAdapter";
import { mountFigureBoard, type LiveFigureBoard } from "./mountFigureBoard";
import { resolveStepStateAt } from "./resolveStepState";
import { computeViewport, type FigureViewport } from "./viewport";

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

/** 서버 저장·재조회와 같은 값으로 받은 도형(상세 응답 → 웹 parse → 재파싱). */
function receivedFigure(fixture: FigureFixture): FigureSpec {
  const server = parseSolutionFigures(JSON.parse(JSON.stringify({ figures: [fixture.raw] })) as unknown);
  const detail = problemHistoryDetailSchema.parse({
    problemId: "p",
    recognizedText: "t",
    recognizedLatex: null,
    createdAt: "2026-10-25T00:00:00.000Z",
    solution: { conceptMd: null, solutionMd: null, answerMd: "a", conceptTags: [], aiProvider: "openai", aiModel: "m", figures: server.figures },
    chatMessages: [],
  });
  const figure = parseSolutionFigures({ figures: detail.solution?.figures }).figures[0];
  if (!figure) throw new Error(`${fixture.id} rejected`);
  return figure;
}

interface Mounted {
  container: HTMLElement;
  viewport: FigureViewport;
  live: LiveFigureBoard;
  spec: FigureSpec;
}

async function mount(spec: FigureSpec, boardId: string, step: number | "final" = "final"): Promise<Mounted> {
  const semantics = validateFigureSemantics(spec);
  if (!semantics.ok) throw new Error("semantics");
  // 마이페이지 오버레이 보드 폭 648px(§18.4).
  const viewport = computeViewport(spec, semantics.resolved, 648);
  if (viewport === null) throw new Error("viewport");
  const container = document.createElement("div");
  container.id = boardId;
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
  const live = mountFigureBoard(api, container, spec, scene, viewport, palette, { element: "e", measure: "m", tick: "t", axisName: "a" }, resolveStepStateAt(spec, step));
  return { container, viewport, live, spec };
}

/** 그려진 점의 보드 좌표(SVG ellipse 중심 px → 사용자 좌표). */
function renderedPoint(m: Mounted, id: string): { x: number; y: number } {
  const node = [...m.container.querySelectorAll("ellipse")].find((el) => new RegExp(`^${m.container.id}_pt\\d+_${id}$`).test(el.id));
  if (!node) throw new Error(`point ${id} not drawn`);
  const [left, top, right, bottom] = m.viewport.boundingBox;
  const cx = Number(node.getAttribute("cx"));
  const cy = Number(node.getAttribute("cy"));
  return { x: left + (cx / m.viewport.width) * (right - left), y: top - (cy / m.viewport.height) * (top - bottom) };
}

/** 세 점으로 각(도) — 렌더러·검증 커널과 다른 독립 공식(atan2 차). */
function angleDeg(a: { x: number; y: number }, v: { x: number; y: number }, c: { x: number; y: number }): number {
  const d = Math.abs(Math.atan2(a.y - v.y, a.x - v.x) - Math.atan2(c.y - v.y, c.x - v.x)) * (180 / Math.PI);
  return d > 180 ? 360 - d : d;
}

/** px 반올림 오차 허용(648px 보드에서 0.5px ≈ 좌표 0.01 이하). */
const TOL = 2;

describe("사례 1~9 렌더 좌표 = 손 계산", () => {
  it.each(VALID_FIGURE_FIXTURES.map((f, i) => [f.id, f, i] as const))(
    "%s",
    async (id, fixture, index) => {
      const m = await mount(receivedFigure(fixture), `figboardcase${index}`);
      for (const point of fixture.expected?.points ?? []) {
        const got = renderedPoint(m, point.id);
        expect(got.x).toBeCloseTo(point.x, TOL);
        expect(got.y).toBeCloseTo(point.y, TOL);
      }
      if (id === "F01") expect(angleDeg(renderedPoint(m, "B"), renderedPoint(m, "A"), renderedPoint(m, "C"))).toBeCloseTo(45, 1);
      if (id === "F02") expect(angleDeg(renderedPoint(m, "C"), renderedPoint(m, "H"), renderedPoint(m, "B"))).toBeCloseTo(90, 1);
      if (id === "F04") {
        const [o, mm, a, b] = ["O", "M", "A", "B"].map((p) => renderedPoint(m, p)) as [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }, { x: number; y: number }];
        expect((mm.x - o.x) * (b.x - a.x) + (mm.y - o.y) * (b.y - a.y)).toBeCloseTo(0, 1);
      }
      if (id === "F05") {
        const [o, p, t1, t2] = ["O", "P", "T1", "T2"].map((q) => renderedPoint(m, q)) as [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }, { x: number; y: number }];
        const cross = (t: { x: number; y: number }) => (p.x - o.x) * (t.y - o.y) - (p.y - o.y) * (t.x - o.x);
        expect(Math.sign(cross(t1))).toBe(-Math.sign(cross(t2)));
        expect(angleDeg(o, t1, p)).toBeCloseTo(90, 1);
      }
      if (id === "F08") {
        // 불연속 x=1 양쪽 조각 2개(곡선 id 접미 없음 = 본선).
        const pieces = [...m.container.querySelectorAll("path")].filter((el) => new RegExp(`^${m.container.id}_cv\\d+_g$`).test(el.id));
        expect(pieces).toHaveLength(2);
      }
      m.live.destroy();
      expect(m.container.childElementCount).toBe(0);
    },
    20_000,
  );

  it("사례 9 F09: k=1에서 H·M 라벨 숨김, k=2에서 H 보임·M 숨김, k=3·최종에서 둘 다 보임", async () => {
    const spec = receivedFigure(F09_STEPWISE_AUXILIARY);
    const m = await mount(spec, "figboardstep", 1);
    const shown = (id: string) =>
      [...m.container.querySelectorAll("text")].find((el) => new RegExp(`_${id}Label$`).test(el.id))?.getAttribute("display");
    expect([shown("H"), shown("M")]).toEqual(["none", "none"]);
    m.live.applyStepState(resolveStepStateAt(spec, 2));
    expect([shown("H"), shown("M")]).toEqual(["inline", "none"]);
    m.live.applyStepState(resolveStepStateAt(spec, 3));
    expect([shown("H"), shown("M")]).toEqual(["inline", "inline"]);
    m.live.applyStepState(resolveStepStateAt(spec, "final"));
    expect([shown("H"), shown("M")]).toEqual(["inline", "inline"]);
    m.live.destroy();
  }, 20_000);
});
