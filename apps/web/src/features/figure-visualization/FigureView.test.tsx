/**
 * FigureView 렌더러 테스트(R-1~R-8) — jsdom + 가짜 JSXGraph 어댑터.
 * 실제 JSXGraph는 `jsxgraph.smoke.test.ts`에서 따로 확인한다.
 */
import { act, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import type { FigureSpec } from "shared-types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { figureSpecSchema } from "validation";
import {
  F01_TRIANGLE_ANGLE,
  F02_FOOT_OF_PERPENDICULAR,
  F07_QUADRATIC,
  F08_RATIONAL,
  F09_STEPWISE_AUXILIARY,
  F10A_MISSING_REFERENCE,
} from "validation/fixtures";
import { FIGURE_FALLBACK_MESSAGE } from "./FigureFallback";
import { FigureView } from "./FigureView";
import { FIGURE_PALETTE_TOKENS } from "./figureStyle";
import type { JsxGraphApi, JxgBoard, JxgElement } from "./jsxgraphAdapter";

/* ---------------------------------------------------------------------------------------------
 * 가짜 JSXGraph
 * ------------------------------------------------------------------------------------------- */

class FakeElement implements JxgElement {
  readonly history: Record<string, unknown>[] = [];
  constructor(
    readonly type: string,
    readonly parents: unknown[],
    readonly attributes: Record<string, unknown>,
  ) {}
  setAttribute(attributes: Record<string, unknown>): void {
    this.history.push(attributes);
  }
  /** 마지막으로 설정된 값. */
  last(key: string): unknown {
    for (let index = this.history.length - 1; index >= 0; index -= 1) {
      const entry = this.history[index];
      if (entry !== undefined && key in entry) return entry[key];
    }
    return this.attributes[key];
  }
}

class FakeBoard implements JxgBoard {
  readonly elements: FakeElement[] = [];
  readonly removed: FakeElement[] = [];
  readonly resizeCalls: [number, number][] = [];
  private width = 0;
  private height = 0;
  private bbox: [number, number, number, number] = [0, 1, 1, 0];
  constructor(
    readonly container: HTMLElement,
    readonly attributes: Record<string, unknown>,
    private readonly failOn: string | null,
  ) {}
  create(type: string, parents: unknown[], attributes: Record<string, unknown>): JxgElement {
    if (this.failOn !== null && type === this.failOn) throw new Error(`fake ${type} failure`);
    const element = new FakeElement(type, parents, attributes);
    this.elements.push(element);
    return element;
  }
  removeObject(element: JxgElement): void {
    if (element instanceof FakeElement) this.removed.push(element);
  }
  update(): void {}
  suspendUpdate(): void {}
  unsuspendUpdate(): void {}
  setBoundingBox(boundingBox: [number, number, number, number]): void {
    this.bbox = boundingBox;
  }
  resizeContainer(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.resizeCalls.push([width, height]);
  }
  getBoundingBox(): [number, number, number, number] {
    return this.bbox;
  }
  get unitX(): number {
    return this.width / (this.bbox[2] - this.bbox[0]);
  }
  get unitY(): number {
    return this.height / (this.bbox[1] - this.bbox[3]);
  }
  byId(id: string): FakeElement | undefined {
    return this.elements.find((element) => element.attributes["id"] === id);
  }
  /** 보조 점(보이지 않는 끝점 등)을 뺀 요소. */
  visibleCreations(): FakeElement[] {
    return this.elements.filter((element) => typeof element.attributes["id"] === "string");
  }
}

const fake = {
  boards: [] as FakeBoard[],
  freed: [] as FakeBoard[],
  failOn: null as string | null,
  loader: null as null | (() => Promise<JsxGraphApi>),
  live(): number {
    return this.boards.length - this.freed.length;
  },
};

const fakeApi: JsxGraphApi = {
  initBoard(container, attributes) {
    const board = new FakeBoard(container, attributes, fake.failOn);
    fake.boards.push(board);
    return board;
  },
  freeBoard(board) {
    if (board instanceof FakeBoard) fake.freed.push(board);
  },
};

vi.mock("./jsxgraphAdapter", () => ({
  loadJsxGraph: () => (fake.loader === null ? Promise.resolve(fakeApi) : fake.loader()),
}));

/* ---------------------------------------------------------------------------------------------
 * 환경: 폭·ResizeObserver·rAF·토큰
 * ------------------------------------------------------------------------------------------- */

let mockWidth = 348;
const observers: { callback: ResizeObserverCallback; instance: ResizeObserver }[] = [];

class ControlledResizeObserver {
  constructor(private readonly callback: ResizeObserverCallback) {}
  observe(): void {
    observers.push({ callback: this.callback, instance: this });
  }
  unobserve(): void {}
  disconnect(): void {
    const index = observers.findIndex((entry) => entry.instance === (this as unknown as ResizeObserver));
    if (index >= 0) observers.splice(index, 1);
  }
}

function triggerResize(width: number): void {
  mockWidth = width;
  act(() => {
    for (const { callback, instance } of [...observers]) callback([], instance);
  });
}

const TOKENS: Record<string, string> = {
  [FIGURE_PALETTE_TOKENS.ink]: "#232b38",
  [FIGURE_PALETTE_TOKENS.brand]: "#5e6e82",
  [FIGURE_PALETTE_TOKENS.teal]: "#4f8285",
  [FIGURE_PALETTE_TOKENS.axis]: "#3c3c4399",
  [FIGURE_PALETTE_TOKENS.grid]: "#3c3c431f",
  [FIGURE_PALETTE_TOKENS.underlay]: "#dcc08a",
  [FIGURE_PALETTE_TOKENS.canvas]: "#fbfaf6",
};

beforeEach(() => {
  fake.boards = [];
  fake.freed = [];
  fake.failOn = null;
  fake.loader = null;
  mockWidth = 348;
  observers.length = 0;
  vi.stubGlobal("ResizeObserver", ControlledResizeObserver);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 0));
  vi.stubGlobal("cancelAnimationFrame", (handle: number) => window.clearTimeout(handle));
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(() => mockWidth);
  for (const [name, value] of Object.entries(TOKENS)) document.documentElement.style.setProperty(name, value);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function spec(raw: unknown): FigureSpec {
  return figureSpecSchema.parse(raw);
}

async function waitForBoards(count: number): Promise<void> {
  await waitFor(() => expect(fake.boards).toHaveLength(count));
}

/* ---------------------------------------------------------------------------------------------
 * R-1 생성 순서와 안전 속성
 * ------------------------------------------------------------------------------------------- */

describe("R-1 요소 생성 순서와 안전 속성", () => {
  it("elements 순서대로 만들고, 모든 텍스트·라벨이 internal/parse false/수식 엔진 off", async () => {
    render(<FigureView spec={spec(F01_TRIANGLE_ANGLE.raw)} />);
    await waitForBoards(1);
    const board = fake.boards[0];
    if (board === undefined) throw new Error("board");

    const order = board.visibleCreations().map((element) => {
      const key = String(element.attributes["id"]).split("-")[0] ?? "";
      return key.slice(key.indexOf("_") + 1);
    });
    expect([...new Set(order)]).toEqual(["A", "B", "C", "tri", "angA"]);

    const safe = { display: "internal", parse: false, useMathJax: false, useKatex: false, useASCIIMathML: false };
    const texts = board.elements.filter((element) => element.type === "text");
    expect(texts.length).toBeGreaterThan(0);
    for (const text of texts) expect(text.attributes).toEqual(expect.objectContaining(safe));
    const labelled = board.elements.filter((element) => element.type === "point" && element.attributes["withLabel"] === true);
    expect(labelled).toHaveLength(3);
    for (const pointElement of labelled) expect(pointElement.attributes["label"]).toEqual(expect.objectContaining(safe));

    // 라벨 없는 점: name "" + withLabel false. 모든 요소 fixed·hover 강조 없음.
    for (const element of board.elements) {
      expect(element.attributes).toEqual(expect.objectContaining({ fixed: true, highlight: false }));
      if (element.type === "point" && element.attributes["withLabel"] !== true) {
        expect(element.attributes).toEqual(expect.objectContaining({ name: "", withLabel: false }));
      }
    }
    // 각: withLabel false, 직각 표시 없는 각은 sector로 강제(자동 직각 사각형 금지).
    const angle = board.elements.find((element) => element.type === "angle");
    expect(angle?.attributes).toEqual(expect.objectContaining({ withLabel: false, type: "sector", orthoType: "sector" }));
  });

  it("보드 설정: 장식·조작·이벤트 등록을 모두 끈다", async () => {
    render(<FigureView spec={spec(F01_TRIANGLE_ANGLE.raw)} />);
    await waitForBoards(1);
    expect(fake.boards[0]?.attributes).toEqual(
      expect.objectContaining({
        showCopyright: false,
        showNavigation: false,
        showZoom: false,
        showInfobox: false,
        registerEvents: false,
        pan: { enabled: false },
        zoom: { enabled: false, wheel: false, pinch: false },
        keyboard: { enabled: false },
        resize: { enabled: false },
      }),
    );
  });

  it("보드 컨테이너는 React 자식이 없는 전용 div, 영숫자 id, aria-hidden", async () => {
    const { container } = render(<FigureView spec={spec(F01_TRIANGLE_ANGLE.raw)} />);
    await waitForBoards(1);
    const boardElement = fake.boards[0]?.container;
    expect(boardElement?.id).toMatch(/^figboard[A-Za-z0-9]+$/);
    expect(boardElement?.childElementCount).toBe(0);
    expect(boardElement?.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector("figure figcaption")?.textContent).toBe(`그림 설명: ${spec(F01_TRIANGLE_ANGLE.raw).description}`);
  });
});

/* ---------------------------------------------------------------------------------------------
 * R-2 StrictMode·지연 로딩 중 언마운트
 * ------------------------------------------------------------------------------------------- */

describe("R-2 보드 수명주기", () => {
  it("StrictMode에서도 살아 있는 보드는 1개, 언마운트하면 0개", async () => {
    const { unmount } = render(
      <StrictMode>
        <FigureView spec={spec(F01_TRIANGLE_ANGLE.raw)} />
      </StrictMode>,
    );
    await waitFor(() => expect(fake.live()).toBe(1));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(fake.live()).toBe(1);
    unmount();
    expect(fake.live()).toBe(0);
  });

  it("지연 로딩이 끝나기 전에 언마운트되면 보드를 만들지 않는다", async () => {
    let resolveLoad: (api: JsxGraphApi) => void = () => {};
    fake.loader = () =>
      new Promise((resolve) => {
        resolveLoad = resolve;
      });
    const { container, unmount } = render(<FigureView spec={spec(F01_TRIANGLE_ANGLE.raw)} />);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    // 떨어져 나간 컨테이너에서도 토큰을 읽을 수 있게 해, "취소 확인"만으로 보드 생성이 막히는지 본다.
    const boardElement = container.querySelector<HTMLElement>("[id^='figboard']");
    for (const [name, value] of Object.entries(TOKENS)) boardElement?.style.setProperty(name, value);
    unmount();
    await act(async () => {
      resolveLoad(fakeApi);
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(fake.boards).toHaveLength(0);
  });
});

/* ---------------------------------------------------------------------------------------------
 * R-3 크기 0과 리사이즈
 * ------------------------------------------------------------------------------------------- */

describe("R-3 크기 0 대응과 리사이즈", () => {
  it("폭 0이면 보드를 만들지 않고 자리만 잡은 채 기다리다가, 폭이 생기면 만든다", async () => {
    mockWidth = 0;
    const { container } = render(<FigureView spec={spec(F01_TRIANGLE_ANGLE.raw)} />);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(fake.boards).toHaveLength(0);
    expect(screen.getByText("그림을 준비하는 중")).toBeInTheDocument();
    expect(container.querySelector("figure")?.getAttribute("aria-busy")).toBe("true");

    triggerResize(348);
    await waitForBoards(1);
    await waitFor(() => expect(container.querySelector("figure")?.hasAttribute("aria-busy")).toBe(false));
    expect(screen.queryByText("그림을 준비하는 중")).not.toBeInTheDocument();
  });

  it("폭이 바뀌면 보드를 다시 만들지 않고 resizeContainer만 한다", async () => {
    render(<FigureView spec={spec(F01_TRIANGLE_ANGLE.raw)} />);
    await waitForBoards(1);
    const board = fake.boards[0];
    triggerResize(708);
    await waitFor(() => expect(board?.resizeCalls.at(-1)?.[0]).toBe(708));
    expect(fake.boards).toHaveLength(1);
    expect(fake.freed).toHaveLength(0);
  });
});

/* ---------------------------------------------------------------------------------------------
 * R-4 각 정규화, R-5 함수 조각
 * ------------------------------------------------------------------------------------------- */

describe("R-4·R-5 커널 좌표로 그린다", () => {
  it("R-4 각은 정규화 순서의 보조 점 세 개로 만든다(F02 ∠CHB → B, H, C), 직각 표시는 square", async () => {
    render(<FigureView spec={spec(F02_FOOT_OF_PERPENDICULAR.raw)} />);
    await waitForBoards(1);
    const angle = fake.boards[0]?.elements.find((element) => element.type === "angle");
    const coords = angle?.parents.map((parent) => (parent instanceof FakeElement ? parent.parents : null));
    expect(coords).toEqual([
      [6, 0],
      [2, 0],
      [2, 4],
    ]);
    expect(angle?.attributes).toEqual(expect.objectContaining({ type: "square", orthoType: "square" }));
    // 수선의 발 H는 커널 좌표(2, 0)의 점으로 만든다(JSXGraph 작도 미사용).
    const footPoint = fake.boards[0]?.byId(
      String(fake.boards[0]?.elements.find((element) => element.type === "point" && element.attributes["name"] === "H")?.attributes["id"]),
    );
    expect(footPoint?.parents).toEqual([2, 0]);
  });

  it("R-5 함수 그래프는 조각마다 curve 하나(F08 → 2개), 유한 값만", async () => {
    render(<FigureView spec={spec(F08_RATIONAL.raw)} />);
    await waitForBoards(1);
    const curves = (fake.boards[0]?.visibleCreations() ?? []).filter(
      (element) => element.type === "curve" && /^cv\d+_g$/.test(String(element.attributes["id"])),
    );
    expect(curves).toHaveLength(2);
    for (const curve of curves) {
      const [xs, ys] = curve.parents as [number[], number[]];
      expect([...xs, ...ys].every(Number.isFinite)).toBe(true);
    }
    expect(fake.boards[0]?.elements.some((element) => element.type === "functiongraph")).toBe(false);
  });
});

/* ---------------------------------------------------------------------------------------------
 * R-6 오류 격리와 description escape
 * ------------------------------------------------------------------------------------------- */

describe("R-6 대체 표시 격리", () => {
  it("의미 검증 실패 도형만 대체 표시하고, description은 텍스트로만 출력한다", async () => {
    const malicious = { ...(F10A_MISSING_REFERENCE.raw as Record<string, unknown>), description: '<img src=x onerror="alert(1)">설명 & 끝' };
    const { container } = render(
      <>
        <FigureView spec={spec(malicious)} />
        <FigureView spec={spec(F01_TRIANGLE_ANGLE.raw)} />
      </>,
    );
    await waitForBoards(1);
    expect(screen.getAllByText(FIGURE_FALLBACK_MESSAGE)).toHaveLength(1);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText('<img src=x onerror="alert(1)">설명 & 끝')).toBeInTheDocument();
    expect(container.querySelector("[role='alert']")).toBeNull();
  });

  it("JSXGraph 예외가 나면 그 도형만 대체 표시하고 보드를 해제한다", async () => {
    fake.failOn = "angle";
    const onStatusChange = vi.fn();
    render(
      <>
        <FigureView spec={spec(F01_TRIANGLE_ANGLE.raw)} onStatusChange={onStatusChange} />
        <FigureView spec={spec(F08_RATIONAL.raw)} />
      </>,
    );
    await waitFor(() => expect(screen.getAllByText(FIGURE_FALLBACK_MESSAGE)).toHaveLength(1));
    await waitFor(() => expect(onStatusChange).toHaveBeenLastCalledWith("error"));
    // F01 보드는 만들다 실패해 해제, F08 보드는 살아 있다.
    expect(fake.boards).toHaveLength(2);
    expect(fake.live()).toBe(1);
  });

  it("JSXGraph 청크 로드 실패(오프라인 등)면 대체 표시", async () => {
    fake.loader = () => Promise.reject(new Error("chunk"));
    render(<FigureView spec={spec(F01_TRIANGLE_ANGLE.raw)} />);
    await waitFor(() => expect(screen.getByText(FIGURE_FALLBACK_MESSAGE)).toBeInTheDocument());
  });

  it("색 토큰을 읽지 못하면 임의 색 대신 대체 표시", async () => {
    for (const name of Object.keys(TOKENS)) document.documentElement.style.removeProperty(name);
    render(<FigureView spec={spec(F01_TRIANGLE_ANGLE.raw)} />);
    await waitFor(() => expect(screen.getByText(FIGURE_FALLBACK_MESSAGE)).toBeInTheDocument());
    expect(fake.boards).toHaveLength(0);
  });
});

/* ---------------------------------------------------------------------------------------------
 * R-7 단계 상태, R-8 스타일 매핑
 * ------------------------------------------------------------------------------------------- */

describe("R-7 단계 전환은 보드를 다시 만들지 않는다", () => {
  it("F09 s2 → s3: angAHC가 숨겨지고(hide 누적), M이 강조된다", async () => {
    const figure = spec(F09_STEPWISE_AUXILIARY.raw);
    const { rerender } = render(<FigureView spec={figure} stepId="s2" />);
    await waitForBoards(1);
    const board = fake.boards[0];
    if (board === undefined) throw new Error("board");
    const angle = board.elements.find((element) => element.type === "angle");
    const midpoint = board.elements.find((element) => element.type === "point" && element.attributes["name"] === "M");
    expect(angle?.last("visible")).toBe(true);
    expect(angle?.last("strokeWidth")).toBe(2.5);
    expect(midpoint?.last("visible")).toBe(false);

    rerender(<FigureView spec={figure} stepId="s3" />);
    await waitFor(() => expect(angle?.last("visible")).toBe(false));
    expect(midpoint?.last("visible")).toBe(true);
    expect(midpoint?.last("size")).toBe(4.5);
    expect(fake.boards).toHaveLength(1);
    expect(fake.freed).toHaveLength(0);

    rerender(<FigureView spec={figure} />);
    await waitFor(() => expect(midpoint?.last("size")).toBe(3));
    expect(angle?.last("visible")).toBe(false);
  });
});

describe("R-8 role × 상태 스타일이 보드 요소에 적용된다", () => {
  it("F02 s2: 강조된 보조선 segCH는 굵기 2.5 + dash 2 + 언더레이, 비강조 segAB는 불투명도 0.65", async () => {
    render(<FigureView spec={spec(F02_FOOT_OF_PERPENDICULAR.raw)} stepId="s2" />);
    await waitForBoards(1);
    const board = fake.boards[0];
    if (board === undefined) throw new Error("board");
    const byElement = (elementId: string, suffix = ""): FakeElement | undefined =>
      board.visibleCreations().find((element) => new RegExp(`^ln\\d+_${elementId}${suffix}$`).test(String(element.attributes["id"])));

    const segCH = byElement("segCH");
    expect(segCH?.last("strokeColor")).toBe("#5e6e82");
    expect(segCH?.last("strokeWidth")).toBe(2.5);
    expect(segCH?.last("dash")).toBe(2);
    const underlay = board.visibleCreations().find((element) => /^ln\d+_segCH-u$/.test(String(element.attributes["id"])));
    expect(underlay?.last("visible")).toBe(true);
    expect(underlay?.last("strokeColor")).toBe("#dcc08a");
    expect(underlay?.last("strokeOpacity")).toBe(0.5);
    expect(underlay?.last("strokeWidth")).toBe(10);

    const segAB = byElement("segAB");
    expect(segAB?.last("strokeColor")).toBe("#232b38");
    expect(segAB?.last("strokeOpacity")).toBe(0.65);
    expect(segAB?.last("strokeWidth")).toBe(2);
    const segABUnderlay = board.visibleCreations().find((element) => /^ln\d+_segAB-u$/.test(String(element.attributes["id"])));
    expect(segABUnderlay?.last("visible")).toBe(false);
  });
});

describe("재작업 1", () => {
  it("P2-2 폭이 바뀌어 눈금 간격이 달라지면 장식만 다시 만든다(요소는 그대로)", async () => {
    render(<FigureView spec={spec(F07_QUADRATIC.raw)} />);
    await waitForBoards(1);
    const board = fake.boards[0];
    if (board === undefined) throw new Error("board");
    const pointsBefore = board.elements.filter((element) => element.type === "point" && typeof element.attributes["id"] === "string").length;
    const gridBefore = board.elements.filter((element) => /^d0grid/.test(String(element.attributes["id"])));
    expect(gridBefore).toHaveLength(1);

    triggerResize(150);
    await waitFor(() => expect(board.removed.length).toBeGreaterThan(0));
    expect(board.removed).toEqual(expect.arrayContaining(gridBefore));
    expect(board.elements.some((element) => /^d1grid/.test(String(element.attributes["id"])))).toBe(true);
    const pointsAfter = board.elements.filter((element) => element.type === "point" && typeof element.attributes["id"] === "string").length;
    expect(pointsAfter).toBe(pointsBefore);
    expect(fake.boards).toHaveLength(1);
  });

  it("P3-1 축 화살표는 8×8(type 1, size 8)", async () => {
    render(<FigureView spec={spec(F07_QUADRATIC.raw)} />);
    await waitForBoards(1);
    const axes = fake.boards[0]?.elements.filter((element) => element.type === "line" && /axx|axy/.test(String(element.attributes["id"])));
    expect(axes).toHaveLength(2);
    for (const axis of axes ?? []) expect(axis.attributes["lastArrow"]).toEqual({ type: 1, size: 8 });
  });

  it("MEDIUM-2 공백 없는 긴 설명도 줄바꿈되도록 figcaption·대체 표시 문구에 overflow-wrap:anywhere", () => {
    const long = { ...(F10A_MISSING_REFERENCE.raw as Record<string, unknown>), description: "W".repeat(500) };
    const { container } = render(<FigureView spec={spec(long)} />);
    const caption = container.querySelector("figcaption");
    expect(caption?.className).toContain("wrap-anywhere");
    expect(screen.getByText(FIGURE_FALLBACK_MESSAGE).className).toContain("wrap-anywhere");
    expect(caption?.textContent).toContain("W".repeat(500));
  });
});

describe("후속 정리 — 직각 표시는 항상 실선(design P2-A)", () => {
  it("auxiliary 직각 표시(F02 ∠CHB)는 dash 0, 색·굵기는 role(brand, 1.5)", async () => {
    render(<FigureView spec={spec(F02_FOOT_OF_PERPENDICULAR.raw)} />);
    await waitForBoards(1);
    const angle = fake.boards[0]?.elements.find((element) => element.type === "angle");
    expect(angle?.attributes["type"]).toBe("square");
    expect(angle?.last("dash")).toBe(0);
    expect(angle?.last("strokeColor")).toBe("#5e6e82");
    expect(angle?.last("strokeWidth")).toBe(1.5);
  });

  it("직각 표시가 아닌 auxiliary 각 호는 role 규칙대로 점선(dash 2)", async () => {
    const raw = structuredClone(F02_FOOT_OF_PERPENDICULAR.raw) as { elements: Record<string, unknown>[] };
    const angleElement = raw.elements.find((element) => element["id"] === "angCHB");
    if (angleElement === undefined) throw new Error("F02 구조가 바뀌었다");
    angleElement["rightAngleMark"] = false;
    render(<FigureView spec={spec(raw)} />);
    await waitForBoards(1);
    const angle = fake.boards[0]?.elements.find((element) => element.type === "angle");
    expect(angle?.attributes["type"]).toBe("sector");
    expect(angle?.last("dash")).toBe(2);
  });
});

